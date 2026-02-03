export interface PasswordEntry {
    id: string;
    site: string;
    username: string;
    password: string;
    notes?: string;
    created_at: string;
    updated_at: string;
}

export interface Vault {
    entries: PasswordEntry[];
}
