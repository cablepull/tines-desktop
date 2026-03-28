/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { useLogger } from '../context/LogContext';

interface SettingsPageProps {
  tenant: string;
  apiKey: string;
}

export default function SettingsPage({ tenant, apiKey }: SettingsPageProps) {
  const [teams, setTeams] = useState<any[]>([]);
  const [credentials, setCredentials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { addLog } = useLogger();

  const basePath = `https://${tenant.replace('https://', '').replace(/\/$/, '')}`;
  const headers: Record<string, string> = { 'x-user-token': apiKey, 'Content-Type': 'application/json' };

  useEffect(() => {
    (async () => {
      setLoading(true);
      addLog('NETWORK', 'Fetching tenant settings (teams, credentials)...');
      try {
        const [teamsResp, credsResp] = await Promise.all([
          fetch(`${basePath}/api/v1/teams?per_page=100`, { headers }).then(r => r.json()),
          fetch(`${basePath}/api/v1/user_credentials?per_page=100`, { headers }).then(r => r.json()),
        ]);
        setTeams(teamsResp?.teams || teamsResp || []);
        setCredentials(credsResp?.user_credentials || credsResp || []);
        addLog('SUCCESS', `Loaded ${Array.isArray(teamsResp?.teams || teamsResp) ? (teamsResp?.teams || teamsResp).length : 0} teams, ${Array.isArray(credsResp?.user_credentials || credsResp) ? (credsResp?.user_credentials || credsResp).length : 0} credentials`);
      } catch (err: any) {
        addLog('ERROR', `Settings fetch failed: ${err.message}`);
      }
      setLoading(false);
    })();
  }, [tenant, apiKey]);

  const sectionStyle = { marginBottom: '2rem' };
  const cardStyle = { padding: '1rem 1.25rem', marginBottom: '0.5rem', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--glass-border)' };
  const labelStyle = { fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 as const, letterSpacing: '0.5px', marginBottom: '0.75rem' };

  return (
    <div style={{ flex: 1, padding: '2rem 3rem', overflowY: 'auto' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.25rem', fontWeight: 600 }}>Settings</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Tenant configuration and credential management</p>
      </header>

      {/* Tenant Info */}
      <div style={sectionStyle}>
        <div style={labelStyle}>TENANT CONNECTION</div>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--success-color)' }} />
            <div>
              <div style={{ fontWeight: 600, color: 'white' }}>{tenant}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Connected · API v1 · Key: ••••{apiKey.slice(-4)}</div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>Loading settings...</div>
      ) : (
        <>
          {/* Teams */}
          <div style={sectionStyle}>
            <div style={labelStyle}>TEAMS ({Array.isArray(teams) ? teams.length : 0})</div>
            {Array.isArray(teams) && teams.length > 0 ? teams.map((team: any) => (
              <div key={team.id} style={cardStyle}>
                <div style={{ fontWeight: 600, color: 'white' }}>{team.name || `Team ${team.id}`}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  ID: {team.id} {team.member_count !== undefined ? `· ${team.member_count} members` : ''}
                </div>
              </div>
            )) : (
              <div style={{ ...cardStyle, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No teams found or insufficient permissions</div>
            )}
          </div>

          {/* Credentials */}
          <div style={sectionStyle}>
            <div style={labelStyle}>CREDENTIALS ({Array.isArray(credentials) ? credentials.length : 0})</div>
            {Array.isArray(credentials) && credentials.length > 0 ? credentials.map((cred: any) => (
              <div key={cred.id} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'white' }}>{cred.name || 'Unnamed Credential'}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    {cred.mode || 'API Key'} · ID: {cred.id}
                  </div>
                </div>
                <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(34, 197, 94, 0.1)', color: 'var(--success-color)', fontWeight: 600 }}>
                  Active
                </span>
              </div>
            )) : (
              <div style={{ ...cardStyle, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No credentials found or insufficient permissions</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
