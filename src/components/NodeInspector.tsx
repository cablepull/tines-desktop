
import type { Action } from 'tines-sdk';
import { useState } from 'react';
import { useLogger } from '../context/LogContext';

interface NodeInspectorProps {
  action: Action;
  tenant: string;
  apiKey: string;
  onClose: () => void;
}

export default function NodeInspector({ action, tenant, apiKey, onClose }: NodeInspectorProps) {
  const { addLog } = useLogger();
  const [running, setRunning] = useState(false);
  const [eventResult, setEventResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'config' | 'events'>('config');

  const executeLiveRun = async () => {
    setRunning(true);
    setEventResult(null);
    addLog('NETWORK', `Initiating Live Execution test for Action: ${action.name}`);
    const baseUrl = tenant.startsWith('http') ? tenant : `https://${tenant}`;
    
    try {
      // Tines maps runs via REST to /run or /dry_run. We trial /run first.
      const res = await fetch(`${baseUrl}/api/v1/actions/${action.id}/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({})
      });

      if (!res.ok) {
        addLog('WARNING', `/run endpoint failed (${res.status}), falling back to /dry_run...`);
        const fallback = await fetch(`${baseUrl}/api/v1/actions/${action.id}/dry_run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({})
        });
        if (!fallback.ok) throw new Error(`Dry Run fallback failed with ${fallback.status}`);
        const fallbackData = await fallback.json();
        setEventResult(fallbackData);
        setActiveTab('events');
        addLog('SUCCESS', `Dry Run Success!`, fallbackData);
        return;
      }
      
      const data = await res.json();
      setEventResult(data);
      setActiveTab('events');
      addLog('SUCCESS', `Action Executed Successfully!`, data);
    } catch (err: any) {
      setEventResult({ error: err.message });
      setActiveTab('events');
      addLog('ERROR', `Execution flow failed`, { error: err.message });
    } finally {
      setRunning(false);
    }
  };

  const fetchLatestEvents = async () => {
    const baseUrl = tenant.startsWith('http') ? tenant : `https://${tenant}`;
    addLog('NETWORK', `Fetching latest events for Action ${action.id}...`);
    try {
      const res = await fetch(`${baseUrl}/api/v1/actions/${action.id}/events?per_page=5`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      if (res.ok) {
        const data = await res.json();
        const events = data.events || data.agents_events || (Array.isArray(data) ? data : []);
        setEventResult({ latestEvents: events, count: events.length });
        setActiveTab('events');
        addLog('SUCCESS', `Retrieved ${events.length} recent events.`);
      } else {
        addLog('WARNING', `Events endpoint returned ${res.status}`);
      }
    } catch (err: any) {
      addLog('ERROR', `Failed to fetch events`, { error: err.message });
    }
  };

  return (
    <div className="glass-panel nondraggable" style={{
      position: 'absolute', top: 0, right: 0, width: '450px', height: '100%',
      background: 'rgba(15, 23, 42, 0.95)', borderLeft: '1px solid var(--glass-border)',
      boxShadow: '-10px 0 30px rgba(0,0,0,0.5)', zIndex: 100,
      padding: '2rem', display: 'flex', flexDirection: 'column', 
      transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      transform: action ? 'translateX(0)' : 'translateX(100%)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>{action.name}</h2>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
      </div>
      
      {/* Tab Switcher */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button 
          onClick={() => setActiveTab('config')} 
          className={activeTab === 'config' ? 'btn-primary' : 'btn-glass'}
          style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
        >
          Configuration
        </button>
        <button 
          onClick={() => { setActiveTab('events'); if (!eventResult) fetchLatestEvents(); }}
          className={activeTab === 'events' ? 'btn-primary' : 'btn-glass'}
          style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
        >
          Event Inspector
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'config' ? (
          <>
            <div style={{ marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.5px' }}>AGENT TYPOLOGY</span>
              <div style={{ color: 'var(--accent-hover)', marginTop: '0.25rem', fontFamily: 'monospace' }}>{typeof action.type === 'string' ? action.type.replace('Agents::', '') : 'Unknown'}</div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.5px' }}>SAFETY CLASSIFICATION</span>
              <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {(() => {
                  const type = (action as any).type || '';
                  const method = ((action as any).options?.method || '').toLowerCase();
                  let icon = '\ud83d\udd34', color = '#ef4444', label = 'External Write';
                  if (type === 'Agents::EventTransformationAgent' || type === 'Agents::TriggerAgent') { icon = '\ud83d\udfe2'; color = '#22c55e'; label = 'Non-Mutating'; }
                  else if (type === 'Agents::FormAgent' || type === 'Agents::WebhookAgent' || type === 'Agents::ScheduleAgent') { icon = '\ud83d\udfe1'; color = '#f59e0b'; label = 'User-Facing'; }
                  else if (type === 'Agents::HTTPRequestAgent' && ['get','head','options'].includes(method)) { icon = '\ud83d\udd35'; color = '#3b82f6'; label = 'External Read'; }
                  else if (type === 'Agents::LLMAgent') { icon = '\ud83d\udd35'; color = '#3b82f6'; label = 'External Read'; }
                  return (
                    <span style={{ fontSize: '0.85rem', padding: '4px 10px', borderRadius: '6px', background: `${color}22`, color, fontWeight: 600 }}>
                      {icon} {label}
                    </span>
                  );
                })()}
              </div>
              {(action as any).type === 'Agents::HTTPRequestAgent' && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Method: <strong>{((action as any).options?.method || 'unknown').toUpperCase()}</strong>
                </div>
              )}
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.5px' }}>PAYLOAD CONFIGURATION</span>
              <pre style={{
                background: 'rgba(0,0,0,0.5)', padding: '1rem', borderRadius: '8px',
                fontSize: '0.8rem', color: '#a5d6ff', marginTop: '0.5rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                border: '1px solid var(--glass-border)'
              }}>
                {JSON.stringify(action.options || {}, null, 2)}
              </pre>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.5px' }}>CONNECTIONS</span>
              <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                <div style={{ color: 'var(--text-secondary)' }}>
                  Sources: {Array.isArray(action.sources) ? action.sources.join(', ') : 'None'}
                </div>
                <div style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  Receivers: {Array.isArray((action as any).receivers) ? (action as any).receivers.join(', ') : 'None'}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.5px' }}>METADATA</span>
              <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <div>ID: {action.id}</div>
                <div>Story: {(action as any).story_id || (action as any).storyId}</div>
                <div>Position: ({action.position?.x}, {action.position?.y})</div>
                <div>GUID: {(action as any).guid || 'N/A'}</div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div style={{ marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.5px' }}>EVENT PAYLOAD INSPECTOR</span>
              <button onClick={fetchLatestEvents} className="btn-glass" style={{ marginLeft: '1rem', padding: '2px 8px', fontSize: '0.75rem' }}>
                ↻ Refresh
              </button>
            </div>

            {eventResult ? (
              <pre style={{
                background: 'rgba(0,0,0,0.5)', padding: '1rem', borderRadius: '8px',
                fontSize: '0.75rem', color: '#a5d6ff', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                border: '1px solid var(--glass-border)', maxHeight: '400px', overflowY: 'auto'
              }}>
                {JSON.stringify(eventResult, null, 2)}
              </pre>
            ) : (
              <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.85rem' }}>
                No event data yet. Execute a Live Run or click Refresh to load recent events.
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
        <button onClick={executeLiveRun} disabled={running} className="btn-primary" style={{ flex: 1, padding: '0.75rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', background: running ? 'var(--bg-glass)' : 'var(--accent-color)' }}>
          <span>▷</span> {running ? 'Executing...' : 'Execute Live Run'}
        </button>
      </div>
    </div>
  );
}
