/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { useLogger } from '../context/LogContext';

interface EditorLabsPanelProps {
  tenant: string;
  apiKey: string;
}

export default function EditorLabsPanel({ tenant, apiKey }: EditorLabsPanelProps) {
  const [teams, setTeams] = useState<any[]>([]);
  const [labsUnlocked, setLabsUnlocked] = useState(false);
  const [scaffolding, setScaffolding] = useState(false);
  const [chaosStoryId, setChaosStoryId] = useState<number | null>(null);
  const [isCheckingChaos, setIsCheckingChaos] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);
  const { addLog } = useLogger();

  const basePath = `https://${tenant.replace('https://', '').replace(/\/$/, '')}`;
  const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    (async () => {
      try {
        const teamsResp = await fetch(`${basePath}/api/v1/teams?per_page=100`, { headers }).then((r) => r.json());
        setTeams(teamsResp?.teams || teamsResp || []);
      } catch (err: any) {
        addLog('ERROR', `Failed to load editor labs teams: ${err.message}`);
      }
    })();
  }, [basePath, apiKey]);

  const checkChaosStoryExists = async () => {
    setIsCheckingChaos(true);
    try {
      const resp = await fetch(`${basePath}/api/v1/stories?per_page=100`, { headers }).then((r) => r.json());
      const stories = resp?.stories || resp || [];
      const existing = (stories as any[]).find((s) => s.name.startsWith('🛠️ TEST-INTERNAL: Chaos & Latency Bed'));
      if (existing) {
        setChaosStoryId(existing.id);
        try {
          const actions = await fetch(`${basePath}/api/v1/actions?story_id=${existing.id}`, { headers }).then((r) => r.json());
          const entry = (actions?.actions || actions || []).find((a: any) => a.name === 'ChaosEntry' || a.name === 'Chaos Entry');
          if (entry?.guid) {
            const isTest = entry.story_mode === 'TEST' || entry.story_mode === 'test';
            const path = entry.options?.path || entry.guid;
            const secret = entry.options?.secret ? `/${entry.options.secret}` : '';
            setWebhookUrl(`${basePath}/webhook/${path}${secret}${isTest ? '?all_drafts=true' : ''}`);
          }
        } catch (e) {
          console.error('Failed to fetch chaos entry details:', e);
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
    if (labsUnlocked) checkChaosStoryExists();
  }, [labsUnlocked, tenant, apiKey]);

  const handleDeleteChaosStory = async () => {
    if (!chaosStoryId) return;
    setScaffolding(true);
    addLog('NETWORK', `Deleting Chaos Story (ID: ${chaosStoryId})...`);
    try {
      await fetch(`${basePath}/api/v1/stories/${chaosStoryId}`, { method: 'DELETE', headers });
      addLog('SUCCESS', 'Chaos Story deleted successfully.');
      setChaosStoryId(null);
      setWebhookUrl(null);
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
    addLog('NETWORK', chaosStoryId ? 'Resetting Chaos Story (Delete + Re-Scaffold)...' : 'Initializing Chaos Scaffolding (Parallel Forks + Errors)...');

    try {
      if (chaosStoryId) {
        await fetch(`${basePath}/api/v1/stories/${chaosStoryId}`, { method: 'DELETE', headers });
      }

      const teamId = teams[0].id;
      const storyRes = await fetch(`${basePath}/api/v1/stories`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: `🛠️ TEST-INTERNAL: Chaos & Latency Bed — ${new Date().toLocaleTimeString()}`, team_id: teamId })
      }).then((r) => r.json());

      const storyId = storyRes.id;
      addLog('SUCCESS', `Created Story: ${storyRes.name} (ID: ${storyId})`);

      const entry = await fetch(`${basePath}/api/v1/actions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: 'ChaosEntry',
          type: 'Agents::WebhookAgent',
          story_id: storyId,
          position: { x: 500, y: 50 },
          options: { get_response_body: 'Chaos session initialized.', path: 'chaos', secret: 'unleash' }
        })
      }).then((r) => r.json());

      const isTest = entry.story_mode === 'TEST' || entry.story_mode === 'test';
      setWebhookUrl(`${basePath}/webhook/chaos/unleash${isTest ? '?all_drafts=true' : ''}`);

      const explode = await fetch(`${basePath}/api/v1/actions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: 'Explode Array (x5)',
          type: 'Agents::EventTransformationAgent',
          story_id: storyId,
          source_ids: [entry.id],
          position: { x: 500, y: 180 },
          options: { mode: 'message_only', message: '[{"id":1},{"id":2},{"id":3},{"id":4},{"id":5}]' }
        })
      }).then((r) => r.json());

      const workers = [
        { name: 'Success (200)', url: 'https://httpbin.org/status/200', x: 100, y: 350 },
        { name: 'Not Found (404)', url: 'https://httpbin.org/status/404', x: 300, y: 350 },
        { name: 'Auth Error (401)', url: 'https://httpbin.org/status/401', x: 500, y: 350 },
        { name: 'Server Error (500)', url: 'https://httpbin.org/status/500', x: 700, y: 350 },
        { name: 'Latency (2s)', url: 'https://httpbin.org/delay/2', x: 900, y: 350 }
      ];

      const workerIds = [];
      for (const w of workers) {
        const res = await fetch(`${basePath}/api/v1/actions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: w.name,
            type: 'Agents::HTTPRequestAgent',
            story_id: storyId,
            source_ids: [explode.id],
            position: { x: w.x, y: w.y },
            options: { url: w.url, method: 'get' }
          })
        }).then((r) => r.json());
        workerIds.push(res.id);
      }

      await fetch(`${basePath}/api/v1/actions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: 'Implode & Report',
          type: 'Agents::EventTransformationAgent',
          story_id: storyId,
          source_ids: workerIds,
          position: { x: 500, y: 550 },
          options: { mode: 'message_only', message: 'Chaos processing complete.' }
        })
      });

      addLog('SUCCESS', 'Chaos Story Scaffolding Complete!');
      await checkChaosStoryExists();
    } catch (err: any) {
      addLog('ERROR', `Scaffolding failed: ${err.message}`);
    }
    setScaffolding(false);
  };

  const handleTriggerChaos = async () => {
    if (!webhookUrl) return;
    setTriggering(true);
    addLog('NETWORK', 'Triggering chaos webhook...');
    try {
      const resp = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'tines-desktop-editor', triggered_at: new Date().toISOString() })
      });
      if (!resp.ok) throw new Error(`Trigger failed with ${resp.status}`);
      addLog('SUCCESS', 'Chaos webhook triggered.');
    } catch (err: any) {
      addLog('ERROR', `Chaos trigger failed: ${err.message}`);
    }
    setTriggering(false);
  };

  return (
    <div className="glass-panel" style={{ padding: '1.5rem', borderColor: 'rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.04)' }}>
      <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#f87171', marginBottom: '0.75rem', letterSpacing: '0.08em' }}>EDITOR LABS</div>
      <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
        These tools mutate the remote tenant and are intentionally isolated here. They are useful for testing, but they are not production-safe UX yet.
      </div>

      <button
        onClick={() => setLabsUnlocked((value) => !value)}
        className="btn-glass"
        style={{
          padding: '0.6rem 1rem',
          borderColor: labsUnlocked ? 'var(--accent-color)' : 'rgba(239, 68, 68, 0.4)',
          color: labsUnlocked ? 'white' : '#f87171',
          background: labsUnlocked ? 'var(--accent-color)' : 'transparent'
        }}
      >
        {labsUnlocked ? '🔓 Labs Unlocked' : '🔒 Unlock Labs'}
      </button>

      {labsUnlocked && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
          <div style={{ padding: '1rem', borderRadius: '10px', background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
            <div>
              <div style={{ fontWeight: 600, color: 'white' }}>{chaosStoryId ? 'Manage Chaos Test Bed' : 'Generate Chaos Story'}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                {chaosStoryId ? `A test bed is currently active on this tenant (ID: ${chaosStoryId}).` : 'Constructs a complex story with 5-way parallel forks, status errors, and explode/implode logic.'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {chaosStoryId ? (
                <>
                  <button onClick={handleCreateExecutionChaos} disabled={scaffolding} className="btn-glass" style={{ padding: '0.6rem 1rem', borderColor: 'var(--accent-color)', color: 'var(--accent-hover)' }}>
                    {scaffolding ? 'Resetting...' : '🧹 Reset Bed'}
                  </button>
                  <button onClick={handleDeleteChaosStory} disabled={scaffolding} className="btn-glass" style={{ padding: '0.6rem 1rem', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#f87171' }}>
                    {scaffolding ? 'Deleting...' : '🗑 Delete'}
                  </button>
                </>
              ) : (
                <button onClick={handleCreateExecutionChaos} disabled={scaffolding || isCheckingChaos} className="btn-primary" style={{ padding: '0.6rem 1rem', opacity: scaffolding || isCheckingChaos ? 0.5 : 1 }}>
                  {scaffolding ? 'Scaffolding...' : '⚡ Scaffold Story'}
                </button>
              )}
            </div>
          </div>

          {chaosStoryId && (
            <div style={{ padding: '1rem', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 600, color: 'white', fontSize: '0.85rem' }}>Webhook Endpoint</div>
                <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', fontWeight: 600 }}>Active</span>
              </div>
              {webhookUrl ? (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input readOnly value={webhookUrl} style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '0.5rem', color: '#60a5fa', fontSize: '0.75rem', outline: 'none' }} />
                  <button onClick={handleTriggerChaos} disabled={triggering} className="btn-primary" style={{ background: '#3b82f6', padding: '0.5rem 1rem', fontSize: '0.8rem' }}>
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
  );
}
