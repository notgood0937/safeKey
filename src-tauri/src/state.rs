use std::sync::Arc;
use tokio::sync::Mutex;
use crate::vault::VaultManager;
use crate::sync::SyncManager;

pub struct AppState {
    pub vault_manager: Arc<Mutex<VaultManager>>,
    pub sync_manager: Arc<Mutex<SyncManager>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            vault_manager: Arc::new(Mutex::new(VaultManager::new())),
            sync_manager: Arc::new(Mutex::new(SyncManager::default())),
        }
    }
}
