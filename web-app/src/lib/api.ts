import { invoke } from '@tauri-apps/api/core';
import { PasswordEntry, Vault } from '../types';

export const api = {
    createVault: async (path: string, masterPassword: string): Promise<void> => {
        return invoke('create_vault', { path, masterPassword });
    },

    loadVault: async (path: string, masterPassword: string): Promise<Vault> => {
        return invoke('load_vault', { path, masterPassword });
    },

    getVault: async (): Promise<Vault> => {
        return invoke('get_vault');
    },

    saveEntry: async (entry: PasswordEntry): Promise<Vault> => {
        return invoke('save_entry', { entry });
    },

    deleteEntry: async (id: string): Promise<Vault> => {
        return invoke('delete_entry', { id });
    },

    syncGetTicket: async (): Promise<string> => {
        return invoke('sync_get_ticket');
    },

    syncSend: async (ticket: string): Promise<void> => {
        return invoke('sync_send', { ticket });
    }
};
