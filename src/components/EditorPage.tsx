import Dashboard from './Dashboard';
import EditorLabsPanel from './EditorLabsPanel';

interface EditorPageProps {
  tenant: string;
  apiKey: string;
  onSelectStory: (id: number, mode?: 'live' | 'test' | 'draft', draftId?: number, actionId?: number) => void;
}

export default function EditorPage({ tenant, apiKey, onSelectStory }: EditorPageProps) {
  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{ padding: '2rem 3rem 0 3rem' }}>
        <div className="glass-panel" style={{ padding: '1rem 1.25rem', marginBottom: '1rem', borderColor: 'rgba(239, 68, 68, 0.25)', background: 'rgba(239, 68, 68, 0.07)' }}>
          <div style={{ fontWeight: 800, color: '#f87171', fontSize: '0.85rem', letterSpacing: '0.08em', marginBottom: '0.35rem' }}>EDITOR WARNING</div>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            This section can mutate the remote Tines tenant and is not fully implemented. Use it deliberately. The normal `Dashboard` and story canvas are now browse-only.
          </div>
        </div>

        <EditorLabsPanel tenant={tenant} apiKey={apiKey} />
      </div>

      <Dashboard
        tenant={tenant}
        apiKey={apiKey}
        onSelectStory={onSelectStory}
        allowMutations
        showForensicLookup={false}
        title="Editor"
        subtitle="Create stories and open a mutable canvas. This surface is intentionally separated from investigation and read-only browsing."
      />
    </div>
  );
}
