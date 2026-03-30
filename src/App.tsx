import { useState, useEffect } from 'react';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import StoryView from './components/StoryView';
import ActionsPage from './components/ActionsPage';
import SettingsPage from './components/SettingsPage';
import { LogProvider, useLogger } from './context/LogContext';
import LogConsole from './components/LogConsole';

type NavPage = 'dashboard' | 'actions' | 'settings';

function AppContent() {
  const [tenant, setTenant] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [storyContext, setStoryContext] = useState<{ storyId: number, mode: 'live' | 'test' | 'draft', draftId?: number } | null>(null);
  const [navPage, setNavPage] = useState<NavPage>('dashboard');
  const [focusActionId, setFocusActionId] = useState<number | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { setConsoleOpen, addLog } = useLogger();

  useEffect(() => {
    // Session restores could go here if we tracked last logged in securely
  }, []);

  const handleLogin = (domain: string, key: string) => {
    addLog('SUCCESS', `Authenticated user via profile`);
    setTenant(domain);
    setApiKey(key);
    setStoryContext(null);
  };

  const handleLogout = () => {
    addLog('INFO', 'User disconnected from tenant');
    setTenant(null);
    setApiKey(null);
    setStoryContext(null);
  };

  const handleNavDashboard = () => { setNavPage('dashboard'); setStoryContext(null); setFocusActionId(null); };
  const handleSelectStory = (id: number, mode: 'live' | 'test' | 'draft' = 'live', draftId?: number, actionId?: number) => { 
    setNavPage('dashboard'); 
    setStoryContext({ storyId: id, mode, draftId }); 
    if (actionId) setFocusActionId(actionId);
    else setFocusActionId(null);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      <div className="app-drag-region"></div>
      
      {!tenant || !apiKey ? (
        <Login onLogin={handleLogin} />
      ) : (
        <>
            <Sidebar 
            onLogout={handleLogout} 
            onNavDashboard={handleNavDashboard} 
            onNavActions={() => { setNavPage('actions'); setStoryContext(null); }}
            onNavSettings={() => { setNavPage('settings'); setStoryContext(null); }}
            activePage={navPage}
            tenant={tenant} 
            collapsed={sidebarCollapsed} 
            onToggleCollapse={() => setSidebarCollapsed(c => !c)} 
          />
          {storyContext ? (
            <StoryView 
              tenant={tenant} 
              apiKey={apiKey} 
              storyContext={storyContext} 
              focusActionId={focusActionId} 
              onBack={handleNavDashboard} 
            />
          ) : navPage === 'actions' ? (
            <ActionsPage tenant={tenant} apiKey={apiKey} onSelectStory={handleSelectStory} />
          ) : navPage === 'settings' ? (
            <SettingsPage tenant={tenant} apiKey={apiKey} />
          ) : (
            <Dashboard tenant={tenant} apiKey={apiKey} onSelectStory={handleSelectStory} />
          )}
        </>
      )}

      {/* Floating Terminal Trigger - only relevant during story debugging */}
      {storyContext && (
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
      )}

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
