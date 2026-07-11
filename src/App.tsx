import { BrowserRouter, Routes, Route } from 'react-router-dom';
import RootLayout from './layouts/RootLayout';
import Home from './pages/Home';
import Chat from './pages/Chat';
import Chunks from './pages/Chunks';
import Vault from './pages/Vault';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './components/Login';
import { Loader2 } from 'lucide-react';

function AppContent() {
  const { isLoggedIn, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-[#0b1120] text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-2" />
        <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading Pipeline...</span>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Login />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootLayout />}>
          <Route index element={<Home />} />
          <Route path="chat" element={<Chat />} />
          <Route path="chunks" element={<Chunks />} />
          <Route path="vault" element={<Vault />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
