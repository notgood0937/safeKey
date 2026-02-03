use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::sync::Mutex;
use tokio::task::JoinHandle;

use iroh::Endpoint;
use iroh_base::ticket::NodeTicket;

use crate::vault::VaultManager;

const ALPN: &[u8] = b"safekey/vault-sync/1";
const MAX_VAULT_BYTES: u64 = 20 * 1024 * 1024;

pub struct SyncManager {
    endpoint: Option<Endpoint>,
    accept_task: Option<JoinHandle<()>>,
}

impl Default for SyncManager {
    fn default() -> Self {
        Self {
            endpoint: None,
            accept_task: None,
        }
    }
}

impl SyncManager {
    pub async fn ensure_started(
        &mut self,
        vault_manager: Arc<Mutex<VaultManager>>,
    ) -> Result<String, String> {
        if self.endpoint.is_none() {
            let endpoint = Endpoint::builder()
                .alpns(vec![ALPN.to_vec()])
                .bind()
                .await
                .map_err(|e| e.to_string())?;

            let accept_endpoint = endpoint.clone();
            let accept_task = tokio::spawn(async move {
                accept_loop(accept_endpoint, vault_manager).await;
            });

            self.accept_task = Some(accept_task);
            self.endpoint = Some(endpoint);
        }

        let endpoint = self.endpoint.as_ref().ok_or("Sync endpoint not ready")?;
        let node_addr = endpoint.node_addr().await.map_err(|e| e.to_string())?;
        let ticket = NodeTicket::new(node_addr);
        Ok(ticket.to_string())
    }

    pub async fn send_vault(
        &mut self,
        vault_manager: Arc<Mutex<VaultManager>>,
        ticket: &str,
    ) -> Result<(), String> {
        if self.endpoint.is_none() {
            self.ensure_started(vault_manager.clone()).await?;
        }

        let endpoint = self.endpoint.as_ref().ok_or("Sync endpoint not ready")?;
        let ticket = ticket.parse::<NodeTicket>().map_err(|e| e.to_string())?;
        let node_addr = ticket.node_addr().clone();

        let connection = endpoint
            .connect(node_addr, ALPN)
            .await
            .map_err(|e| e.to_string())?;

        let vault_bytes = {
            let manager = vault_manager.lock().await;
            manager.read_encrypted_vault()
        }?;

        if vault_bytes.len() as u64 > MAX_VAULT_BYTES {
            return Err("Vault file too large for sync".to_string());
        }

        let mut stream = connection
            .open_uni()
            .await
            .map_err(|e| e.to_string())?;

        stream
            .write_u64(vault_bytes.len() as u64)
            .await
            .map_err(|e| e.to_string())?;
        stream.write_all(&vault_bytes).await.map_err(|e| e.to_string())?;
        stream.finish().map_err(|e| e.to_string())?;

        Ok(())
    }
}

async fn accept_loop(endpoint: Endpoint, vault_manager: Arc<Mutex<VaultManager>>) {
    while let Some(connecting) = endpoint.accept().await {
        match connecting.await {
            Ok(connection) => {
                let vault_manager = vault_manager.clone();
                tokio::spawn(async move {
                    if let Err(err) = handle_connection(connection, vault_manager).await {
                        tracing::warn!("sync receive failed: {}", err);
                    }
                });
            }
            Err(err) => {
                tracing::warn!("sync connection failed: {}", err);
            }
        }
    }
}

async fn handle_connection(
    connection: iroh::endpoint::Connection,
    vault_manager: Arc<Mutex<VaultManager>>,
) -> Result<(), String> {
    let mut stream = connection
        .accept_uni()
        .await
        .map_err(|e| e.to_string())?;

    let size = stream.read_u64().await.map_err(|e| e.to_string())?;
    if size == 0 || size > MAX_VAULT_BYTES {
        return Err("Invalid vault size received".to_string());
    }

    let mut buffer = vec![0u8; size as usize];
    stream.read_exact(&mut buffer).await.map_err(|e| e.to_string())?;

    let mut manager = vault_manager.lock().await;
    manager.overwrite_vault_file(&buffer)?;
    Ok(())
}
