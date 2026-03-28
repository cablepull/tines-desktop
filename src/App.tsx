import { useState, useEffect } from 'react';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import StoryView from './components/StoryView';
import { LogProvider, useLogger } from './context/LogContext';
import LogConsole from './components/LogConsole';

function AppContent() {
  const [tenant, setTenant] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [selectedStoryId, setSelectedStoryId] = useState<number | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { setConsoleOpen, addLog } = useLogger();

  useEffect(() => {
    // Session restores could go here if we tracked last logged in securely
  }, []);

  const handleLogin = (domain: string, key: string) => {
    addLog('SUCCESS', `Authenticated user via profile`);
    setTenant(domain);
    setApiKey(key);
    setSelectedStoryId(null);
  };

  const handleLogout = () => {
    addLog('INFO', 'User disconnected from tenant');
    setTenant(null);
    setApiKey(null);
    setSelectedStoryId(null);
  };

  const handleNavDashboard = () => setSelectedStoryId(null);

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      <div className="app-drag-region"></div>
      
      {!tenant || !apiKey ? (
        <Login onLogin={handleLogin} />
      ) : (
        <>
          <Sidebar onLogout={handleLogout} onNavDashboard={handleNavDashboard} tenant={tenant} collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(c => !c)} />
          {selectedStoryId ? (
            <StoryView tenant={tenant} apiKey={apiKey} storyId={selectedStoryId} onBack={handleNavDashboard} />
          ) : (
            <Dashboard tenant={tenant} apiKey={apiKey} onSelectStory={setSelectedStoryId} />
          )}
        </>
      )}

      {/* Floating Terminal Trigger */}
      <button 
        onClick={() => setConsoleOpen(true)}
        className="btn-glass"
        style={{
          position: 'fixed', bottom: '1.5rem', right: '1.5rem',
          padding: '0.5rem 1rem', borderRadius: '24px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)', fontSize: '0.8rem',
          display: 'flex', gap: '0.5rem', alignItems: 'center', zIndex: 9000
        }}
      >
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success-color)' }} />
        Terminal
      </button>

      <LogConsole />
    </div>
  );
}

export default function App() {
  return (
    <LogProvider>
      <AppContent />
    </LogProvider>
  );
}
