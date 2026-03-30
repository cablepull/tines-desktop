/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';

export interface TinesEvent {
  id: number;
  action_id: number;
  created_at: string;
  status?: string;
  output?: any;
  payload?: any;
  error?: string;
  duration_ms?: number;
  previous_event_ids?: number[];
  story_run_guid?: string;
}

interface DebugInspectorProps {
  action: any;
  events: TinesEvent[];
  logs: any[];
  onClose: () => void;
  onRefresh: () => void;
  onHoverEvent?: (id: string | null) => void;
  onNavigateToEvent?: (eventId: number) => void;
  highlightEventId?: number | null;
  tenant: string;
  apiKey: string;
}

function getEventStatus(events: TinesEvent[]): 'ok' | 'error' | 'warning' | 'none' {
  if (events.length === 0) return 'none';
  const e = events[0];
  
  const p = e.output || e.payload;
  if (e.status === 'error' || e.error || (p && typeof p.status === 'number' && p.status >= 500)) return 'error';
  if (e.status === 'warning' || (p && typeof p.status === 'number' && p.status >= 400 && p.status < 500)) return 'warning';
  
  return 'ok';
}

const STATUS_STYLES: Record<string, { icon: string; color: string; label: string }> = {
  ok:      { icon: '✅', color: '#22c55e', label: 'Success' },
  error:   { icon: '❌', color: '#ef4444', label: 'Error' },
  warning: { icon: '⚠️', color: '#f59e0b', label: 'Warning' },
  none:    { icon: '⏸',  color: '#64748b', label: 'No Events' },
};

export default function DebugInspector({ 
  action, events, logs, onClose, onRefresh, onHoverEvent, onNavigateToEvent, highlightEventId, tenant, apiKey 
}: DebugInspectorProps) {
  const [activeTab, setActiveTab] = useState<'events' | 'diagnosis' | 'logs'>('events');
  const [expandedEventId, setExpandedEventId] = useState<number | null>(highlightEventId || null);
  const [isDryRunning, setIsDryRunning] = useState(false);
  const [logFilter, setLogFilter] = useState<'all' | 'error' | 'warning'>('all');

  // Sync internal expansion with external highlight
  useEffect(() => {
    if (highlightEventId) {
      setExpandedEventId(highlightEventId);
      setActiveTab('events');
    }
  }, [highlightEventId]);

  const handleDryRun = async () => {
    if (!action?.id) return;
    setIsDryRunning(true);
    const basePath = tenant.startsWith('http') ? tenant : `https://${tenant}`;
    try {
      const resp = await fetch(`${basePath}/api/v1/actions/${action.id}/dry_run`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({}) // Future: allow sample payload input
      });
      if (!resp.ok) throw new Error(`Status ${resp.status}`);
      onRefresh(); // Trigger refresh to see new event
    } catch (err: any) {
      console.error('Dry run failed:', err);
      alert(`Dry run failed: ${err.message}`);
    } finally {
      setIsDryRunning(false);
    }
  };

  const overallStatus = getEventStatus(events);
  const style = STATUS_STYLES[overallStatus];

  return (
    <div
      className="glass-panel"
      style={{
        width: '420px', flexShrink: 0, display: 'flex', flexDirection: 'column',
        height: '100%', overflow: 'hidden', borderLeft: `2px solid ${style.color}`
      }}
    >
      {/* Header */}
      <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'white' }}>
            {style.icon} {action?.name || 'Debug Inspector'}
          </div>
          <div style={{ fontSize: '0.7rem', color: style.color, fontWeight: 600, marginTop: '2px' }}>
            {style.label} · {events.length} event{events.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn-glass"
            onClick={handleDryRun}
            disabled={isDryRunning}
            style={{ padding: '4px 8px', fontSize: '0.8rem', color: '#60a5fa' }}
            title="Dry Run Action"
          >
            {isDryRunning ? '⏳' : '⚡'}
          </button>
          <button
            className="btn-glass"
            onClick={onRefresh}
            style={{ padding: '4px 8px', fontSize: '0.8rem' }}
            title="Refresh Events"
          >
            🔄
          </button>
          <button
            className="btn-glass"
            onClick={onClose}
            style={{ padding: '4px 8px', fontSize: '0.8rem' }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Action Meta */}
      <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)' }}>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>ACTION TYPE</div>
        <div style={{ fontSize: '0.8rem', color: '#a78bfa', fontFamily: 'monospace' }}>
          {(action?.type || '').replace('Agents::', '')}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.1)' }}>
        <button 
          onClick={() => setActiveTab('events')}
          style={{ 
            flex: 1, padding: '0.6rem', background: 'transparent', border: 'none', borderBottom: activeTab === 'events' ? '2px solid var(--accent-color)' : 'none',
            color: activeTab === 'events' ? 'white' : 'var(--text-secondary)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600
          }}
        >
          EVENTS
        </button>
        <button 
          onClick={() => setActiveTab('logs')}
          style={{ 
            flex: 1, padding: '0.6rem', background: 'transparent', border: 'none', borderBottom: activeTab === 'logs' ? '2px solid #f59e0b' : 'none',
            color: activeTab === 'logs' ? 'white' : 'var(--text-secondary)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600
          }}
        >
          LOGS ({logs.length})
        </button>
        <button 
          onClick={() => setActiveTab('diagnosis')}
          style={{ 
            flex: 1, padding: '0.6rem', background: 'transparent', border: 'none', borderBottom: activeTab === 'diagnosis' ? '2px solid #ec4899' : 'none',
            color: activeTab === 'diagnosis' ? 'white' : 'var(--text-secondary)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600
          }}
        >
          DIAGNOSIS
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
        {activeTab === 'logs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              {(['all', 'error', 'warning'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setLogFilter(f)}
                  style={{
                    padding: '4px 10px', fontSize: '0.65rem', borderRadius: '4px', border: 'none',
                    background: logFilter === f ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.05)',
                    color: logFilter === f ? 'white' : 'var(--text-secondary)',
                    cursor: 'pointer', fontWeight: 600, textTransform: 'uppercase'
                  }}
                >
                  {f === 'all' ? `All (${logs.length})` : f === 'error' ? `Errors (${logs.filter(l => l.level === 4).length})` : `Warnings (${logs.filter(l => l.level === 2).length})`}
                </button>
              ))}
            </div>
            {logs.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '1rem' }}>
                No active logs found for this action.
              </div>
            )}
            {logs.filter(l => logFilter === 'all' || (logFilter === 'error' && l.level === 4) || (logFilter === 'warning' && l.level === 2)).map((log, i) => (
              <div key={i} style={{ 
                padding: '0.65rem', borderRadius: '6px', background: 'rgba(255,255,255,0.03)', 
                borderLeft: `3px solid ${log.level === 4 ? '#ef4444' : log.level === 2 ? '#f59e0b' : '#64748b'}`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', marginBottom: '4px' }}>
                  <span style={{ color: log.level === 4 ? '#ef4444' : log.level === 2 ? '#f59e0b' : 'var(--text-secondary)', fontWeight: 600 }}>
                    {log.level === 4 ? 'ERROR' : log.level === 2 ? 'WARNING' : 'INFO'}
                  </span>
                  <span style={{ color: 'var(--text-secondary)' }}>{new Date(log.created_at).toLocaleTimeString()}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'white', lineHeight: '1.4', wordBreak: 'break-word' }}>{log.message}</div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'diagnosis' && (
          <>
            <div style={{ background: 'rgba(236,72,153,0.1)', border: '1px solid rgba(236,72,153,0.3)', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.65rem', color: '#ec4899', fontWeight: 700, marginBottom: '0.5rem' }}>AUTOMATED RCA [G2]</div>
              <div style={{ fontSize: '0.85rem', color: 'white', fontWeight: 600, lineHeight: 1.4 }}>
                {(() => {
                  const systemErr = logs.find(l => l.level === 4);
                  if (systemErr) return `System Error: ${systemErr.message}`;

                  const errEvt = events.find(e => e.status === 'error' || e.error);
                  if (!errEvt) return "No critical failures detected in this trace.";
                  
                  const errStr = (errEvt.error || "").toLowerCase();
                  const p = errEvt.output || errEvt.payload;
                  const status = (p?.status || 0);

                  if (status === 401 || status === 403 || errStr.includes('unauthorized')) 
                    return "Credential Mismatch: The API returned an authentication error. Please verify your stored credentials.";
                  if (status === 404 || errStr.includes('not found')) 
                    return "Invalid Endpoint: The target URL or resource path appears to be incorrect.";
                  if (errStr.includes('timeout') || errStr.includes('deadline'))
                    return "Network Latency: The connection timed out. Check your target server's responsiveness.";
                  if (errStr.includes('invalid') || errStr.includes('schema'))
                    return "Payload Drift: The inbound payload structure does not match the expected agent JSON schema.";
                  
                  return errEvt.error || "Unknown Failure: A runtime error occurred. Inspect the raw event payload for stack trace details.";
                })()}
              </div>
            </div>

            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', fontWeight: 700 }}>REMEDIATION STEPS</div>
            <ul style={{ paddingLeft: '1.25rem', margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <li>Verify the Story is in <strong>DRAFT</strong> mode before making changes.</li>
              <li>Use the <strong>Dry Run</strong> feature to test individual nodes before publishing.</li>
              <li>Check the <strong>Story Health Ribbon</strong> for token usage limits.</li>
            </ul>
          </>
        )}

        {activeTab === 'events' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {events.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏸</div>
                <div style={{ fontSize: '0.85rem' }}>No events recorded for this agent.</div>
                <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', opacity: 0.7 }}>
                  Trigger the story to generate event data.
                </div>
              </div>
            ) : (
              events.map((evt) => {
                const isError = evt.status === 'error' || !!evt.error;
                const isWarning = evt.status === 'warning';
                const borderColor = isError ? '#ef4444' : isWarning ? '#f59e0b' : '#22c55e';
                const isExpanded = expandedEventId === evt.id;
                const timestamp = evt.created_at ? new Date(evt.created_at).toLocaleString() : 'Unknown';

                return (
                  <div
                    key={evt.id}
                    style={{
                      borderRadius: '8px',
                      border: `1px solid ${borderColor}33`,
                      background: 'rgba(255,255,255,0.02)',
                      padding: '0.5rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      position: 'relative',
                      boxShadow: isExpanded ? `0 0 12px 1px ${borderColor}44` : 'none',
                    }}
                    onClick={() => setExpandedEventId(isExpanded ? null : evt.id)}
                    onMouseEnter={() => onHoverEvent?.(evt.id.toString())}
                    onMouseLeave={() => onHoverEvent?.(null)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.9rem' }}>{borderColor === '#ef4444' ? '❌' : borderColor === '#f59e0b' ? '⚠️' : '✅'}</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'white' }}>#{evt.id}</span>
                      </div>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{timestamp}</span>
                    </div>
                    
                    {isExpanded && (
                      <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--glass-border)', paddingTop: '0.75rem' }}>
                        {(evt.error || evt.output) && (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                                {evt.error ? 'ERROR LOG' : 'PAYLOAD OUTPUT'}
                              </div>
                              {evt.previous_event_ids && evt.previous_event_ids.length > 0 && (
                                <button
                                  className="btn-link"
                                  onClick={() => onNavigateToEvent?.(evt.previous_event_ids![0])}
                                  style={{ fontSize: '0.65rem', color: 'var(--accent-color)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                                >
                                  🔗 Source Event
                                </button>
                              )}
                            </div>
                            <pre style={{
                              margin: 0, padding: '0.5rem', borderRadius: '6px',
                              background: 'rgba(0,0,0,0.3)', color: '#a5d6ff',
                              fontSize: '0.72rem', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all'
                            }}>
                              {JSON.stringify(evt.output || evt.payload, null, 2)}
                            </pre>
                          </>
                        )}
                        {!evt.error && !evt.output && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>No payload data.</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
