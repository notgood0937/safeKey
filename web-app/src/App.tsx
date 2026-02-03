import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TitleBar } from './components/TitleBar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { ToastProvider } from './components/ui/toast';

export default function App() {
    return (
        <ToastProvider>
            <TitleBar />
            <div className="pt-8 h-screen box-border overflow-hidden">
                <HashRouter>
                    <Routes>
                        <Route path="/" element={<Navigate to="/login" replace />} />
                        <Route path="/login" element={<Login />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                    </Routes>
                </HashRouter>
            </div>
        </ToastProvider>
    );
}
