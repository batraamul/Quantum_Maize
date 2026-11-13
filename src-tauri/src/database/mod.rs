//! SQLite persistence: settings, project registry (recent projects) and
//! compilation history. Schema changes are applied through ordered, versioned
//! migrations so older databases upgrade in place and user preferences survive
//! application upgrades.
//!
//! The journal registry and indexing-note tables are migration 2;
//! project *source files* are never stored here — they remain ordinary files.

use crate::error::AppResult;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Mutex;

/// Ordered migrations. NEVER edit an existing entry; append a new one.
const MIGRATIONS: &[(i64, &str)] = &[(
    1,
    r#"
    CREATE TABLE settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );
    CREATE TABLE projects (
        id             TEXT PRIMARY KEY,
        name           TEXT NOT NULL,
        path           TEXT NOT NULL UNIQUE,
        main_file      TEXT NOT NULL,
        engine         TEXT NOT NULL,
        created_at     TEXT NOT NULL,
        last_opened_at TEXT NOT NULL
    );
    CREATE INDEX idx_projects_last_opened ON projects(last_opened_at DESC);
    CREATE TABLE compile_history (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id    TEXT NOT NULL,
        started_at    TEXT NOT NULL,
        duration_ms   INTEGER NOT NULL,
        engine        TEXT NOT NULL,
        tool          TEXT NOT NULL,
        success       INTEGER NOT NULL,
        error_count   INTEGER NOT NULL,
        warning_count INTEGER NOT NULL
    );
    CREATE INDEX idx_history_project ON compile_history(project_id, started_at DESC);
    "#,
), (
    2,
    r#"
    CREATE TABLE journals (
        id         TEXT PRIMARY KEY,
        origin     TEXT NOT NULL,
        data       TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    CREATE TABLE journal_indexing_notes (
        journal_id TEXT PRIMARY KEY,
        data       TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    "#,
)];

pub struct Database {
    conn: Mutex<Connection>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentProject {
    pub id: String,
    pub name: String,
    pub path: String,
    pub main_file: String,
    pub engine: String,
    pub last_opened_at: String,
    pub exists: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub started_at: String,
    pub duration_ms: i64,
    pub engine: String,
    pub tool: String,
    pub success: bool,
    pub error_count: i64,
    pub warning_count: i64,
}

impl Database {
    pub fn open(path: &Path) -> AppResult<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let conn = Connection::open(path)?;
        Self::init(conn)
    }

    pub fn open_in_memory() -> AppResult<Self> {
        Self::init(Connection::open_in_memory()?)
    }

    fn init(conn: Connection) -> AppResult<Self> {
        conn.pragma_update(None, "journal_mode", "WAL").ok();
        conn.pragma_update(None, "foreign_keys", "ON")?;
        let db = Database { conn: Mutex::new(conn) };
        db.migrate()?;
        Ok(db)
    }

    fn migrate(&self) -> AppResult<()> {
        let mut conn = self.conn.lock().unwrap();
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);",
        )?;
        let current: i64 = conn.query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
            [],
            |r| r.get(0),
        )?;
        for (version, sql) in MIGRATIONS.iter().filter(|(v, _)| *v > current) {
            let tx = conn.transaction()?;
            tx.execute_batch(sql)?;
            tx.execute(
                "INSERT INTO schema_migrations(version, applied_at) VALUES (?1, ?2)",
                params![version, chrono::Utc::now().to_rfc3339()],
            )?;
            tx.commit()?;
        }
        Ok(())
    }

    pub fn schema_version(&self) -> AppResult<i64> {
        let conn = self.conn.lock().unwrap();
        Ok(conn.query_row("SELECT MAX(version) FROM schema_migrations", [], |r| r.get(0))?)
    }

    // ---- settings -------------------------------------------------------

    pub fn get_setting(&self, key: &str) -> AppResult<Option<String>> {
        let conn = self.conn.lock().unwrap();
        Ok(conn
            .query_row("SELECT value FROM settings WHERE key = ?1", [key], |r| r.get(0))
            .optional()?)
    }

    pub fn set_setting(&self, key: &str, value: &str) -> AppResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO settings(key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )?;
        Ok(())
    }

    // ---- projects -------------------------------------------------------

    pub fn upsert_project(
        &self,
        id: &str,
        name: &str,
        path: &str,
        main_file: &str,
        engine: &str,
        created_at: &str,
    ) -> AppResult<()> {
        let now = chrono::Utc::now().to_rfc3339();
        let conn = self.conn.lock().unwrap();
        // A folder may have been re-created with a new id; path is the identity users see.
        conn.execute("DELETE FROM projects WHERE path = ?1 AND id <> ?2", params![path, id])?;
        conn.execute(
            "INSERT INTO projects(id, name, path, main_file, engine, created_at, last_opened_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
             ON CONFLICT(id) DO UPDATE SET name=excluded.name, path=excluded.path,
               main_file=excluded.main_file, engine=excluded.engine,
               last_opened_at=excluded.last_opened_at",
            params![id, name, path, main_file, engine, created_at, now],
        )?;
        Ok(())
    }

    pub fn recent_projects(&self, limit: i64) -> AppResult<Vec<RecentProject>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, path, main_file, engine, last_opened_at FROM projects
             ORDER BY last_opened_at DESC LIMIT ?1",
        )?;
        let rows = stmt
            .query_map([limit], |r| {
                let path: String = r.get(2)?;
                Ok(RecentProject {
                    id: r.get(0)?,
                    name: r.get(1)?,
                    exists: Path::new(&path).join(".qmaze/project.json").exists(),
                    path,
                    main_file: r.get(3)?,
                    engine: r.get(4)?,
                    last_opened_at: r.get(5)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(rows)
    }

    pub fn forget_project(&self, path: &str) -> AppResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM projects WHERE path = ?1", [path])?;
        Ok(())
    }

    // ---- journal registry ------------------------------------------------

    pub fn count_journals(&self, origin: &str) -> AppResult<i64> {
        let conn = self.conn.lock().unwrap();
        Ok(conn.query_row("SELECT COUNT(*) FROM journals WHERE origin = ?1", [origin], |r| r.get(0))?)
    }

    /// Replace all rows of one origin (used for the bundled registry only).
    pub fn replace_journals(&self, origin: &str, rows: &[(String, String)]) -> AppResult<()> {
        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction()?;
        tx.execute("DELETE FROM journals WHERE origin = ?1", [origin])?;
        let now = chrono::Utc::now().to_rfc3339();
        for (id, data) in rows {
            tx.execute("INSERT OR REPLACE INTO journals(id, origin, data, updated_at) VALUES (?1, ?2, ?3, ?4)", params![id, origin, data, now])?;
        }
        tx.commit()?;
        Ok(())
    }

    pub fn upsert_journal(&self, id: &str, origin: &str, data: &str) -> AppResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO journals(id, origin, data, updated_at) VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(id) DO UPDATE SET origin=excluded.origin, data=excluded.data, updated_at=excluded.updated_at",
            params![id, origin, data, chrono::Utc::now().to_rfc3339()],
        )?;
        Ok(())
    }

    pub fn delete_journal(&self, id: &str, origin: &str) -> AppResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM journals WHERE id = ?1 AND origin = ?2", params![id, origin])?;
        Ok(())
    }

    pub fn list_journals(&self) -> AppResult<Vec<(String, String)>> {
        let conn = self.conn.lock().unwrap();
        let mut st = conn.prepare("SELECT id, data FROM journals")?;
        let rows = st.query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?.collect::<Result<Vec<_>, _>>()?;
        Ok(rows)
    }

    pub fn indexing_notes(&self) -> AppResult<Vec<(String, String)>> {
        let conn = self.conn.lock().unwrap();
        let mut st = conn.prepare("SELECT journal_id, data FROM journal_indexing_notes")?;
        let rows = st.query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?.collect::<Result<Vec<_>, _>>()?;
        Ok(rows)
    }

    pub fn set_indexing_note(&self, id: &str, data: &str) -> AppResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO journal_indexing_notes(journal_id, data, updated_at) VALUES (?1, ?2, ?3)
             ON CONFLICT(journal_id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at",
            params![id, data, chrono::Utc::now().to_rfc3339()],
        )?;
        Ok(())
    }

    // ---- compile history -----------------------------------------------

    #[allow(clippy::too_many_arguments)]
    pub fn record_compile(
        &self,
        project_id: &str,
        started_at: &str,
        duration_ms: i64,
        engine: &str,
        tool: &str,
        success: bool,
        errors: i64,
        warnings: i64,
    ) -> AppResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO compile_history(project_id, started_at, duration_ms, engine, tool, success, error_count, warning_count)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![project_id, started_at, duration_ms, engine, tool, success as i64, errors, warnings],
        )?;
        // Keep history bounded per project.
        conn.execute(
            "DELETE FROM compile_history WHERE project_id = ?1 AND id NOT IN
             (SELECT id FROM compile_history WHERE project_id = ?1 ORDER BY id DESC LIMIT 200)",
            [project_id],
        )?;
        Ok(())
    }

    pub fn compile_history(&self, project_id: &str, limit: i64) -> AppResult<Vec<HistoryEntry>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT started_at, duration_ms, engine, tool, success, error_count, warning_count
             FROM compile_history WHERE project_id = ?1 ORDER BY id DESC LIMIT ?2",
        )?;
        let rows = stmt
            .query_map(params![project_id, limit], |r| {
                Ok(HistoryEntry {
                    started_at: r.get(0)?,
                    duration_ms: r.get(1)?,
                    engine: r.get(2)?,
                    tool: r.get(3)?,
                    success: r.get::<_, i64>(4)? != 0,
                    error_count: r.get(5)?,
                    warning_count: r.get(6)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(rows)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrations_idempotent_and_settings_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("pf.sqlite");
        {
            let db = Database::open(&path).unwrap();
            assert_eq!(db.schema_version().unwrap(), 2);
            db.set_setting("app", "{\"theme\":\"dark\"}").unwrap();
        }
        // Re-open (simulates an application upgrade/restart): data retained.
        let db = Database::open(&path).unwrap();
        assert_eq!(db.get_setting("app").unwrap().unwrap(), "{\"theme\":\"dark\"}");
    }

    #[test]
    fn recent_projects_and_history() {
        let db = Database::open_in_memory().unwrap();
        db.upsert_project("a", "Paper A", "/tmp/a", "main.tex", "pdflatex", "t").unwrap();
        db.upsert_project("b", "Paper B", "/tmp/b", "main.tex", "xelatex", "t").unwrap();
        let r = db.recent_projects(10).unwrap();
        assert_eq!(r.len(), 2);
        db.record_compile("a", "now", 1200, "pdflatex", "latexmk", true, 0, 2).unwrap();
        let h = db.compile_history("a", 5).unwrap();
        assert_eq!(h.len(), 1);
        assert!(h[0].success);
        db.forget_project("/tmp/a").unwrap();
        assert_eq!(db.recent_projects(10).unwrap().len(), 1);
    }
}
