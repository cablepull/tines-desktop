
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

  const executeLiveRun = async () => {
    setRunning(true);
    addLog('NETWORK', `Initating Live Execution test for Action: ${action.name}`);
    const baseUrl = tenant.startsWith('http') ? tenant : `https://${tenant}`;
    
    try {
      // Tines typically maps runs via REST to /run or /dry_run. We will trial /run first.
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
        addLog('SUCCESS', `Dry Run Success!`, fallbackData);
        return;
      }
      
      const data = await res.json();
      addLog('SUCCESS', `Action Executed Successfully!`, data);
    } catch (err: any) {
      addLog('ERROR', `Execution flow failed`, { error: err.message });
    } finally {
      setRunning(false);
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
      
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.5px' }}>AGENT TYPOLOGY</span>
          <div style={{ color: 'var(--accent-hover)', marginTop: '0.25rem', fontFamily: 'monospace' }}>{action.type?.replace('Agents::', '')}</div>
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

        <div style={{ marginTop: '2rem' }}>
          <button onClick={executeLiveRun} disabled={running} className="btn-primary" style={{ width: '100%', padding: '0.75rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', background: running ? 'var(--bg-glass)' : 'var(--accent-color)' }}>
            <span>▷</span> {running ? 'Executing...' : 'Execute Live Run'}
          </button>
        </div>
      </div>
    </div>
  );
}
