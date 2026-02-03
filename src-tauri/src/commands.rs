use tauri::{State, command};
use crate::state::AppState;
use crate::vault::{Vault, PasswordEntry};
use std::path::PathBuf;

#[command]
pub async fn create_vault(
    state: State<'_, AppState>,
    path: String,
    master_password: String,
) -> Result<(), String> {
    let mut vault_manager = state.vault_manager.lock().await;
    vault_manager.create_vault(PathBuf::from(path), &master_password)
}

#[command]
pub async fn load_vault(
    state: State<'_, AppState>,
    path: String,
    master_password: String,
) -> Result<Vault, String> {
    let mut vault_manager = state.vault_manager.lock().await;
    vault_manager.load_vault(PathBuf::from(path), &master_password)
}

#[command]
pub async fn get_vault(
    state: State<'_, AppState>,
) -> Result<Vault, String> {
    let vault_manager = state.vault_manager.lock().await;
    vault_manager.get_vault().ok_or("Vault not loaded".to_string())
}

#[command]
pub async fn save_entry(
    state: State<'_, AppState>,
    entry: PasswordEntry,
) -> Result<Vault, String> {
    let mut vault_manager = state.vault_manager.lock().await;
    vault_manager.add_or_update_entry(entry)?;
    vault_manager.get_vault().ok_or("Vault not loaded".to_string())
}

#[command]
pub async fn delete_entry(
    state: State<'_, AppState>,
    id: String,
) -> Result<Vault, String> {
    let mut vault_manager = state.vault_manager.lock().await;
    vault_manager.delete_entry(&id)?;
    vault_manager.get_vault().ok_or("Vault not loaded".to_string())
}

#[command]
pub async fn sync_get_ticket(state: State<'_, AppState>) -> Result<String, String> {
    let vault_manager = state.vault_manager.clone();
    let mut sync_manager = state.sync_manager.lock().await;
    sync_manager.ensure_started(vault_manager).await
}

#[command]
pub async fn sync_send(state: State<'_, AppState>, ticket: String) -> Result<(), String> {
    let vault_manager = state.vault_manager.clone();
    let mut sync_manager = state.sync_manager.lock().await;
    sync_manager.send_vault(vault_manager, &ticket).await
}
