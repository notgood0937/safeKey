use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use chrono::{DateTime, Utc};
use hmac::Hmac;
use pbkdf2::pbkdf2;
use rand::{rngs::OsRng, RngCore};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::fs;
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PasswordEntry {
    pub id: String,
    pub site: String,
    pub username: String,
    pub password: String,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct Vault {
    pub entries: Vec<PasswordEntry>,
}

pub struct VaultManager {
    db_path: Option<PathBuf>,
    master_key: Option<[u8; 32]>,
    salt: Option<[u8; 16]>,
    conn: Option<Connection>,
}

impl VaultManager {
    pub fn new() -> Self {
        Self {
            db_path: None,
            master_key: None,
            salt: None,
            conn: None,
        }
    }

    /// Derives a 32-byte key from the master password using PBKDF2
    fn derive_key(password: &str, salt: &[u8]) -> [u8; 32] {
        let mut key = [0u8; 32];
        pbkdf2::<Hmac<Sha256>>(password.as_bytes(), salt, 600_000, &mut key)
            .expect("HMAC can be initialized with any key length");
        key
    }

    pub fn create_vault(&mut self, path: PathBuf, master_password: &str) -> Result<(), String> {
        let mut salt = [0u8; 16];
        OsRng.fill_bytes(&mut salt);

        let key = Self::derive_key(master_password, &salt);
        let conn = Self::open_db(&path)?;
        Self::init_schema(&conn)?;
        Self::write_meta(&conn, &salt, &key)?;

        self.master_key = Some(key);
        self.salt = Some(salt);
        self.db_path = Some(path);
        self.conn = Some(conn);
        Ok(())
    }

    pub fn load_vault(&mut self, path: PathBuf, master_password: &str) -> Result<Vault, String> {
        if !path.exists() {
            return Err("Vault file does not exist".to_string());
        }

        let conn = Self::open_db(&path)?;
        let salt = Self::read_salt(&conn)?;
        let key = Self::derive_key(master_password, &salt);
        Self::verify_master_key(&conn, &key)?;

        self.master_key = Some(key);
        self.salt = Some(salt);
        self.db_path = Some(path);
        self.conn = Some(conn);

        self.get_vault().ok_or("Vault not loaded".to_string())
    }

    pub fn get_vault(&self) -> Option<Vault> {
        let conn = self.conn.as_ref()?;
        let key = self.master_key.as_ref()?;

        let mut stmt = conn
            .prepare(
                "SELECT id, nonce, data, created_at, updated_at FROM entries ORDER BY updated_at DESC",
            )
            .ok()?;

        let rows = stmt
            .query_map([], |row| {
                let id: String = row.get(0)?;
                let nonce: Vec<u8> = row.get(1)?;
                let data: Vec<u8> = row.get(2)?;
                let created_at: String = row.get(3)?;
                let updated_at: String = row.get(4)?;
                Ok((id, nonce, data, created_at, updated_at))
            })
            .ok()?;

        let mut entries = Vec::new();
        for row in rows.flatten() {
            let (id, nonce, data, created_at, updated_at) = row;
            if let Ok(entry) = Self::decrypt_entry(key, &id, &nonce, &data, &created_at, &updated_at)
            {
                entries.push(entry);
            }
        }

        Some(Vault { entries })
    }

    pub fn add_or_update_entry(&mut self, entry: PasswordEntry) -> Result<(), String> {
        let conn = self.conn.as_ref().ok_or("Vault not loaded")?;
        let key = self.master_key.as_ref().ok_or("Vault not unlocked")?;

        let (nonce, data) = Self::encrypt_entry(key, &entry)?;

        conn.execute(
            "INSERT INTO entries (id, nonce, data, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(id) DO UPDATE SET
                nonce = excluded.nonce,
                data = excluded.data,
                created_at = excluded.created_at,
                updated_at = excluded.updated_at",
            params![
                entry.id,
                nonce,
                data,
                entry.created_at.to_rfc3339(),
                entry.updated_at.to_rfc3339()
            ],
        )
        .map_err(|e| e.to_string())?;

        Ok(())
    }

    pub fn delete_entry(&mut self, id: &str) -> Result<(), String> {
        let conn = self.conn.as_ref().ok_or("Vault not loaded")?;
        conn.execute("DELETE FROM entries WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn read_encrypted_vault(&self) -> Result<Vec<u8>, String> {
        let path = self.db_path.as_ref().ok_or("Vault path not set")?;
        fs::read(path).map_err(|e| e.to_string())
    }

    pub fn overwrite_vault_file(&mut self, bytes: &[u8]) -> Result<(), String> {
        let path = self.db_path.as_ref().ok_or("Vault path not set")?;
        fs::write(path, bytes).map_err(|e| e.to_string())?;
        self.master_key = None;
        self.salt = None;
        self.conn = None;
        Ok(())
    }

    fn open_db(path: &PathBuf) -> Result<Connection, String> {
        Connection::open(path).map_err(|e| e.to_string())
    }

    fn init_schema(conn: &Connection) -> Result<(), String> {
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS meta (
                key TEXT PRIMARY KEY,
                value BLOB NOT NULL
            );
            CREATE TABLE IF NOT EXISTS entries (
                id TEXT PRIMARY KEY,
                nonce BLOB NOT NULL,
                data BLOB NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );",
        )
        .map_err(|e| e.to_string())
    }

    fn write_meta(conn: &Connection, salt: &[u8; 16], key: &[u8; 32]) -> Result<(), String> {
        let (nonce, ciphertext) = Self::encrypt_bytes(key, b"safekey-check")?;
        conn.execute(
            "INSERT OR REPLACE INTO meta (key, value) VALUES (?1, ?2)",
            params!["salt", salt.to_vec()],
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT OR REPLACE INTO meta (key, value) VALUES (?1, ?2)",
            params!["check_nonce", nonce],
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT OR REPLACE INTO meta (key, value) VALUES (?1, ?2)",
            params!["check_ct", ciphertext],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    fn read_salt(conn: &Connection) -> Result<[u8; 16], String> {
        let salt: Vec<u8> = conn
            .query_row("SELECT value FROM meta WHERE key = 'salt'", [], |row| row.get(0))
            .map_err(|_| "Vault metadata missing".to_string())?;
        if salt.len() != 16 {
            return Err("Invalid salt length".to_string());
        }
        let mut out = [0u8; 16];
        out.copy_from_slice(&salt);
        Ok(out)
    }

    fn verify_master_key(conn: &Connection, key: &[u8; 32]) -> Result<(), String> {
        let nonce: Vec<u8> = conn
            .query_row("SELECT value FROM meta WHERE key = 'check_nonce'", [], |row| row.get(0))
            .map_err(|_| "Vault metadata missing".to_string())?;
        let ct: Vec<u8> = conn
            .query_row("SELECT value FROM meta WHERE key = 'check_ct'", [], |row| row.get(0))
            .map_err(|_| "Vault metadata missing".to_string())?;
        let plaintext =
            Self::decrypt_bytes(key, &nonce, &ct).map_err(|_| "Invalid Password or Corrupted Vault".to_string())?;
        if plaintext != b"safekey-check" {
            return Err("Invalid Password or Corrupted Vault".to_string());
        }
        Ok(())
    }

    fn encrypt_bytes(key: &[u8; 32], plaintext: &[u8]) -> Result<(Vec<u8>, Vec<u8>), String> {
        let cipher = Aes256Gcm::new(key.into());
        let mut nonce_bytes = [0u8; 12];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);
        let ciphertext = cipher.encrypt(nonce, plaintext).map_err(|e| e.to_string())?;
        Ok((nonce_bytes.to_vec(), ciphertext))
    }

    fn decrypt_bytes(key: &[u8; 32], nonce: &[u8], ciphertext: &[u8]) -> Result<Vec<u8>, String> {
        let cipher = Aes256Gcm::new(key.into());
        let nonce = Nonce::from_slice(nonce);
        cipher.decrypt(nonce, ciphertext).map_err(|_| "Decrypt failed".to_string())
    }

    fn encrypt_entry(key: &[u8; 32], entry: &PasswordEntry) -> Result<(Vec<u8>, Vec<u8>), String> {
        let payload = EntryPayload {
            site: entry.site.clone(),
            username: entry.username.clone(),
            password: entry.password.clone(),
            notes: entry.notes.clone(),
        };
        let plaintext = serde_json::to_vec(&payload).map_err(|e| e.to_string())?;
        Self::encrypt_bytes(key, &plaintext)
    }

    fn decrypt_entry(
        key: &[u8; 32],
        id: &str,
        nonce: &[u8],
        data: &[u8],
        created_at: &str,
        updated_at: &str,
    ) -> Result<PasswordEntry, String> {
        let plaintext = Self::decrypt_bytes(key, nonce, data)?;
        let payload: EntryPayload = serde_json::from_slice(&plaintext).map_err(|e| e.to_string())?;
        let created_at = DateTime::parse_from_rfc3339(created_at)
            .map_err(|e| e.to_string())?
            .with_timezone(&Utc);
        let updated_at = DateTime::parse_from_rfc3339(updated_at)
            .map_err(|e| e.to_string())?
            .with_timezone(&Utc);
        Ok(PasswordEntry {
            id: id.to_string(),
            site: payload.site,
            username: payload.username,
            password: payload.password,
            notes: payload.notes,
            created_at,
            updated_at,
        })
    }
}

#[derive(Serialize, Deserialize)]
struct EntryPayload {
    site: String,
    username: String,
    password: String,
    notes: Option<String>,
}
