import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { PasswordEntry, Vault } from '../types';
import { Button, buttonVariants } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Plus, Search, Copy, Trash2, Edit, RefreshCw, Sun, Moon, Laptop2, KeyRound } from 'lucide-react';
import { useToast } from '../components/ui/use-toast';
import { Label } from '../components/ui/label';
import { getStoredTheme, setTheme } from '../lib/theme';
import type { AppTheme } from '../types/app';

export default function Dashboard() {
    const [vault, setVault] = useState<Vault | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSyncOpen, setIsSyncOpen] = useState(false);
    const [currentEntry, setCurrentEntry] = useState<Partial<PasswordEntry>>({});
    const [syncTicket, setSyncTicket] = useState('');
    const [peerTicket, setPeerTicket] = useState('');
    const [syncBusy, setSyncBusy] = useState(false);
    const [theme, setThemeValue] = useState<AppTheme>('auto');
    const { toast } = useToast();

    // Initial dummy load or fetch? 
    // Since we don't have a way to check if vault is loaded in backend easily without keeping state in frontend or trying to load...
    // But Login page navigated here after successful load.
    // We should implement a "get_vault" command or similar, OR just rely on local state if we had it.
    // But we don't have global state management (removed zustand store).
    // So we need to fetch the vault from backend.
    // I need to add `get_vault` to backend commands!
    // I added `get_vault` to `VaultManager` but NOT to `commands.rs`.
    // I need to add `get_vault` command to backend.

    useEffect(() => {
        refreshVault();
    }, []);

    useEffect(() => {
        setThemeValue(getStoredTheme());
    }, []);

    const refreshVault = async () => {
        try {
            const v = await api.getVault();
            setVault(v);
        } catch (error) {
            console.error(error);
            toast({ title: "Error loading vault", description: String(error), variant: "destructive" });
        }
    };

    const handleSave = async () => {
        try {
            const entry = {
                ...currentEntry,
                id: currentEntry.id || crypto.randomUUID(),
                created_at: currentEntry.created_at || new Date().toISOString(),
                updated_at: new Date().toISOString(),
            } as PasswordEntry;

            await api.saveEntry(entry);
            setIsDialogOpen(false);
            setCurrentEntry({});
            refreshVault();
            toast({ title: "Success", description: "Password saved successfully" });
        } catch (error) {
            toast({ title: "Error saving", description: String(error), variant: "destructive" });
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure?")) return;
        try {
            await api.deleteEntry(id);
            refreshVault();
            toast({ title: "Deleted", description: "Entry deleted" });
        } catch (error) {
            toast({ title: "Error deleting", description: String(error), variant: "destructive" });
        }
    };

    const handleGenerateTicket = async () => {
        try {
            setSyncBusy(true);
            const ticket = await api.syncGetTicket();
            setSyncTicket(ticket);
            toast({ title: "Sync Ready", description: "Ticket generated. Share it with your other device." });
        } catch (error) {
            toast({ title: "Sync Error", description: String(error), variant: "destructive" });
        } finally {
            setSyncBusy(false);
        }
    };

    const handleSendSync = async () => {
        if (!peerTicket.trim()) {
            toast({ title: "Missing Ticket", description: "Paste a peer ticket first.", variant: "destructive" });
            return;
        }
        try {
            setSyncBusy(true);
            await api.syncSend(peerTicket.trim());
            toast({ title: "Sync Sent", description: "Vault sent to peer. Ask them to unlock to refresh." });
        } catch (error) {
            toast({ title: "Sync Error", description: String(error), variant: "destructive" });
        } finally {
            setSyncBusy(false);
        }
    };

    const filteredEntries = vault?.entries.filter(e =>
        e.site.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.username.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

    return (
        <div className="h-screen notes-shell overflow-hidden">
            <main className="h-full overflow-auto">
                <div className="max-w-6xl mx-auto px-10 py-10">
                    <div className="grid gap-6 md:grid-cols-[220px_1fr]">
                        <aside className="notes-sidebar p-4">
                            <div className="text-xs uppercase tracking-wide oa-muted">Folders</div>
                            <div className="mt-3 space-y-1">
                                <Button variant="ghost" className="w-full justify-start oa-btn-ghost h-9">
                                    All
                                </Button>
                                <Button variant="ghost" className="w-full justify-start oa-btn-ghost h-9">
                                    Favorites
                                </Button>
                                <Button variant="ghost" className="w-full justify-start oa-btn-ghost h-9">
                                    Recently Added
                                </Button>
                            </div>
                            <div className="oa-divider my-4" />
                            <div className="text-xs uppercase tracking-wide oa-muted">Tags</div>
                            <div className="mt-2 flex flex-wrap gap-2">
                                <span className="oa-chip">Work</span>
                                <span className="oa-chip">Personal</span>
                                <span className="oa-chip">Finance</span>
                            </div>
                        </aside>
                        <section className="notes-list p-4">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <h1 className="text-2xl font-semibold tracking-tight">Passwords</h1>
                                    <p className="text-sm oa-muted">Everything in one place, fast to find.</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="oa-panel-soft px-1 py-1 flex items-center gap-1">
                                        <Button
                                            variant="ghost"
                                            onClick={() => {
                                                setTheme('auto');
                                                setThemeValue('auto');
                                            }}
                                            className={`h-8 rounded-md px-2 ${theme === 'auto' ? 'bg-accent' : ''}`}
                                            aria-label="Auto theme"
                                        >
                                            <Laptop2 className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            onClick={() => {
                                                setTheme('light');
                                                setThemeValue('light');
                                            }}
                                            className={`h-8 rounded-md px-2 ${theme === 'light' ? 'bg-accent' : ''}`}
                                            aria-label="Light theme"
                                        >
                                            <Sun className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            onClick={() => {
                                                setTheme('dark');
                                                setThemeValue('dark');
                                            }}
                                            className={`h-8 rounded-md px-2 ${theme === 'dark' ? 'bg-accent' : ''}`}
                                            aria-label="Dark theme"
                                        >
                                            <Moon className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <Dialog open={isSyncOpen} onOpenChange={setIsSyncOpen}>
                                        <DialogTrigger className={buttonVariants({ variant: 'outline', className: 'oa-btn oa-btn-outline' })}>
                                            <RefreshCw className="mr-2 h-4 w-4" /> Sync
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-lg rounded-xl border border-border bg-background p-6 shadow-none">
                                            <DialogHeader>
                                                <DialogTitle>Device Sync</DialogTitle>
                                            </DialogHeader>
                                            <div className="grid gap-4">
                                                <div className="grid gap-2">
                                                    <Label htmlFor="sync-ticket">Your Ticket</Label>
                                                    <div className="flex gap-2">
                                                        <Input
                                                            id="sync-ticket"
                                                            value={syncTicket}
                                                            readOnly
                                                            placeholder="Generate a ticket to share"
                                                            className="oa-input"
                                                        />
                                                        <Button
                                                            variant="outline"
                                                            onClick={handleGenerateTicket}
                                                            disabled={syncBusy}
                                                            className="oa-btn oa-btn-outline"
                                                        >
                                                            Generate
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            onClick={() => {
                                                                if (syncTicket) {
                                                                    navigator.clipboard.writeText(syncTicket);
                                                                    toast({ title: "Copied", description: "Ticket copied to clipboard" });
                                                                }
                                                            }}
                                                            disabled={!syncTicket}
                                                            className="oa-btn oa-btn-ghost"
                                                        >
                                                            Copy
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label htmlFor="peer-ticket">Peer Ticket</Label>
                                                    <Input
                                                        id="peer-ticket"
                                                        value={peerTicket}
                                                        onChange={(e) => setPeerTicket(e.target.value)}
                                                        placeholder="Paste peer ticket here"
                                                        className="oa-input"
                                                    />
                                                </div>
                                                <DialogFooter className="flex items-center justify-between gap-3">
                                                    <span className="text-xs oa-muted">
                                                        Receiver unlocks to refresh.
                                                    </span>
                                                    <Button onClick={handleSendSync} disabled={syncBusy} className="oa-btn">
                                                        Send
                                                    </Button>
                                                </DialogFooter>
                                            </div>
                                        </DialogContent>
                                    </Dialog>
                                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                                        <DialogTrigger className={buttonVariants({ className: 'oa-btn' })} onClick={() => setCurrentEntry({})}>
                                            <Plus className="mr-2 h-4 w-4" /> Add
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-lg rounded-xl border border-border bg-background p-6 shadow-none">
                                            <DialogHeader>
                                                <DialogTitle>{currentEntry.id ? "Edit Password" : "Add Password"}</DialogTitle>
                                            </DialogHeader>
                                            <div className="grid gap-4 py-4">
                                                <div className="grid gap-2">
                                                    <Label htmlFor="site">Site/Name</Label>
                                                    <Input
                                                        id="site"
                                                        value={currentEntry.site || ''}
                                                        onChange={e => setCurrentEntry({ ...currentEntry, site: e.target.value })}
                                                        className="oa-input"
                                                    />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label htmlFor="username">Username</Label>
                                                    <Input
                                                        id="username"
                                                        value={currentEntry.username || ''}
                                                        onChange={e => setCurrentEntry({ ...currentEntry, username: e.target.value })}
                                                        className="oa-input"
                                                    />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label htmlFor="password">Password</Label>
                                                    <Input
                                                        id="password"
                                                        type="text"
                                                        value={currentEntry.password || ''}
                                                        onChange={e => setCurrentEntry({ ...currentEntry, password: e.target.value })}
                                                        className="oa-input"
                                                    />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label htmlFor="notes">Notes</Label>
                                                    <Input
                                                        id="notes"
                                                        value={currentEntry.notes || ''}
                                                        onChange={e => setCurrentEntry({ ...currentEntry, notes: e.target.value })}
                                                        className="oa-input"
                                                    />
                                                </div>
                                            </div>
                                            <DialogFooter>
                                                <Button onClick={handleSave} className="oa-btn">Save</Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                </div>
                            </div>
                            <div className="relative mt-4">
                                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by site or username..."
                                    className="pl-9 oa-input"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="oa-divider my-4" />
                            <div className="notes-list p-3">
                                {filteredEntries.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-14 text-center">
                                        <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background">
                                            <KeyRound className="h-5 w-5 text-muted-foreground" />
                                        </div>
                                        <div className="text-sm font-medium">No passwords yet</div>
                                        <div className="text-xs oa-muted mt-1">Click “Add” to create your first entry.</div>
                                    </div>
                                )}
                                <div className="grid gap-3">
                                    {filteredEntries.map((entry) => (
                                        <div key={entry.id} className="notes-card px-4 py-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="text-sm font-semibold truncate">{entry.site}</div>
                                                    <div className="text-xs oa-muted truncate">{entry.username}</div>
                                                </div>
                                                <div className="notes-actions flex items-center gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="oa-btn-ghost h-8 w-8"
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(entry.password);
                                                            toast({ title: "Copied", description: "Password copied to clipboard" });
                                                        }}
                                                        aria-label="Copy password"
                                                    >
                                                        <Copy className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="oa-btn-ghost h-8 w-8"
                                                        onClick={() => {
                                                            setCurrentEntry(entry);
                                                            setIsDialogOpen(true);
                                                        }}
                                                        aria-label="Edit entry"
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="oa-btn-ghost h-8 w-8 text-red-500"
                                                        onClick={() => handleDelete(entry.id)}
                                                        aria-label="Delete entry"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            </main>
        </div>
    );
}
