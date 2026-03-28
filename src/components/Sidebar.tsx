interface SidebarProps {
  tenant: string;
  onLogout: () => void;
  onNavDashboard: () => void;
}

export default function Sidebar({ tenant, onLogout, onNavDashboard }: SidebarProps) {
  return (
    <div className="glass-panel" style={{
      width: '260px',
      margin: '1rem',
      marginRight: 0,
      display: 'flex',
      flexDirection: 'column',
      padding: '1.5rem 1rem'
    }}>
      <div style={{ padding: '0 0.5rem', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Tines Desktop</h2>
        <div style={{ 
          fontSize: '0.75rem', 
          color: 'var(--accent-color)',
          marginTop: '0.25rem',
          wordBreak: 'break-all',
          opacity: 0.8
        }}>
          {tenant}
        </div>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
        {['Dashboard', 'Cases', 'Actions', 'Settings'].map((item, i) => (
          <button 
            key={item} 
            onClick={i === 0 ? onNavDashboard : undefined}
            className={i === 0 ? 'btn-primary' : 'btn-glass'}
            style={{ 
              textAlign: 'left',
              background: i === 0 ? 'var(--accent-color)' : 'transparent',
              border: i === 0 ? 'none' : undefined
            }}
          >
            {item}
          </button>
        ))}
      </nav>

      <div style={{ marginTop: 'auto' }}>
        <button 
          onClick={onLogout}
          className="btn-glass"
          style={{ width: '100%', color: 'var(--danger-color)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}
