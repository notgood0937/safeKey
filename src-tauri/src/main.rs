// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod sync;
mod state;
mod vault;

use commands::{create_vault, load_vault, get_vault, save_entry, delete_entry, sync_get_ticket, sync_send};
use state::AppState;


fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            create_vault,
            load_vault,
            get_vault,
            save_entry,
            delete_entry,
            sync_get_ticket,
            sync_send
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
