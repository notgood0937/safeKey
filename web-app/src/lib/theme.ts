import type { AppTheme } from '../types/app';

const STORAGE_KEY = 'safekey.theme';

function prefersDark(): boolean {
	if (typeof window === 'undefined' || !window.matchMedia) return false;
	return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function getStoredTheme(): AppTheme {
	const stored = localStorage.getItem(STORAGE_KEY) as AppTheme | null;
	if (stored === 'light' || stored === 'dark' || stored === 'auto') return stored;
	return 'auto';
}

export function applyTheme(theme: AppTheme): void {
	const root = document.documentElement;
	const isDark = theme === 'dark' || (theme === 'auto' && prefersDark());
	root.classList.toggle('dark', isDark);
}

export function setTheme(theme: AppTheme): void {
	localStorage.setItem(STORAGE_KEY, theme);
	applyTheme(theme);
}

export function initializeTheme(): AppTheme {
	const theme = getStoredTheme();
	applyTheme(theme);
	return theme;
}
