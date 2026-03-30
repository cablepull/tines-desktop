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
  const [labsUnlocked, setLabsUnlocked] = useState(false);
  const [scaffolding, setScaffolding] = useState(false);
  const [chaosStoryId, setChaosStoryId] = useState<number | null>(null);
  const [isCheckingChaos, setIsCheckingChaos] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);
  const { addLog } = useLogger();

  const basePath = `https://${tenant.replace('https://', '').replace(/\/$/, '')}`;
  const headers: Record<string, string> = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };

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

  const checkChaosStoryExists = async () => {
    setIsCheckingChaos(true);
    try {
      const resp = await fetch(`${basePath}/api/v1/stories?per_page=100`, { headers }).then(r => r.json());
      const stories = resp?.stories || resp || [];
      const existing = (stories as any[]).find(s => s.name.startsWith('🛠️ TEST-INTERNAL: Chaos & Latency Bed'));
      if (existing) {
        setChaosStoryId(existing.id);
        // Also try to find the entry point to get the URL
        try {
          const actions = await fetch(`${basePath}/api/v1/actions?story_id=${existing.id}`, { headers }).then(r => r.json());
          const entry = (actions?.actions || actions || []).find((a: any) => a.name === 'ChaosEntry' || a.name === 'Chaos Entry');
          if (entry?.guid) {
            // Tines allows triggering via /webhooks or /test/webhooks depending on story mode.
            // We'll store the one reported by the API but handle fallbacks during trigger.
            const isTest = entry.story_mode === 'TEST' || entry.story_mode === 'test';
            const path = entry.options?.path || entry.guid;
            const secret = entry.options?.secret ? `/${entry.options.secret}` : '';
            const url = `${basePath}/webhook/${path}${secret}${isTest ? '?all_drafts=true' : ''}`;
            setWebhookUrl(url);
          }
        } catch (e) {
          console.error("Failed to fetch entry details:", e);
        }
      } else {
        setChaosStoryId(null);
        setWebhookUrl(null);
      }
    } catch (err: any) {
      console.error('Failed to check chaos story:', err);
    }
    setIsCheckingChaos(false);
  };

  useEffect(() => {
    if (labsUnlocked) {
      checkChaosStoryExists();
    }
  }, [labsUnlocked, tenant, apiKey]);

  const handleDeleteChaosStory = async () => {
    if (!chaosStoryId) return;
    setScaffolding(true);
    addLog('NETWORK', `Deleting Chaos Story (ID: ${chaosStoryId})...`);
    try {
      await fetch(`${basePath}/api/v1/stories/${chaosStoryId}`, { method: 'DELETE', headers });
      addLog('SUCCESS', 'Chaos Story deleted successfully.');
      setChaosStoryId(null);
    } catch (err: any) {
      addLog('ERROR', `Deletion failed: ${err.message}`);
    }
    setScaffolding(false);
  };

  const handleCreateExecutionChaos = async () => {
    if (!teams.length) {
      addLog('ERROR', 'No teams available to scaffold chaos story.');
      return;
    }

    setScaffolding(true);
    addLog('NETWORK', chaosStoryId ? 'Resetting Chaos Story (Delete + Re-Scaffold)...' : 'Initialing Chaos Scaffolding (Parallel Forks + Errors)...');
    
    try {
      if (chaosStoryId) {
        addLog('NETWORK', `Removing existing story ${chaosStoryId} first...`);
        await fetch(`${basePath}/api/v1/stories/${chaosStoryId}`, { method: 'DELETE', headers });
      }

      const teamId = teams[0].id;
      
      // 1. Create Story
      const storyRes = await fetch(`${basePath}/api/v1/stories`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: `🛠️ TEST-INTERNAL: Chaos & Latency Bed — ${new Date().toLocaleTimeString()}`, team_id: teamId })
      }).then(r => r.json());
      
      const storyId = storyRes.id;
      addLog('SUCCESS', `Created Story: ${storyRes.name} (ID: ${storyId})`);

      // 2. Webhook Entry
      const entry = await fetch(`${basePath}/api/v1/actions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: "ChaosEntry",
          type: "Agents::WebhookAgent",
          story_id: storyId,
          position: { x: 500, y: 50 },
          options: { 
            get_response_body: "Chaos session initialized.",
            path: "chaos",
            secret: "unleash"
          }
        })
      }).then(r => r.json());

      const isTest = entry.story_mode === 'TEST' || entry.story_mode === 'test';
      const url = `${basePath}/webhook/chaos/unleash${isTest ? '?all_drafts=true' : ''}`;
      setWebhookUrl(url);

      // 3. Explode (Emit 5)
      const explode = await fetch(`${basePath}/api/v1/actions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: "Explode Array (x5)",
          type: "Agents::EventTransformationAgent",
          story_id: storyId,
          source_ids: [entry.id],
          position: { x: 500, y: 180 },
          options: { mode: "message_only", message: "[{\"id\":1},{\"id\":2},{\"id\":3},{\"id\":4},{\"id\":5}]" }
        })
      }).then(r => r.json());

      // 4. Forks
      const workers = [
        { name: "Success (200)", url: "https://httpbin.org/status/200", x: 100, y: 350 },
        { name: "Not Found (404)", url: "https://httpbin.org/status/404", x: 300, y: 350 },
        { name: "Auth Error (401)", url: "https://httpbin.org/status/401", x: 500, y: 350 },
        { name: "Server Error (500)", url: "https://httpbin.org/status/500", x: 700, y: 350 },
        { name: "Latency (2s)", url: "https://httpbin.org/delay/2", x: 900, y: 350 }
      ];

      const workerIds = [];
      for (const w of workers) {
        const res = await fetch(`${basePath}/api/v1/actions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: w.name,
            type: "Agents::HTTPRequestAgent",
            story_id: storyId,
            source_ids: [explode.id],
            position: { x: w.x, y: w.y },
            options: { url: w.url, method: "get" }
          })
        }).then(r => r.json());
        workerIds.push(res.id);
      }

      // 5. Implode
      await fetch(`${basePath}/api/v1/actions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: "Implode & Report",
          type: "Agents::EventTransformationAgent",
          story_id: storyId,
          source_ids: workerIds,
          position: { x: 500, y: 550 },
          options: { mode: "message_only", message: "Chaos processing complete." }
        })
      });

      addLog('SUCCESS', 'Chaos Story Scaffolding Complete!');
      await checkChaosStoryExists(); // Refresh ID
      alert(`Successfully created Chaos Story: ${storyRes.name}\nNavigate to Dashboard to begin testing.`);
    } catch (err: any) {
      addLog('ERROR', `Scaffolding failed: ${err.message}`);
    }
    setScaffolding(false);
  };

  const handleTriggerChaos = async () => {
    if (!webhookUrl) return;
    setTriggering(true);
    addLog('NETWORK', 'Triggering Chaos Webhook...');
    
    const trigger = async (url: string) => {
      return await fetch(url, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: "manual", timestamp: new Date().toISOString() })
      });
    };

    try {
      let resp = await trigger(webhookUrl);
      
      // Fallback logic: If 404, the story might be in the opposite mode than reported
      if (resp.status === 404) {
        const altUrl = webhookUrl.includes('?all_drafts=true') 
          ? webhookUrl.split('?')[0]
          : `${webhookUrl}?all_drafts=true`;
        
        addLog('NETWORK', `404 encountered. Attempting fallback: ${altUrl}`);
        const altResp = await trigger(altUrl);
        if (altResp.ok) {
          resp = altResp;
          setWebhookUrl(altUrl); // Update for next time
          addLog('SUCCESS', 'Fallback successful. URL updated.');
        }
      }

      if (resp.ok) {
        addLog('SUCCESS', 'Chaos Triggered Successfully! Monitor the graph for event flow.');
        alert("Chaos has been unleashed! 🌊\nCheck the Dashboard to trace the events.");
      } else {
        const txt = await resp.text();
        addLog('ERROR', `Trigger failed (${resp.status}): ${txt}`);
        alert(`Trigger failed: ${resp.status}`);
      }
    } catch (err: any) {
      addLog('ERROR', `Trigger exception: ${err.message}`);
    }
    setTriggering(false);
  };

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
          {/* Danger Zone: Experimental Tools */}
          <div style={{ ...sectionStyle, marginTop: '4rem', padding: '2rem', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <div style={{ ...labelStyle, color: '#f87171' }}>DANGER ZONE — EXPERIMENTAL LABS</div>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <div>
                <div style={{ fontWeight: 600, color: 'white' }}>Unlock Experimental Testing Tools</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  Enable advanced story scaffolding and stress-testing utilities. Use with caution.
                </div>
              </div>
              <button 
                onClick={() => setLabsUnlocked(!labsUnlocked)}
                className="btn-glass"
                style={{ 
                  padding: '0.5rem 1rem', 
                  borderColor: labsUnlocked ? 'var(--accent-color)' : 'rgba(239, 68, 68, 0.4)',
                  color: labsUnlocked ? 'white' : '#f87171',
                  background: labsUnlocked ? 'var(--accent-color)' : 'transparent'
                 }}
              >
                {labsUnlocked ? '🔓 UNLOCKED' : '🔒 LOCKED'}
              </button>
            </div>

            {labsUnlocked && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'fadeIn 0.3s ease' }}>
                <div style={{ ...cardStyle, background: 'rgba(0,0,0,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'white' }}>
                      {chaosStoryId ? 'Manage Chaos Test Bed' : 'Generate Chaos Story'}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      {chaosStoryId 
                        ? `A test bed is currently active on this tenant (ID: ${chaosStoryId}).`
                        : 'Constructs a complex story with 5-way parallel forks, status errors, and explode/implode logic.'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    {chaosStoryId ? (
                      <>
                        <button 
                          onClick={handleCreateExecutionChaos}
                          disabled={scaffolding}
                          className="btn-glass"
                          style={{ padding: '0.6rem 1.25rem', borderColor: 'var(--accent-color)', color: 'var(--accent-hover)' }}
                        >
                          {scaffolding ? 'Resetting...' : '🧹 Reset Bed'}
                        </button>
                        <button 
                          onClick={handleDeleteChaosStory}
                          disabled={scaffolding}
                          className="btn-glass"
                          style={{ padding: '0.6rem 1.25rem', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#f87171' }}
                        >
                          {scaffolding ? 'Deleting...' : '🗑️ Delete'}
                        </button>
                      </>
                    ) : (
                      <button 
                        onClick={handleCreateExecutionChaos}
                        disabled={scaffolding || isCheckingChaos}
                        className="btn-primary"
                        style={{ background: 'var(--accent-color)', padding: '0.6rem 1.25rem', opacity: (scaffolding || isCheckingChaos) ? 0.5 : 1 }}
                      >
                        {scaffolding ? 'Scaffolding...' : '⚡ Scaffolding Story'}
                      </button>
                    )}
                  </div>
                </div>

                {chaosStoryId && (
                  <div style={{ ...cardStyle, background: 'rgba(59, 130, 246, 0.05)', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 600, color: 'white', fontSize: '0.85rem' }}>Webhook Endpoint</div>
                      <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', fontWeight: 600 }}>Active</span>
                    </div>
                    {webhookUrl ? (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input 
                          readOnly 
                          value={webhookUrl} 
                          style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '0.5rem', color: '#60a5fa', fontSize: '0.75rem', outline: 'none' }} 
                        />
                        <button 
                          onClick={handleTriggerChaos}
                          disabled={triggering}
                          className="btn-primary"
                          style={{ background: '#3b82f6', padding: '0.5rem 1rem', fontSize: '0.8rem', borderRadius: '4px', border: 'none', color: 'white', cursor: triggering ? 'not-allowed' : 'pointer' }}
                        >
                          {triggering ? '...' : '⚡ Trigger'}
                        </button>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Identifying endpoint...</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
