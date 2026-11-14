//! Quantum Maze – Research & LaTeX Studio (Rust backend).

pub mod commands;
pub mod compiler;
pub mod converter;
pub mod notebooks;
pub mod online;
pub mod presentation;
pub mod story;
pub mod submission;
pub mod database;
pub mod error;
pub mod filesystem;
pub mod security;
pub mod settings;
pub mod templates;

use commands::AppState;
use std::sync::{Arc, Mutex};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .register_uri_scheme_protocol(story::SCHEME, |ctx, req| {
            match ctx.app_handle().try_state::<Arc<AppState>>() {
                Some(st) => story::handle(&st.story, req.uri().path()),
                None => tauri::http::Response::builder().status(503).body(std::borrow::Cow::Owned(Vec::new())).unwrap(),
            }
        })
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let db = database::Database::open(&data_dir.join("quantum-maze.sqlite"))
                .map_err(|e| Box::<dyn std::error::Error>::from(e.to_string()))?;
            templates::registry::sync(&db).map_err(|e| Box::<dyn std::error::Error>::from(e.to_string()))?;
            app.manage(Arc::new(AppState {
                db,
                compiler: compiler::CompileManager::default(),
                open_roots: Mutex::new(Default::default()),
                data_dir,
                story: Default::default(),
            }));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_settings,
            commands::save_settings,
            commands::detect_tex,
            commands::app_info,
            commands::log_frontend,
            commands::recent_projects,
            commands::forget_recent,
            commands::create_project,
            commands::open_project,
            commands::update_project_meta,
            commands::list_files,
            commands::read_text_file,
            commands::write_text_file,
            commands::read_binary_file,
            commands::create_file,
            commands::create_folder,
            commands::rename_path,
            commands::delete_path,
            commands::list_snapshots,
            commands::read_snapshot,
            commands::write_recovery,
            commands::read_recovery,
            commands::clear_recovery,
            commands::compile,
            commands::cancel_compile,
            commands::compile_history,
            commands::read_last_pdf,
            commands::clean_build,
            commands::synctex_forward,
            commands::synctex_inverse,
            commands::export_pdf,
            commands::export_zip,
            commands::list_journals,
            commands::set_journal_indexing,
            commands::class_status,
            commands::create_journal_project,
            commands::stage_import,
            commands::install_custom_template,
            commands::delete_custom_template,
            commands::create_project_from_staged,
            commands::convert_docx_to_latex,
            commands::convert_latex_to_docx,
            commands::build_submission,
            commands::doi_lookup,
            commands::set_story_preview,
            commands::export_story,
            commands::import_story_asset,
            commands::import_figure,
            commands::notebooks_list,
            commands::notebook_read,
            commands::notebook_write,
            commands::notebook_trash,
            commands::list_story_templates,
            commands::story_template_cover,
            commands::create_story_from_template,
            commands::save_story_template,
            commands::delete_story_template,
            commands::export_story_template,
            commands::import_story_template,
            commands::export_pptx,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Quantum Maze");
}
