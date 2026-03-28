interface SidebarProps {
  tenant: string;
  onLogout: () => void;
  onNavDashboard: () => void;
  onNavActions: () => void;
  onNavSettings: () => void;
  activePage: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: 'D' },
  { key: 'actions',   label: 'Actions',   icon: 'A' },
  { key: 'settings',  label: 'Settings',  icon: 'S' },
];

export default function Sidebar({ tenant, onLogout, onNavDashboard, onNavActions, onNavSettings, activePage, collapsed, onToggleCollapse }: SidebarProps) {
  const handlers: Record<string, () => void> = {
    dashboard: onNavDashboard,
    actions: onNavActions,
    settings: onNavSettings,
  };

  return (
    <div className="glass-panel" style={{
      width: collapsed ? '60px' : '220px',
      margin: '1rem',
      marginRight: 0,
      display: 'flex',
      flexDirection: 'column',
      padding: collapsed ? '1rem 0.5rem' : '1.5rem 1rem',
      transition: 'width 0.25s ease, padding 0.25s ease',
      overflow: 'hidden',
      flexShrink: 0
    }}>
      {/* Collapse Toggle */}
      <button 
        onClick={onToggleCollapse}
        className="btn-glass"
        style={{ 
          alignSelf: collapsed ? 'center' : 'flex-end', 
          padding: '4px 8px', fontSize: '0.85rem', marginBottom: '1rem',
          background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer'
        }}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? '▸' : '◂'}
      </button>

      {!collapsed && (
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
      )}

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
        {NAV_ITEMS.map(item => {
          const isActive = activePage === item.key;
          return (
            <button 
              key={item.key}
              onClick={handlers[item.key]}
              className={isActive ? 'btn-primary' : 'btn-glass'}
              style={{ 
                textAlign: collapsed ? 'center' : 'left',
                background: isActive ? 'var(--accent-color)' : 'transparent',
                border: isActive ? 'none' : undefined,
                padding: collapsed ? '0.5rem' : undefined,
                fontSize: collapsed ? '0.7rem' : undefined,
                overflow: 'hidden',
                whiteSpace: 'nowrap'
              }}
              title={item.label}
            >
              {collapsed ? item.icon : item.label}
            </button>
          );
        })}
      </nav>

      <div style={{ marginTop: 'auto' }}>
        <button 
          onClick={onLogout}
          className="btn-glass"
          style={{ width: '100%', color: 'var(--danger-color)', borderColor: 'rgba(239, 68, 68, 0.2)', overflow: 'hidden', whiteSpace: 'nowrap' }}
        >
          {collapsed ? '⏻' : 'Disconnect'}
        </button>
      </div>
    </div>
  );
}
