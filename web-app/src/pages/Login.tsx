import { useState } from 'react';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { open, save } from '@tauri-apps/plugin-dialog';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/ui/use-toast';

export default function Login() {
    const [path, setPath] = useState('');
    const [password, setPassword] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { toast } = useToast();

    const handleSelectFile = async () => {
        try {
            const selected = await (isCreating ? save({
                filters: [{ name: 'Vault', extensions: ['vault'] }]
            }) : open({
                multiple: false,
                filters: [{ name: 'Vault', extensions: ['vault'] }]
            }));

            if (selected) {
                setPath(selected as string);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (isCreating) {
                await api.createVault(path, password);
                toast({ title: "Success", description: "Vault created successfully" });
                // Automatically log in? or ask to log in?
                // Let's just create and then we are "logged in" if we store state? 
                // Currently API loads vault into backend memory.
                // So creating it assumes we want to use it? 
                // The backend `create_vault` creates it on disk. It loads it?
                // Let's check `create_vault` in backend.
                // It calls `save_vault` which sets `self.master_key` etc. So yes, it loads it.
                navigate('/dashboard');
            } else {
                await api.loadVault(path, password);
                navigate('/dashboard');
            }
        } catch (error) {
            toast({
                title: "Error",
                description: String(error),
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen oa-shell flex items-center justify-center px-8 py-12">
            <Card className="w-full max-w-md oa-panel shadow-none">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl font-semibold tracking-tight">SafeKey</CardTitle>
                    <CardDescription className="oa-muted">Open your vault in seconds.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs
                        defaultValue="open"
                        onValueChange={(value) => setIsCreating(value === 'create')}
                        className="w-full"
                    >
                        <TabsList className="grid grid-cols-2 w-full oa-panel-soft shadow-none">
                            <TabsTrigger value="open">Open</TabsTrigger>
                            <TabsTrigger value="create">Create</TabsTrigger>
                        </TabsList>
                        <TabsContent value="open" className="mt-4">
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="path">Vault File</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            id="path"
                                            value={path}
                                            readOnly
                                            placeholder="Select a vault file..."
                                            onClick={handleSelectFile}
                                            className="cursor-pointer oa-input"
                                        />
                                        <Button type="button" variant="outline" onClick={handleSelectFile} className="oa-btn oa-btn-outline">
                                            Browse
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="password">Master Password</Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="oa-input"
                                    />
                                </div>
                                <Button type="submit" className="w-full oa-btn" disabled={loading || !path || !password}>
                                    {loading ? "Opening..." : "Open Vault"}
                                </Button>
                            </form>
                        </TabsContent>
                        <TabsContent value="create" className="mt-4">
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="path-create">Save Location</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            id="path-create"
                                            value={path}
                                            readOnly
                                            placeholder="Choose where to save..."
                                            onClick={handleSelectFile}
                                            className="cursor-pointer oa-input"
                                        />
                                        <Button type="button" variant="outline" onClick={handleSelectFile} className="oa-btn oa-btn-outline">
                                            Browse
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="password-create">Master Password</Label>
                                    <Input
                                        id="password-create"
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="oa-input"
                                    />
                                </div>
                                <Button type="submit" className="w-full oa-btn" disabled={loading || !path || !password}>
                                    {loading ? "Creating..." : "Create Vault"}
                                </Button>
                            </form>
                        </TabsContent>
                    </Tabs>
                </CardContent>
                <CardFooter className="text-xs oa-muted">
                    Your master password never leaves this device.
                </CardFooter>
            </Card>
        </div>
    );
}
