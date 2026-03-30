/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useMemo } from 'react';
import { Configuration, StoriesApi, ActionsApi, TeamsApi } from 'tines-sdk';
import type { Story } from 'tines-sdk';
import { useLogger } from '../context/LogContext';
import ForensicLookup from './ForensicLookup';

interface DashboardProps {
  tenant: string;
  apiKey: string;
  onSelectStory: (id: number, mode?: 'live' | 'test' | 'draft', draftId?: number, actionId?: number) => void;
}

export default function Dashboard({ tenant, apiKey, onSelectStory }: DashboardProps) {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Create Story Form State
  const [newStoryName, setNewStoryName] = useState('');
  const [creatingStory, setCreatingStory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Multi-Team State
  const [teams, setTeams] = useState<any[]>([]);
  const [activeTeamId, setActiveTeamId] = useState<number | null>(null);
  
  const { addLog } = useLogger();

  // Initialize the native generated TS SDK client
  const storiesApi = useMemo(() => {
    const basePath = tenant.startsWith('http') ? tenant : `https://${tenant}`;
    // Using accessToken instead of apiKey ensures the SDK uses 'Authorization: Bearer'
    const config = new Configuration({ basePath, accessToken: apiKey });
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
      
      const basePath = tenant.startsWith('http') ? tenant : `https://${tenant}`;
      const teamsApi = new TeamsApi(new Configuration({ basePath, accessToken: apiKey }));
      
      addLog('NETWORK', `Fetching accessible teams...`);
      const teamsRes: any = await teamsApi.listTeams({ perPage: 100, includePersonalTeams: true });
      const teamsList = teamsRes.teams || (Array.isArray(teamsRes) ? teamsRes : []);
      
      // Categorize teams: Heuristic for Personal vs Team
      // Usually personal teams have properties or names indicating so, but we'll use a local categorizer.
      const categorized = teamsList.map((t: any) => ({
        ...t,
        isPersonal: t.name?.toLowerCase().includes('personal') || t.id === teamsList[0]?.id // Fallback heuristic
      }));
      setTeams(categorized);

      const targetTeamId = activeTeamId || teamsList[0]?.id;
      if (targetTeamId && !activeTeamId) {
        setActiveTeamId(targetTeamId);
      }

      if (targetTeamId) {
        addLog('NETWORK', `Fetching stories from Team ${targetTeamId}...`);
        const res: any = await storiesApi.listStories({ teamId: targetTeamId, perPage: 24 });
        const rawStories = res.stories ? res.stories : (Array.isArray(res) ? res : []);
        setStories(rawStories);
        addLog('SUCCESS', `Successfully fetched ${rawStories.length} stories`);
      } else {
        addLog('WARNING', 'No teams found for this user.');
      }
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
  }, [storiesApi, activeTeamId]);

  const handleCreateStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoryName) return;
    setCreatingStory(true);
    addLog('NETWORK', `Creating new Workspace Story: ${newStoryName}`);
    try {
      const payload: any = { name: newStoryName };
      if (activeTeamId) payload.teamId = activeTeamId;

      await storiesApi.createStory({
        storyCreateRequest: payload
      });
      addLog('SUCCESS', `Created Story ${newStoryName} successfully`);
      setNewStoryName('');
      fetchStories(true);
    } catch (err: any) {
      addLog('ERROR', 'Failed to create story', { error: err.message });
      setError(`Failed to create story: ${err.message}`);
    } finally {
      setCreatingStory(false);
    }
  };

  const handleScaffoldTemplate = async () => {
    setCreatingStory(true);
    const flowName = `SIEM Incident Automations — ${new Date().toLocaleTimeString()}`;
    addLog('NETWORK', `Scaffolding ${flowName} (3 linked agents)...`);
    try {
      const basePath = tenant.startsWith('http') ? tenant : `https://${tenant}`;
      // FIX: Use accessToken (Bearer) instead of apiKey (X-User-Token)
      const actionsApi = new ActionsApi(new Configuration({ basePath, accessToken: apiKey }));

      const payload: any = { name: flowName };
      if (activeTeamId) payload.teamId = activeTeamId;

      // 1. Scaffold Story Container
      const storyRes: any = await storiesApi.createStory({ storyCreateRequest: payload });
      const newId = storyRes.id || storyRes.story?.id;
      if (!newId) throw new Error("Missing newly created Story ID");

      // 2. Scaffold Webhook Agent
      addLog('NETWORK', `Step 2/4: Creating Webhook Trigger...`);
      const hookRes: any = await actionsApi.createAction({
        actionCreateRequest: { 
          name: 'Ingest Trigger', 
          type: 'Agents::WebhookAgent' as any, 
          storyId: newId, 
          position: { x: 300, y: 100 }, 
          options: {
            "get_response_body": "OK"
          }
        }
      });
      const hookId = hookRes.id || hookRes.action?.id;

      // 3. Scaffold Linked HTTP Request
      addLog('NETWORK', `Step 3/4: Adding Query Endpoint...`);
      const httpRes: any = await actionsApi.createAction({
         actionCreateRequest: { 
           name: 'Query Endpoint', 
           type: 'Agents::HttpRequestAgent' as any, 
           storyId: newId, 
           position: { x: 300, y: 250 }, 
           sourceIds: [hookId], 
           options: {
             "url": "https://api.example.com/v1/enrichment",
             "method": "get"
           } 
         }
      });
      const httpId = httpRes.id || httpRes.action?.id;

      // 4. Scaffold Linked Transformation
      addLog('NETWORK', `Step 4/4: Finalizing Data Transform...`);
      await actionsApi.createAction({
         actionCreateRequest: { 
           name: 'Transform Outputs', 
           type: 'Agents::EventTransformationAgent' as any, 
           storyId: newId, 
           position: { x: 300, y: 400 }, 
           sourceIds: [httpId], 
           options: {
             "mode": "message_only",
             "message": "Enrichment complete for incident."
           } 
         }
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
      <header style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
             <h1 style={{ fontSize: '3rem', fontWeight: 700, margin: 0, letterSpacing: '-0.02em', background: 'linear-gradient(to right, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Stories
             </h1>
             <span style={{ 
               marginTop: '1.5rem', fontSize: '0.7rem', fontWeight: 800, padding: '3px 8px', 
               borderRadius: '6px', background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa',
               border: '1px solid rgba(139, 92, 246, 0.3)', letterSpacing: '0.1em'
             }}>ALPHA v0.1.0</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginTop: '0.5rem' }}>
            {teams.find(t => t.id === activeTeamId)?.isPersonal ? 'Your private automations' : `Collaborating in ${teams.find(t => t.id === activeTeamId)?.name}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Select Workspace</span>
            <select 
              value={activeTeamId || ''} 
              onChange={e => setActiveTeamId(Number(e.target.value))}
              className="btn-glass"
              style={{ padding: '0.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: 'white', borderRadius: '8px', minWidth: '180px' }}
            >
              <optgroup label="Personal Space">
                {teams.filter(t => t.isPersonal).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </optgroup>
              <optgroup label="Shared Teams">
                {teams.filter(t => !t.isPersonal).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </optgroup>
            </select>
          </div>
          <button onClick={() => fetchStories(true)} className="btn-glass" style={{ padding: '1.25rem 1rem', fontSize: '0.85rem' }}>
            🔄 Refresh
          </button>
        </div>
      </header>

      <ForensicLookup tenant={tenant} apiKey={apiKey} onOpenStory={onSelectStory} />

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
          <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderStyle: 'dashed' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.5rem' }}>{teams.find(t => t.id === activeTeamId)?.isPersonal ? '👤' : '👥'}</span>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
                  New Story in <span style={{ color: 'var(--accent-hover)' }}>{teams.find(t => t.id === activeTeamId)?.name || 'Loading...'}</span>
                </h3>
             </div>
             
              <form onSubmit={handleCreateStory} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
               <input required value={newStoryName} onChange={e => setNewStoryName(e.target.value)} placeholder="e.g. Okta Alert Processing..." style={{ flex: 1, minWidth: '250px' }} />
               <div style={{ display: 'flex', gap: '0.5rem' }}>
                 <button className="btn-primary" disabled={creatingStory} type="submit" style={{ padding: '0.75rem 1.5rem', flexShrink: 0 }}>
                   {creatingStory ? 'Working...' : '+ Blank Story'}
                 </button>
                 <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <button type="button" onClick={handleScaffoldTemplate} disabled={creatingStory} className="btn-primary" style={{ padding: '0.75rem 1.5rem', background: 'var(--success-color)', flexShrink: 0 }}>
                      {creatingStory ? 'Scaffolding...' : '⚡ AI Template (SIEM Flow)'}
                    </button>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', position: 'absolute', top: '100%', left: 0, marginTop: '4px', width: 'max-content' }}>
                      Creates Webhook → HTTP → Transform agents
                    </span>
                 </div>
               </div>
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
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>{teams.find(t => t.id === story.teamId)?.isPersonal ? '👤' : '👥'}</span>
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
                <span style={{ color: 'var(--accent-hover)' }}>{teams.find(t => t.id === story.teamId)?.name || `Team ${story.teamId}`}</span>
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
