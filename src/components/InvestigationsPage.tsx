import { useEffect, useState } from 'react';
import type { InvestigationRecord } from '../electron';

interface InvestigationsPageProps {
  onOpenInvestigation: (investigation: InvestigationRecord) => void;
}

export default function InvestigationsPage({ onOpenInvestigation }: InvestigationsPageProps) {
  const [investigations, setInvestigations] = useState<InvestigationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'open' | 'needs_review' | 'resolved' | 'archived'>('all');

  const loadInvestigations = async () => {
    if (!window.electronAPI) return;
    setLoading(true);
    try {
      const records = await window.electronAPI.dbListInvestigations({ limit: 200 });
      setInvestigations(records);
    } finally {
      setLoading(false);
    }
  };

  const downloadArtifact = (filename: string, content: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(href);
  };

  const exportInvestigation = (item: InvestigationRecord) => {
    downloadArtifact(
      `${(item.name || `investigation-${item.id || 'export'}`).replace(/[^a-z0-9-_]+/gi, '-').toLowerCase()}.json`,
      JSON.stringify(item, null, 2),
      'application/json'
    );
  };

  const duplicateInvestigation = async (item: InvestigationRecord) => {
    if (!window.electronAPI) return;
    await window.electronAPI.dbSaveInvestigation({
      ...item,
      id: undefined,
      name: `${item.name} Copy`,
    });
    await loadInvestigations();
  };

  const deleteInvestigation = async (item: InvestigationRecord) => {
    if (!window.electronAPI || !item.id) return;
    await window.electronAPI.dbDeleteInvestigation(item.id);
    await loadInvestigations();
  };

  useEffect(() => {
    loadInvestigations();
  }, []);

  const filtered = investigations.filter((item) => {
    if (status !== 'all' && (item.status || 'open') !== status) return false;
    if (!search.trim()) return true;
    const value = search.toLowerCase();
    return (
      (item.name || '').toLowerCase().includes(value) ||
      (item.summary || '').toLowerCase().includes(value) ||
      String(item.story_id || '').includes(value) ||
      String(item.selected_run_guid || '').toLowerCase().includes(value)
    );
  });

  return (
    <div style={{ flex: 1, padding: '2rem 3rem', overflowY: 'auto' }}>
      <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '3rem', fontWeight: 700, margin: 0, letterSpacing: '-0.02em', background: 'linear-gradient(to right, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Investigations
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', marginTop: '0.5rem' }}>
            Local saved forensic sessions, artifacts, and conclusions.
          </p>
        </div>
        <button className="btn-glass" onClick={loadInvestigations}>🔄 Refresh</button>
      </header>

      <div className="glass-panel" style={{ padding: '1rem 1.25rem', marginBottom: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search investigations..."
          style={{ minWidth: '260px', flex: 1 }}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="needs_review">Needs Review</option>
          <option value="resolved">Resolved</option>
          <option value="archived">Archived</option>
        </select>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{filtered.length} visible</div>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-secondary)' }}>Loading investigations...</div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel" style={{ padding: '1.25rem', color: 'var(--text-secondary)' }}>
          No saved investigations match the current filters.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
          {filtered.map((item) => (
            <div key={item.id} className="glass-panel" style={{ padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, color: 'white' }}>{item.name}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    Story {item.story_id} · {new Date(item.updated_at || item.created_at || '').toLocaleString()}
                  </div>
                </div>
                <span style={{
                  fontSize: '0.68rem',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '999px',
                  background: item.status === 'resolved'
                    ? 'rgba(34,197,94,0.16)'
                    : item.status === 'archived'
                      ? 'rgba(100,116,139,0.2)'
                      : item.status === 'needs_review'
                        ? 'rgba(245,158,11,0.16)'
                        : 'rgba(59,130,246,0.16)',
                  color: item.status === 'resolved'
                    ? '#4ade80'
                    : item.status === 'archived'
                      ? '#cbd5e1'
                      : item.status === 'needs_review'
                        ? '#fbbf24'
                        : '#93c5fd',
                }}>
                  {(item.status || 'open').replace('_', ' ').toUpperCase()}
                </span>
              </div>

              {item.summary && (
                <div style={{ fontSize: '0.84rem', color: '#e2e8f0', lineHeight: 1.45 }}>{item.summary}</div>
              )}
              {item.findings && (
                <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {item.findings}
                </div>
              )}

              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                Run: {item.selected_run_guid ? `${item.selected_run_guid.slice(0, 8)}...` : 'All runs'} · Artifacts: {(item.artifacts || []).length}
              </div>

              {item.screenshot_data_url && (
                <img
                  src={item.screenshot_data_url}
                  alt={item.name}
                  style={{ width: '100%', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}
                />
              )}

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                <button className="btn-primary" onClick={() => onOpenInvestigation(item)} style={{ fontSize: '0.8rem' }}>
                  Open Investigation
                </button>
                <button className="btn-glass" onClick={() => duplicateInvestigation(item)} style={{ fontSize: '0.8rem' }}>
                  Duplicate
                </button>
                <button className="btn-glass" onClick={() => exportInvestigation(item)} style={{ fontSize: '0.8rem' }}>
                  Export
                </button>
                <button className="btn-glass" onClick={() => deleteInvestigation(item)} style={{ fontSize: '0.8rem', color: '#f87171' }}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
