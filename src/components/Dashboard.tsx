/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useMemo } from 'react';
import { Configuration, StoriesApi, ActionsApi } from 'tines-sdk';
import type { Story } from 'tines-sdk';
import { useLogger } from '../context/LogContext';

interface DashboardProps {
  tenant: string;
  apiKey: string;
  onSelectStory: (id: number) => void;
}

export default function Dashboard({ tenant, apiKey, onSelectStory }: DashboardProps) {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Create Story Form State
  const [newStoryName, setNewStoryName] = useState('');
  const [creatingStory, setCreatingStory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { addLog } = useLogger();

  // Initialize the native generated TS SDK client
  const storiesApi = useMemo(() => {
    const basePath = tenant.startsWith('http') ? tenant : `https://${tenant}`;
    const config = new Configuration({ basePath, apiKey });
    return new StoriesApi(config);
  }, [tenant, apiKey]);

  useEffect(() => {
    const basePath = tenant.startsWith('http') ? tenant : `https://${tenant}`;
    const maskedKey = '*'.repeat(Math.max(0, apiKey.length - 3)) + apiKey.slice(-3);
    addLog('INFO', `Initializing Tines SDK`, { host: basePath, key: maskedKey });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant, apiKey]);

  const fetchStories = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      addLog('NETWORK', `Fetching up to 12 stories from tenant...`);
      const res: any = await storiesApi.listStories({ teamId: 1, perPage: 12 });
      const rawStories = res.stories ? res.stories : (Array.isArray(res) ? res : []);
      setStories(rawStories);
      addLog('SUCCESS', `Successfully fetched ${rawStories.length} stories`);
    } catch (err: any) {
      console.error(err);
      const msg = err.message || 'Failed to fetch stories.';
      setError(msg);
      addLog('ERROR', 'API Request Error', { error: msg });
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchStories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storiesApi]);

  const handleCreateStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoryName) return;
    setCreatingStory(true);
    addLog('NETWORK', `Creating new Workspace Story: ${newStoryName}`);
    try {
      const basePath = tenant.startsWith('http') ? tenant : `https://${tenant}`;
      const teamsRes = await fetch(`${basePath}/api/v1/teams`, { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } });
      let teamId = undefined;
      if (teamsRes.ok) {
         const tData = await teamsRes.json();
         teamId = (tData.teams && tData.teams[0]?.id) || (Array.isArray(tData) && tData[0]?.id) || undefined;
      }
      
      const payload: any = { name: newStoryName };
      if (teamId) payload.teamId = teamId;

      await storiesApi.createStory({
        storyCreateRequest: payload
      });
      addLog('SUCCESS', `Created Story ${newStoryName} successfully`);
      setNewStoryName('');
      fetchStories(true);
    } catch (err: any) {
      addLog('ERROR', 'Failed to create story', { error: err.message });
    } finally {
      setCreatingStory(false);
    }
  };

  const handleScaffoldTemplate = async () => {
    setCreatingStory(true);
    addLog('NETWORK', 'Scaffolding Advanced Event Target logic (3 linked agents)...');
    try {
      const basePath = tenant.startsWith('http') ? tenant : `https://${tenant}`;
      const actionsApi = new ActionsApi(new Configuration({ basePath, apiKey }));

      const teamsRes = await fetch(`${basePath}/api/v1/teams`, { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } });
      let teamId = undefined;
      if (teamsRes.ok) {
         const tData = await teamsRes.json();
         teamId = (tData.teams && tData.teams[0]?.id) || (Array.isArray(tData) && tData[0]?.id) || undefined;
      }

      const payload: any = { name: 'SIEM Incident Automations' };
      if (teamId) payload.teamId = teamId;

      // 1. Scaffold Story Container
      const storyRes: any = await storiesApi.createStory({ storyCreateRequest: payload });
      const newId = storyRes.id || storyRes.story?.id;
      if (!newId) throw new Error("Missing newly created Story ID");

      // 2. Scaffold Webhook Agent
      const hookRes: any = await actionsApi.createAction({
        actionCreateRequest: { name: 'Ingest Trigger', type: 'Agents::WebhookAgent' as any, storyId: newId, position: { x: 300, y: 100 }, options: {} }
      });
      const hookId = hookRes.id || hookRes.action?.id;

      // 3. Scaffold Linked HTTP Request
      const httpRes: any = await actionsApi.createAction({
         actionCreateRequest: { name: 'Query Endpoint', type: 'Agents::HttpRequestAgent' as any, storyId: newId, position: { x: 300, y: 250 }, sourceIds: [hookId], options: {} }
      });
      const httpId = httpRes.id || httpRes.action?.id;

      // 4. Scaffold Linked Transformation
      await actionsApi.createAction({
         actionCreateRequest: { name: 'Transform Outputs', type: 'Agents::EventTransformationAgent' as any, storyId: newId, position: { x: 300, y: 400 }, sourceIds: [httpId], options: {} }
      });

      addLog('SUCCESS', 'Successfully auto-generated Advanced SIEM logic schema!');
      fetchStories(true);
    } catch (err: any) {
      addLog('ERROR', 'Template API Failed', { error: err.message });
    } finally {
      setCreatingStory(false);
    }
  };

  return (
    <div style={{ flex: 1, padding: '2rem 3rem', overflowY: 'auto' }}>
      <header style={{ marginBottom: '2.5rem', marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 600, letterSpacing: '-0.02em' }}>
            Overview
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Recent active stories in your tenant
          </p>
        </div>
        <button onClick={() => fetchStories(true)} className="btn-glass" style={{ padding: '0.75rem 1rem', fontSize: '0.85rem' }}>
          🔄 Refresh
        </button>
      </header>

      {loading && (
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', opacity: 0.7 }}>
           <div className="spinner" /> Loading your stories...
        </div>
      )}

      {error && !loading && (
        <div className="glass-panel" style={{ 
          padding: '1.5rem', 
          borderColor: 'rgba(239, 68, 68, 0.3)',
          background: 'rgba(239, 68, 68, 0.05)'
        }}>
          <h3 style={{ color: 'var(--danger-color)', marginBottom: '0.5rem' }}>Connection Failed</h3>
          <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Create Story Form */}
          <div className="glass-panel" style={{ padding: '1rem 1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', borderStyle: 'dashed' }}>
             <h3 style={{ fontSize: '1rem', fontWeight: 600, flexShrink: 0 }}>New Story</h3>
              <form onSubmit={handleCreateStory} style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
               <input required value={newStoryName} onChange={e => setNewStoryName(e.target.value)} placeholder="e.g. Okta Alert Processing..." style={{ flex: 1 }} />
               <button className="btn-primary" disabled={creatingStory} type="submit" style={{ padding: '0.75rem 1.5rem', flexShrink: 0 }}>
                 {creatingStory ? 'Working...' : '+ Blank Story'}
               </button>
               <button type="button" onClick={handleScaffoldTemplate} disabled={creatingStory} className="btn-primary" style={{ padding: '0.75rem 1.5rem', background: 'var(--success-color)', flexShrink: 0 }}>
                 {creatingStory ? 'Generatiing...' : '⚡ AI Template Workflow'}
               </button>
             </form>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
             <input 
               type="text" 
               placeholder="🔍 Search Stories..."
               value={searchQuery}
               onChange={e => setSearchQuery(e.target.value)}
               style={{
                 flex: 1, padding: '0.75rem 1rem', fontSize: '1rem',
                 background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)',
                 borderRadius: '8px', color: 'white', outline: 'none'
               }}
             />
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '1.5rem',
            animation: 'fadeIn 0.6s ease forwards'
          }}>
            {stories.filter(story => story.name?.toLowerCase().includes(searchQuery.toLowerCase())).map((story) => (
              <div key={story.id || Math.random()} onClick={() => story.id && onSelectStory(story.id)} className="glass-panel" style={{ 
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                cursor: 'pointer'
              }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                  {story.name || 'Untitled Story'}
                </h3>
                  <span style={{ 
                    fontSize: '0.75rem', 
                    padding: '0.25rem 0.5rem', 
                    background: 'rgba(59, 130, 246, 0.1)',
                    color: 'var(--accent-hover)',
                    borderRadius: '4px',
                    fontWeight: 500
                  }}>
                    {story.mode || 'LIVE'}
                  </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <span>ID: {story.id}</span>
                <span>Team: {story.teamId}</span>
              </div>
            </div>
          ))}

          {stories.length === 0 && (
            <div style={{ gridColumn: '1 / -1', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
              No stories found in this tenant.
            </div>
          )}
        </div>
        </>
      )}
      
      <style>{`
        .spinner {
          width: 20px;
          height: 20px;
          border: 2px solid var(--glass-border);
          border-top-color: var(--accent-color);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
