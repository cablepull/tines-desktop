/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { 
  Configuration, 
  StoriesApi, 
  TeamsApi 
} from 'tines-sdk';
import { useLogger } from '../context/LogContext';
import { 
  classifyAction, 
  type SafetyTier 
} from '../utils/safetyEngine';

interface ActionsPageProps {
  tenant: string;
  apiKey: string;
  onSelectStory: (storyId: number, mode?: 'live' | 'test' | 'draft', draftId?: number, actionId?: number) => void;
}

export default function ActionsPage({ tenant, apiKey, onSelectStory }: ActionsPageProps) {
  const [actions, setActions] = useState<any[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [activeTeamId, setActiveTeamId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTier, setFilterTier] = useState<SafetyTier | 'all'>('all');
  const { addLog } = useLogger();

  useEffect(() => {
    let isMounted = true;
    (async () => {
      setLoading(true);
      const config = new Configuration({
        basePath: `https://${tenant.replace('https://', '').replace(/\/$/, '')}`,
        accessToken: apiKey,
      });
      const storiesApi = new StoriesApi(config);
      const teamsApi = new TeamsApi(config);

      try {
        // 1. Fetch Teams (if not loaded)
        if (teams.length === 0) {
          addLog('NETWORK', 'Discovering accessible teams for Actions browser...');
          const teamsRes: any = await teamsApi.listTeams({ perPage: 100, includePersonalTeams: true });
          const teamsList = teamsRes.teams || (Array.isArray(teamsRes) ? teamsRes : []);
          if (isMounted) setTeams(teamsList);
          
          if (teamsList.length > 0 && !activeTeamId) {
            if (isMounted) setActiveTeamId(teamsList[0].id);
            return; // Exit and let the next effect run with the new activeTeamId
          }
        }

        if (activeTeamId) {
          // 2. Fetch Stories for name resolution
          addLog('NETWORK', `Resolving story names for Team ${activeTeamId}...`);
          const storiesRes: any = await storiesApi.listStories({ teamId: activeTeamId, perPage: 100 });
          if (isMounted) setStories(storiesRes.stories || (Array.isArray(storiesRes) ? storiesRes : []));

          // 3. Fetch Actions (Using raw fetch to support all story modes, mirroring StoryView.tsx)
          addLog('NETWORK', `Fetching actions for Team ${activeTeamId}...`);
          const basePath = tenant.startsWith('http') ? tenant : `https://${tenant}`;
          let list: any[] = [];

          const modes = ['BUILD', 'TEST', 'LIVE', undefined];
          for (const mode of modes) {
            const url = mode 
              ? `${basePath}/api/v1/actions?team_id=${activeTeamId}&story_mode=${mode}&per_page=500`
              : `${basePath}/api/v1/actions?team_id=${activeTeamId}&per_page=500`;
            
            const actRes = await fetch(url, { 
              headers: { 'Authorization': `Bearer ${apiKey}` } 
            });
            
            if (actRes.ok) {
              const actData = await actRes.json();
              const extracted = actData.actions || actData.agents || (Array.isArray(actData) ? actData : []);
              if (extracted.length > 0) {
                list = extracted;
                addLog('INFO', `Found ${list.length} actions in ${mode || 'default'} mode`);
                break;
              }
            }
          }

          if (isMounted) {
            setActions(list);
            addLog('SUCCESS', `Rendered ${list.length} actions (Context: ${teams.find(t => t.id === activeTeamId)?.name || activeTeamId})`);
          }
        }
      } catch (err: any) {
        if (isMounted) addLog('ERROR', `Actions Browser failed: ${err.message}`);
      }
      if (isMounted) setLoading(false);
    })();
    return () => { isMounted = false; };
  }, [tenant, apiKey, activeTeamId, teams.length]);

  const filtered = actions.filter(a => {
    const matchesSearch = !search || 
      (a.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (a.type || '').toLowerCase().includes(search.toLowerCase());
    const matchesTier = filterTier === 'all' || classifyAction(a).tier === filterTier;
    return matchesSearch && matchesTier;
  });

  return (
    <div style={{ flex: 1, padding: '2rem 3rem', overflowY: 'auto' }}>
      <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 600 }}>Global Actions</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Cross-story search and safety auditing</p>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Scope</span>
          <select 
            value={activeTeamId || ''} 
            onChange={e => setActiveTeamId(Number(e.target.value))}
            className="btn-glass"
            style={{ padding: '0.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: 'white', borderRadius: '8px', minWidth: '180px' }}
          >
            {teams.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      </header>

      {/* Search & Filters */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Search actions by name or type..."
          style={{ flex: 1, padding: '0.75rem 1rem', background: 'var(--bg-card)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'white', fontSize: '0.9rem' }}
        />
        <select
          value={filterTier}
          onChange={e => setFilterTier(e.target.value as any)}
          style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: 'white', borderRadius: '8px' }}
        >
          <option value="all">All Tiers</option>
          <option value="safe">🟢 Non-Mutating</option>
          <option value="read-only">🔵 External Read</option>
          <option value="interactive">🟡 User-Facing</option>
          <option value="mutating">🔴 External Write</option>
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>Loading actions...</div>
      ) : (
        <>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Showing {filtered.length} of {actions.length} actions
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {filtered.map(act => {
              const s = classifyAction(act);
              const parentStory = stories.find(st => st.id === (act.story_id || act.storyId));
              return (
                <div
                  key={act.id}
                  className="glass-panel"
                  onClick={() => act.story_id && onSelectStory(act.story_id, 'live', undefined, act.id)}
                  style={{ padding: '1rem 1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: `3px solid ${s.color}`, transition: 'transform 0.1s ease' }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'translateX(4px)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'none')}
                >
                  <span style={{ fontSize: '1.2rem' }}>{s.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: 'white' }}>{act.name || 'Unnamed'}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--accent-hover)', fontWeight: 500 }}>
                      {parentStory?.name || `Story #${act.story_id || '?'}`}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      {(act.type || '').replace('Agents::', '')} · ID: {act.id}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', background: `${s.color}22`, color: s.color, fontWeight: 600 }}>
                    {s.label}
                  </span>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                No actions found matching your filters
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
