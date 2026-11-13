//! Application settings, persisted as JSON in the SQLite `settings` table.
//! `#[serde(default)]` makes the format forward/backward compatible: new
//! fields get defaults, unknown fields from newer versions are ignored.

use crate::database::Database;
use crate::error::AppResult;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub theme: String,
    pub ui_scale: f32,
    pub editor_font_size: u32,
    pub editor_font_family: String,
    pub word_wrap: bool,
    pub minimap: bool,
    pub tab_size: u32,
    pub autosave: bool,
    pub autosave_interval_secs: u32,
    pub auto_compile: bool,
    pub auto_compile_delay_ms: u32,
    pub default_engine: String,
    pub use_latexmk: bool,
    pub compile_timeout_secs: u64,
    pub tex_bin_dir: Option<String>,
    pub setup_completed: bool,
    pub last_project_dir: Option<String>,
    pub show_badboxes: bool,
    /// Owner identity shown as "Quantum Maze by <name>" and used as the
    /// default author/institute in new documents. All optional.
    pub owner_name: String,
    pub owner_rank: String,
    pub owner_organization: String,
    pub owner_email: String,
    /// Opt-in for online services (DOI lookup). Off by default.
    pub allow_online: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            theme: "dark".into(),
            ui_scale: 1.0,
            editor_font_size: 14,
            editor_font_family: "\"JetBrains Mono\", \"Cascadia Code\", \"SF Mono\", Menlo, Consolas, \"DejaVu Sans Mono\", monospace".into(),
            word_wrap: true,
            minimap: false,
            tab_size: 2,
            autosave: true,
            autosave_interval_secs: 30,
            auto_compile: true,
            auto_compile_delay_ms: 2500,
            default_engine: "pdflatex".into(),
            use_latexmk: true,
            compile_timeout_secs: 180,
            tex_bin_dir: None,
            setup_completed: false,
            last_project_dir: None,
            show_badboxes: false,
            owner_name: String::new(),
            owner_rank: String::new(),
            owner_organization: String::new(),
            owner_email: String::new(),
            allow_online: false,
        }
    }
}

const KEY: &str = "app";

impl Settings {
    pub fn load(db: &Database) -> AppResult<Settings> {
        Ok(match db.get_setting(KEY)? {
            Some(raw) => serde_json::from_str(&raw).unwrap_or_default(),
            None => Settings::default(),
        })
    }

    pub fn save(&self, db: &Database) -> AppResult<()> {
        db.set_setting(KEY, &serde_json::to_string(self)?)
    }

    pub fn sanitized(mut self) -> Settings {
        self.editor_font_size = self.editor_font_size.clamp(8, 40);
        self.tab_size = self.tab_size.clamp(1, 8);
        self.autosave_interval_secs = self.autosave_interval_secs.clamp(5, 3600);
        self.auto_compile_delay_ms = self.auto_compile_delay_ms.clamp(500, 30_000);
        self.compile_timeout_secs = self.compile_timeout_secs.clamp(10, 3600);
        self.ui_scale = self.ui_scale.clamp(0.75, 1.5);
        for f in [&mut self.owner_name, &mut self.owner_rank, &mut self.owner_organization, &mut self.owner_email] {
            *f = f.trim().chars().take(160).collect();
        }
        if !matches!(self.default_engine.as_str(), "pdflatex" | "xelatex" | "lualatex") {
            self.default_engine = "pdflatex".into();
        }
        if !matches!(self.theme.as_str(), "dark" | "light" | "system") {
            self.theme = "dark".into();
        }
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn old_settings_json_upgrades() {
        let s: Settings = serde_json::from_str(r#"{"theme":"light","futureField":1}"#).unwrap();
        assert_eq!(s.theme, "light");
        assert_eq!(s.editor_font_size, 14);
        let db = Database::open_in_memory().unwrap();
        s.save(&db).unwrap();
        assert_eq!(Settings::load(&db).unwrap(), s);
        let bad = Settings { compile_timeout_secs: 0, default_engine: "sh".into(), ..Default::default() }.sanitized();
        assert_eq!(bad.compile_timeout_secs, 10);
        assert_eq!(bad.default_engine, "pdflatex");
    }
}
