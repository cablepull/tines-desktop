/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';

interface Profile {
  name: string;
  tenant: string;
  apiKey: string;
}

interface LoginProps {
  onLogin: (tenant: string, apiKey: string) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>('new');
  
  // New profile form state
  const [profileName, setProfileName] = useState('');
  const [tenant, setTenant] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadProfiles = async () => {
      try {
        if ((window as any).electronAPI) {
          const stored = await (window as any).electronAPI.getProfiles();
          setProfiles(stored);
          if (stored.length > 0) {
            setSelectedProfile(stored[0].name);
          }
        }
      } catch (err) {
        console.error('Failed to load profiles', err);
      }
    };
    loadProfiles();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    let activeTenant = tenant;
    let activeKey = apiKey;

    if (selectedProfile === 'new') {
      const newProfile = { name: profileName, tenant, apiKey };
      if ((window as any).electronAPI) {
        await (window as any).electronAPI.saveProfile(newProfile);
      }
    } else {
      const existing = profiles.find(p => p.name === selectedProfile);
      if (existing) {
        activeTenant = existing.tenant;
        activeKey = existing.apiKey;
      }
    }

    setTimeout(() => {
      onLogin(activeTenant, activeKey);
      setLoading(false);
    }, 400);
  };

  const handleDelete = async (name: string) => {
    if ((window as any).electronAPI) {
      const updated = await (window as any).electronAPI.deleteProfile(name);
      setProfiles(updated);
      if (updated.length > 0) setSelectedProfile(updated[0].name);
      else setSelectedProfile('new');
    } else {
      const updated = profiles.filter(p => p.name !== name);
      setProfiles(updated);
      setSelectedProfile('new');
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div className="glass-panel" style={{ padding: '3rem', maxWidth: '440px', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.5s ease' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: 0 }}>Tines Workspace</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.95rem' }}>
            Select a saved profile or connect a new tenant.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
              PROFILE
            </label>
            <select 
              value={selectedProfile} 
              onChange={(e) => setSelectedProfile(e.target.value)}
              style={{
                width: '100%', background: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--glass-border)',
                padding: '0.75rem 1rem', borderRadius: '8px', color: 'var(--text-primary)',
                fontFamily: 'inherit', outline: 'none'
              }}
            >
              {profiles.map(p => (
                <option key={p.name} value={p.name} style={{ background: '#1A2235' }}>{p.name}</option>
              ))}
              <option value="new" style={{ background: '#1A2235' }}>+ Add New Profile...</option>
            </select>
          </div>

          {selectedProfile === 'new' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', animation: 'fadeIn 0.3s ease' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>PROFILE NAME</label>
                <input required type="text" placeholder="e.g. Production Env" value={profileName} onChange={(e) => setProfileName(e.target.value)} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>TENANT DOMAIN</label>
                <input required type="text" placeholder="e.g. your-tenant.tines.com" value={tenant} onChange={(e) => setTenant(e.target.value)} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>API KEY / X-USER-TOKEN</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input required type={showApiKey ? 'text' : 'password'} placeholder="sk_..." value={apiKey} onChange={(e) => setApiKey(e.target.value)} style={{ paddingRight: '4rem' }} />
                  <button type="button" onClick={() => setShowApiKey(!showApiKey)} style={{ position: 'absolute', right: '0.75rem', background: 'transparent', border: 'none', color: 'var(--accent-hover)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', padding: '0.25rem' }}>
                    {showApiKey ? 'HIDE' : 'SHOW'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={loading}>
              {loading ? 'Connecting...' : (selectedProfile === 'new' ? 'Save & Connect' : 'Connect')}
            </button>
            
            {selectedProfile !== 'new' && (
              <button type="button" className="btn-glass" onClick={() => handleDelete(selectedProfile)} style={{ color: 'var(--danger-color)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                Delete
              </button>
            )}
          </div>
        </form>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
