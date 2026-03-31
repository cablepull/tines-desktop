import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { classifyActionLiveSignal, classifyEventSignal, classifyLogSignal } from '../utils/debugEvidence';

interface StoryLedgerProps {
  storyId: number;
  actions: any[];
  refreshVersion?: number;
  onFlyToNode: (id: number) => void;
  onClose: () => void;
}

type LedgerImpact = 'blocked' | 'external' | 'warning' | 'ok' | 'unknown';

const classifyImpact = (item: any, action?: any): { level: LedgerImpact; label: string; detail: string } => {
  if (item._type === 'LOG') {
    const signal = classifyLogSignal(item);
    if (signal === 'blocked') {
      return { level: 'blocked', label: 'Flow-blocking', detail: 'Action log indicates a local runtime failure or hard stop in this execution path.' };
    }
    if (signal === 'external') {
      return { level: 'external', label: 'External issue', detail: 'Action log indicates a downstream HTTP or remote-system failure.' };
    }
    if (signal === 'warning') {
      return { level: 'warning', label: 'Advisory', detail: 'Warning log indicates attention needed without confirmed flow break.' };
    }
    const actionSignal = classifyActionLiveSignal(action);
    if (actionSignal === 'blocked') {
      return { level: 'blocked', label: 'Action unhealthy', detail: 'The log is informational, but Tines currently reports this action as not working.' };
    }
    if (actionSignal === 'warning') {
      return { level: 'warning', label: 'Action warning', detail: 'The log is informational, but the action has recent warning/error activity or backlog in live activity.' };
    }
    return { level: 'ok', label: 'Informational', detail: 'Informational log only.' };
  }

  const signal = classifyEventSignal(item);
  if (signal === 'blocked') {
    return { level: 'blocked', label: 'Flow-blocking', detail: 'This event explicitly failed and likely broke the run path.' };
  }
  if (signal === 'external') {
    return { level: 'external', label: 'External issue', detail: 'This event points to an HTTP or downstream dependency issue rather than a guaranteed local flow break.' };
  }
  if (signal === 'warning') {
    return { level: 'warning', label: 'Advisory', detail: 'This event was marked as a warning without a hard failure.' };
  }
  const actionSignal = classifyActionLiveSignal(action);
  if (actionSignal === 'blocked') {
    return { level: 'blocked', label: 'Action unhealthy', detail: 'This event executed, but Tines currently reports the action as not working.' };
  }
  if (actionSignal === 'warning') {
    return { level: 'warning', label: 'Action warning', detail: 'This event executed, but the action has recent warning/error activity or backlog in live activity.' };
  }
  if (signal === 'ok' || signal === 'none') {
    return { level: 'ok', label: 'Observed execution', detail: 'This record shows execution activity. Supported APIs do not expose a stronger failure signal on this row.' };
  }

  return { level: 'unknown', label: 'Unknown', detail: 'The record does not expose enough information to classify impact confidently.' };
};

const impactStyle = (level: LedgerImpact) => {
  switch (level) {
    case 'blocked':
      return { color: '#ef4444', bg: 'rgba(239,68,68,0.14)', icon: '⛔' };
    case 'external':
      return { color: '#f97316', bg: 'rgba(249,115,22,0.14)', icon: '🌐' };
    case 'warning':
      return { color: '#f59e0b', bg: 'rgba(245,158,11,0.14)', icon: '⚠️' };
    case 'ok':
      return { color: '#22c55e', bg: 'rgba(34,197,94,0.14)', icon: '✅' };
    default:
      return { color: '#94a3b8', bg: 'rgba(148,163,184,0.14)', icon: '❔' };
  }
};

const StoryLedger: React.FC<StoryLedgerProps> = ({ storyId, actions, refreshVersion = 0, onFlyToNode, onClose }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  
  const [events, setEvents] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const PAGE_SIZE = 50;

  const fetchData = useCallback(async (currentOffset: number, clear: boolean = false) => {
    if (!window.electronAPI) return;
    setLoading(true);
    try {
      const [newEvents, newLogs] = await Promise.all([
        window.electronAPI.dbGetEvents({ storyId, limit: PAGE_SIZE, offset: currentOffset }),
        window.electronAPI.dbGetLogs({ storyId, limit: PAGE_SIZE * 2, offset: currentOffset * 2 })
      ]);

      if (clear) {
        setEvents(newEvents);
        setLogs(newLogs);
      } else {
        setEvents(prev => [...prev, ...newEvents]);
        setLogs(prev => [...prev, ...newLogs]);
      }

      if (newEvents.length < PAGE_SIZE && newLogs.length < (PAGE_SIZE * 2)) {
        setHasMore(false);
      } else {
        setHasMore(true);
      }
    } catch (e) {
      console.error('Ledger: Failed to fetch data', e);
    } finally {
      setLoading(false);
    }
  }, [storyId]);

  useEffect(() => {
    setOffset(0);
    setHasMore(true);
    fetchData(0, true);
  }, [fetchData, refreshVersion]);

  const handleLoadMore = () => {
    const nextOffset = offset + PAGE_SIZE;
    setOffset(nextOffset);
    fetchData(nextOffset);
  };

  const handleClearHistory = async () => {
    if (window.confirm('Are you sure you want to clear all local debugging history? This cannot be undone.')) {
      if (window.electronAPI) {
        await window.electronAPI.dbClearAll();
        setEvents([]);
        setLogs([]);
        setOffset(0);
        setHasMore(false);
      }
    }
  };

  const mergedData = useMemo(() => {
    const combined = [
      ...events.map(e => ({ ...e, _type: 'EVENT' })),
      ...logs.map(l => ({ ...l, _type: 'LOG' }))
    ];
    return combined.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [events, logs]);

  const filteredData = useMemo(() => {
    let data = mergedData;
    
    // Status Filter
    if (statusFilter !== 'all') {
      data = data.filter(item => {
        const status = (item.status || item.level || '').toLowerCase();
        if (statusFilter === 'error') return status === 'failed' || status === 'error';
        if (statusFilter === 'success') return status === 'success';
        return status === statusFilter;
      });
    }

    // Type Filter
    if (typeFilter !== 'all') {
      data = data.filter(item => item._type === typeFilter);
    }

    // Search Filter
    if (search) {
      const s = search.toLowerCase();
      data = data.filter(item => {
        const actionName = actions.find(a => a.id === Number(item.action_id || item.agent_id))?.name || '';
        return (
          actionName.toLowerCase().includes(s) ||
          String(item.id).toLowerCase().includes(s) ||
          String(item.run_guid || item.story_run_guid || '').toLowerCase().includes(s) ||
          String(item.message || '').toLowerCase().includes(s)
        );
      });
    }

    return data;
  }, [mergedData, search, statusFilter, typeFilter, actions]);

  const getActionName = (id: any) => actions.find(a => a.id === Number(id))?.name || `Action #${id}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1e293b', color: 'white' }}>
      {/* Header / Search */}
      <div style={{ padding: '1rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--accent-color)', whiteSpace: 'nowrap' }}>STORY AUDIT LEDGER</h3>
        
        <input 
          type="text" 
          placeholder="Search by GUID, ID, Name..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ 
            flex: 1, minWidth: '200px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', 
            borderRadius: '4px', padding: '0.5rem 1rem', color: 'white', fontSize: '0.9rem'
          }}
        />

        <select 
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: 'white', padding: '0.4rem', borderRadius: '4px' }}
        >
          <option value="all">Any Status</option>
          <option value="success">Success</option>
          <option value="error">Error/Failed</option>
        </select>

        <select 
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: 'white', padding: '0.4rem', borderRadius: '4px' }}
        >
          <option value="all">Any Type</option>
          <option value="EVENT">Events Only</option>
          <option value="LOG">Logs Only</option>
        </select>

        <div style={{ fontSize: '0.8rem', opacity: 0.6, whiteSpace: 'nowrap' }}>
          {filteredData.length} visible
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            className="btn-glass" 
            onClick={handleClearHistory}
            style={{ fontSize: '0.75rem', padding: '0.5rem 1rem', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171' }}
          >
            🗑️ CLEAR
          </button>
          <button 
            className="btn-glass" 
            onClick={onClose}
            style={{ fontSize: '0.75rem', padding: '0.5rem 1rem' }}
          >
            ✖️ DISMISS
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Table View */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead style={{ position: 'sticky', top: 0, background: '#0f172a', zIndex: 10 }}>
                <tr>
                  <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '2px solid var(--glass-border)' }}>TIMESTAMP</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '2px solid var(--glass-border)' }}>TYPE</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '2px solid var(--glass-border)' }}>ACTION</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '2px solid var(--glass-border)' }}>RUN GUID</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '2px solid var(--glass-border)' }}>IMPACT</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '2px solid var(--glass-border)' }}>STATUS</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '2px solid var(--glass-border)' }}>ID</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((item, idx) => {
                  const action = actions.find(a => a.id === Number(item.action_id || item.agent_id));
                  const impact = classifyImpact(item, action);
                  const impactBadge = impactStyle(impact.level);
                  return (
                  <tr 
                    key={idx} 
                    onClick={() => setSelectedItem(item)}
                    style={{ 
                      cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)',
                      background: selectedItem === item ? 'rgba(99,102,241,0.1)' : 'transparent'
                    }}
                  >
                    <td style={{ padding: '0.75rem', opacity: 0.8 }}>{new Date(item.created_at).toLocaleString()}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{ 
                        padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800,
                        background: item._type === 'EVENT' ? 'rgba(59,130,246,0.2)' : 'rgba(168,85,247,0.2)',
                        color: item._type === 'EVENT' ? '#60a5fa' : '#c084fc'
                      }}>{item._type}</span>
                    </td>
                    <td style={{ padding: '0.75rem', fontWeight: 600 }}>{getActionName(item.action_id || item.agent_id)}</td>
                    <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontSize: '0.7rem', opacity: 0.7 }}>
                      {item.run_guid || item.story_run_guid || 'N/A'}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <span
                        title={impact.detail}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '2px 8px',
                          borderRadius: '999px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          background: impactBadge.bg,
                          color: impactBadge.color,
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <span>{impactBadge.icon}</span>
                        <span>{impact.label}</span>
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{ 
                        color: item.status === 'failed' || item.level === 'error' ? 'var(--danger-color)' : 
                               item.status === 'success' ? 'var(--success-color)' : 'var(--text-secondary)'
                      }}>
                        {item.status || item.level || 'info'}
                      </span>
                      {item.re_emitted && <span style={{ marginLeft: '4px', fontSize: '0.65rem', opacity: 0.6 }}>🔄</span>}
                    </td>
                    <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontSize: '0.75rem', opacity: 0.6 }}>
                      {item.id}
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
            
            {hasMore && (
              <div style={{ padding: '2rem', textAlign: 'center' }}>
                <button 
                  className="btn-glass" 
                  onClick={handleLoadMore}
                  disabled={loading}
                  style={{ width: '200px' }}
                >
                  {loading ? 'LOADING...' : 'LOAD MORE'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Details Inspector */}
        {selectedItem && (
          <div style={{ width: '450px', borderLeft: '1px solid var(--glass-border)', padding: '1rem', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', position: 'relative' }}>
            {(() => {
              const action = actions.find(a => a.id === Number(selectedItem.action_id || selectedItem.agent_id));
              const impact = classifyImpact(selectedItem, action);
              const badge = impactStyle(impact.level);
              return (
                <div style={{ marginBottom: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '6px 10px', borderRadius: '999px', background: badge.bg, color: badge.color, fontSize: '0.75rem', fontWeight: 700 }}>
                  <span>{badge.icon}</span>
                  <span>{impact.label}</span>
                </div>
              );
            })()}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h4 style={{ margin: 0, color: 'var(--accent-color)' }}>FORENSIC INSPECTOR</h4>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  className="btn-glass" 
                  onClick={() => onFlyToNode(Number(selectedItem.action_id || selectedItem.agent_id))}
                  style={{ fontSize: '0.7rem', padding: '4px 12px' }}
                >
                  🎯 FLY TO
                </button>
                <button 
                  className="btn-glass" 
                  onClick={() => setSelectedItem(null)}
                  style={{ fontSize: '0.7rem', padding: '4px 8px', color: 'var(--text-secondary)' }}
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginBottom: '1.5rem', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px' }}>
              {selectedItem.re_emitted && (
                <div style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-block', alignSelf: 'flex-start' }}>
                  🔄 RE-EMITTED EVENT
                </div>
              )}

              <div>
                <div style={{ fontSize: '0.7rem', opacity: 0.5, textTransform: 'uppercase' }}>Run Correlation GUID</div>
                <div style={{ fontSize: '0.85rem', fontFamily: 'monospace', color: 'var(--accent-color)' }}>{selectedItem.run_guid || selectedItem.story_run_guid || 'UNTRACKED'}</div>
              </div>
              
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.7rem', opacity: 0.5, textTransform: 'uppercase' }}>Timestamp</div>
                  <div style={{ fontSize: '0.85rem' }}>{new Date(selectedItem.created_at).toLocaleString()}</div>
                </div>
                <div style={{ width: '100px' }}>
                  <div style={{ fontSize: '0.7rem', opacity: 0.5, textTransform: 'uppercase' }}>Type</div>
                  <div style={{ fontSize: '0.85rem', color: selectedItem._type === 'EVENT' ? '#60a5fa' : '#c084fc' }}>{selectedItem._type}</div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.7rem', opacity: 0.5, textTransform: 'uppercase' }}>Action Name</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{getActionName(selectedItem.action_id || selectedItem.agent_id)}</div>
                <div style={{ fontSize: '0.7rem', opacity: 0.4 }}>ID: {selectedItem.action_id || selectedItem.agent_id}</div>
              </div>

              <div>
                <div style={{ fontSize: '0.7rem', opacity: 0.5, textTransform: 'uppercase' }}>Impact Classification</div>
                <div style={{ fontSize: '0.85rem', color: impactStyle(classifyImpact(selectedItem).level).color }}>
                  {classifyImpact(selectedItem, actions.find(a => a.id === Number(selectedItem.action_id || selectedItem.agent_id))).label}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.2rem', lineHeight: 1.4 }}>
                  {classifyImpact(selectedItem, actions.find(a => a.id === Number(selectedItem.action_id || selectedItem.agent_id))).detail}
                </div>
              </div>
            </div>

            <div style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.5rem' }}>RAW DATA (JSON)</div>
            <pre style={{ 
              background: 'rgba(0,0,0,0.4)', padding: '1rem', borderRadius: '8px', 
              fontSize: '0.75rem', overflowX: 'auto', border: '1px solid var(--glass-border)',
              color: '#94a3b8'
            }}>
              {JSON.stringify(selectedItem, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default StoryLedger;
