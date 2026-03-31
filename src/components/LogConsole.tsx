import { useEffect, useMemo, useRef } from 'react';
import { useLogger } from '../context/LogContext';
import type { LogLevel } from '../context/LogContext';

const LevelColors: Record<LogLevel, string> = {
  INFO: '#3B82F6',
  NETWORK: '#8B5CF6',
  SUCCESS: '#10b981',
  ERROR: '#EF4444',
  WARNING: '#f59e0b',
  DEBUG: '#8b5cf6'
};

export default function LogConsole() {
  const { logs, isConsoleOpen, setConsoleOpen, clearLogs } = useLogger();
  const bottomRef = useRef<HTMLDivElement>(null);
  const logCounts = useMemo(() => logs.reduce<Record<LogLevel, number>>((acc, log) => {
    acc[log.level] += 1;
    return acc;
  }, { INFO: 0, NETWORK: 0, SUCCESS: 0, ERROR: 0, WARNING: 0, DEBUG: 0 }), [logs]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (isConsoleOpen && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isConsoleOpen]);

  if (!isConsoleOpen) return null;

  return (
    <div style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: '40vh',
      background: 'rgba(11, 15, 25, 0.95)',
      backdropFilter: 'blur(20px)',
      borderTop: '1px solid rgba(255, 255, 255, 0.1)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 9999,
      animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '0.75rem 1.5rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0, letterSpacing: '0.05em' }}>TERMINAL</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{logs.length} Logs</span>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {(['NETWORK', 'WARNING', 'ERROR', 'SUCCESS', 'DEBUG'] as LogLevel[]).map((level) => (
              <span
                key={level}
                style={{
                  fontSize: '0.7rem',
                  color: LevelColors[level],
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '999px',
                  padding: '2px 8px'
                }}
              >
                {level}: {logCounts[level]}
              </span>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn-glass" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }} onClick={clearLogs}>Clear</button>
          <button className="btn-glass" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }} onClick={() => setConsoleOpen(false)}>Close</button>
        </div>
      </div>

      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '1rem 1.5rem',
        fontFamily: '"Fira Code", monospace',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        fontSize: '0.85rem'
      }}>
        {logs.length === 0 && (
          <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Waiting for debugger and network logs...</div>
        )}
        {logs.map((log) => (
          <div key={log.id} style={{ display: 'flex', gap: '1rem', lineHeight: 1.4 }}>
            <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>
              [{log.timestamp.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}]
            </span>
            <span style={{ color: LevelColors[log.level], fontWeight: 600, width: '4rem', flexShrink: 0 }}>
              {log.level}
            </span>
            <span style={{ color: '#E2E8F0', wordBreak: 'break-word' }}>
              {log.message}
              {log.details && (
                <pre style={{ margin: '0.5rem 0', background: 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: '4px', fontSize: '0.75rem', overflowX: 'auto' }}>
                  {JSON.stringify(log.details, null, 2)}
                </pre>
              )}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
