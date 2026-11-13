//! Journal registry: metadata for journals/publishers, kept separate from any
//! downloaded template files. The bundled registry (`assets/journals/registry.json`)
//! is synced into SQLite at startup; user-imported templates and user-recorded
//! indexing verifications live in their own tables and are never overwritten.

use crate::database::Database;
use crate::error::AppResult;
use serde::{Deserialize, Serialize};

const BUNDLED: &str = include_str!("../../assets/journals/registry.json");

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct Issn {
    pub print: Option<String>,
    pub electronic: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct Indexing {
    /// not-verified | publisher-stated | user-verified
    pub status: String,
    pub detail: String,
    pub source: Option<String>,
    pub date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct Requirements {
    pub sections: Vec<String>,
    pub abstract_max_words: Option<u32>,
    pub max_pages: Option<u32>,
    pub statements: Vec<String>,
    pub notes: Vec<String>,
    pub source: Option<String>,
    pub verified: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct JournalEntry {
    pub id: String,
    pub name: String,
    pub publisher: String,
    pub issn: Option<Issn>,
    pub subjects: Vec<String>,
    pub disciplines: Vec<String>,
    pub manuscript_types: Vec<String>,
    /// journal | conference
    pub venue: String,
    /// two-column | single-column
    pub layout: String,
    /// ctan-class | publisher-download | community-profile | custom
    pub template_type: String,
    pub official: bool,
    pub ctan_class: Option<String>,
    pub class_options: Option<String>,
    pub bib_style: Option<String>,
    pub bib_tool: String,
    pub engine: String,
    pub source_url: Option<String>,
    pub download_url: Option<String>,
    pub author_instructions_url: Option<String>,
    pub homepage_url: Option<String>,
    pub license: Option<String>,
    pub version: Option<String>,
    pub last_verified: Option<String>,
    pub verification_note: String,
    pub open_access: Option<bool>,
    pub indexing: Indexing,
    pub required_packages: Vec<String>,
    pub notes: Vec<String>,
    pub requirements: Requirements,
    // ---- runtime fields (not in the bundled file) ----
    /// "bundled" or "custom"
    pub origin: String,
    /// For custom templates: folder holding the imported files.
    pub template_path: Option<String>,
    pub main_file: Option<String>,
    pub installed_at: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Bundle {
    registry_version: i64,
    journals: Vec<JournalEntry>,
}

pub fn bundled() -> Vec<JournalEntry> {
    let b: Bundle = serde_json::from_str(BUNDLED).expect("bundled registry.json is valid");
    b.journals.into_iter().map(|mut j| {
        j.origin = "bundled".into();
        j
    }).collect()
}

/// Load the bundled registry into SQLite when its version changes.
pub fn sync(db: &Database) -> AppResult<()> {
    let b: Bundle = serde_json::from_str(BUNDLED)?;
    let current = db.get_setting("registry_version")?.and_then(|v| v.parse::<i64>().ok()).unwrap_or(0);
    if current != b.registry_version || db.count_journals("bundled")? == 0 {
        let rows: Vec<(String, String)> = bundled().into_iter().map(|j| (j.id.clone(), serde_json::to_string(&j).unwrap())).collect();
        db.replace_journals("bundled", &rows)?;
        db.set_setting("registry_version", &b.registry_version.to_string())?;
    }
    Ok(())
}

pub fn list(db: &Database) -> AppResult<Vec<JournalEntry>> {
    let notes = db.indexing_notes()?;
    let mut out = Vec::new();
    for (_, json) in db.list_journals()? {
        if let Ok(mut j) = serde_json::from_str::<JournalEntry>(&json) {
            if let Some(n) = notes.iter().find(|(id, _)| *id == j.id) {
                if let Ok(ix) = serde_json::from_str::<Indexing>(&n.1) {
                    j.indexing = ix;
                }
            }
            out.push(j);
        }
    }
    out.sort_by(|a, b| (a.origin != "custom", &a.publisher, &a.name).cmp(&(b.origin != "custom", &b.publisher, &b.name)));
    Ok(out)
}

pub fn get(db: &Database, id: &str) -> AppResult<JournalEntry> {
    list(db)?
        .into_iter()
        .find(|j| j.id == id)
        .ok_or_else(|| crate::error::AppError::NotFound(format!("journal {id}")))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn bundled_registry_is_consistent() {
        let all = bundled();
        assert!(all.len() >= 20);
        let mut ids = std::collections::HashSet::new();
        for j in &all {
            assert!(ids.insert(j.id.clone()), "duplicate id {}", j.id);
            assert!(!j.name.is_empty() && !j.publisher.is_empty());
            match j.template_type.as_str() {
                "ctan-class" => assert!(j.ctan_class.is_some(), "{} needs a class", j.id),
                "publisher-download" => assert!(j.source_url.is_some() || j.author_instructions_url.is_some()),
                "community-profile" => assert!(!j.official, "{} community profiles are never official", j.id),
                t => panic!("unknown template type {t}"),
            }
            // Indexing claims must carry a source and date.
            if j.indexing.status != "not-verified" {
                assert!(j.indexing.source.is_some() && j.indexing.date.is_some(), "{}", j.id);
            }
        }
    }

    #[test]
    fn sync_and_list() {
        let db = Database::open_in_memory().unwrap();
        sync(&db).unwrap();
        sync(&db).unwrap();
        let l = list(&db).unwrap();
        assert_eq!(l.len(), bundled().len());
        db.set_indexing_note("ieee-access", r#"{"status":"user-verified","detail":"SCIE (checked JCR)","source":"https://x","date":"2026-11-13"}"#).unwrap();
        assert_eq!(get(&db, "ieee-access").unwrap().indexing.status, "user-verified");
    }
}
