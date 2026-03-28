/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { Configuration, ActionsApi } from 'tines-sdk';
import { useLogger } from '../context/LogContext';

// Reuse safety classification for the table
type SafetyTier = 'safe' | 'read-only' | 'interactive' | 'mutating';
const SAFETY_COLORS: Record<SafetyTier, { icon: string; color: string; label: string }> = {
  'safe':        { icon: '🟢', color: '#22c55e', label: 'Non-Mutating' },
  'read-only':   { icon: '🔵', color: '#3b82f6', label: 'External Read' },
  'interactive': { icon: '🟡', color: '#f59e0b', label: 'User-Facing' },
  'mutating':    { icon: '🔴', color: '#ef4444', label: 'External Write' },
};

function quickClassify(action: any): SafetyTier {
  const type = action.type || '';
  const method = (action.options?.method || '').toLowerCase();
  if (type === 'Agents::EventTransformationAgent' || type === 'Agents::TriggerAgent') return 'safe';
  if (type === 'Agents::FormAgent' || type === 'Agents::WebhookAgent' || type === 'Agents::ScheduleAgent') return 'interactive';
  if (type === 'Agents::HTTPRequestAgent' && ['get','head','options'].includes(method)) return 'read-only';
  if (type === 'Agents::LLMAgent') return 'read-only';
  return 'mutating';
}

interface ActionsPageProps {
  tenant: string;
  apiKey: string;
  onSelectStory: (storyId: number) => void;
}

export default function ActionsPage({ tenant, apiKey, onSelectStory }: ActionsPageProps) {
  const [actions, setActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTier, setFilterTier] = useState<SafetyTier | 'all'>('all');
  const { addLog } = useLogger();

  const actionsApi = new ActionsApi(new Configuration({
    basePath: `https://${tenant.replace('https://', '').replace(/\/$/, '')}`,
    headers: { 'x-user-token': apiKey, 'Content-Type': 'application/json' },
  }));

  useEffect(() => {
    (async () => {
      setLoading(true);
      addLog('NETWORK', 'Fetching global actions across all stories...');
      try {
        const resp = await actionsApi.listActions({ perPage: 500, storyMode: 'BUILD' as any });
        const list = (resp as any)?.agents || resp || [];
        setActions(Array.isArray(list) ? list : []);
        addLog('SUCCESS', `Loaded ${Array.isArray(list) ? list.length : 0} global actions`);
      } catch (err: any) {
        addLog('ERROR', `Failed to fetch actions: ${err.message}`);
      }
      setLoading(false);
    })();
  }, [tenant, apiKey]);

  const filtered = actions.filter(a => {
    const matchesSearch = !search || 
      (a.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (a.type || '').toLowerCase().includes(search.toLowerCase());
    const matchesTier = filterTier === 'all' || quickClassify(a) === filterTier;
    return matchesSearch && matchesTier;
  });

  return (
    <div style={{ flex: 1, padding: '2rem 3rem', overflowY: 'auto' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.25rem', fontWeight: 600 }}>Global Actions</h1>
        <p style={{ color: 'var(--text-secondary)' }}>All actions across all stories on this tenant</p>
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
              const tier = quickClassify(act);
              const info = SAFETY_COLORS[tier];
              return (
                <div
                  key={act.id}
                  className="glass-panel"
                  onClick={() => act.story_id && onSelectStory(act.story_id)}
                  style={{ padding: '1rem 1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: `3px solid ${info.color}`, transition: 'transform 0.1s ease' }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'translateX(4px)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'none')}
                >
                  <span style={{ fontSize: '1.2rem' }}>{info.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: 'white' }}>{act.name || 'Unnamed'}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {(act.type || '').replace('Agents::', '')} · Story {act.story_id || '?'}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', background: `${info.color}22`, color: info.color, fontWeight: 600 }}>
                    {info.label}
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
