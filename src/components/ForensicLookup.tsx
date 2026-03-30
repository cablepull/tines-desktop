/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { useLogger } from '../context/LogContext';

interface ForensicLookupProps {
  tenant: string;
  apiKey: string;
  onOpenStory: (storyId: number, mode?: 'live' | 'test' | 'draft', draftId?: number, actionId?: number) => void;
}

interface LookupState {
  event: any | null;
  story: any | null;
  run: any | null;
  action: any | null;
  logs: any[];
  lineage: any[];
  retentionGap?: string | null;
}

async function fetchJson(url: string, headers: Record<string, string>) {
  const resp = await fetch(url, { headers });
  const text = await resp.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!resp.ok) {
    const message = typeof body === 'string' ? body : body?.error || body?.message || `HTTP ${resp.status}`;
    const err = new Error(message);
    (err as any).status = resp.status;
    throw err;
  }

  return body;
}

export default function ForensicLookup({ tenant, apiKey, onOpenStory }: ForensicLookupProps) {
  const [eventId, setEventId] = useState('');
  const [runGuid, setRunGuid] = useState('');
  const [storyId, setStoryId] = useState('');
  const [lookupState, setLookupState] = useState<LookupState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addLog } = useLogger();

  const basePath = tenant.startsWith('http') ? tenant : `https://${tenant}`;
  const headers = { Authorization: `Bearer ${apiKey}` };

  const resolveLineage = async (seedEvent: any) => {
    const previousIds: number[] = Array.isArray(seedEvent?.previous_event_ids) ? seedEvent.previous_event_ids : [];
    const lineageEvents: any[] = [];

    for (const prevId of previousIds.slice(0, 10)) {
      try {
        const prev = await fetchJson(`${basePath}/api/v1/events/${prevId}`, headers);
        lineageEvents.push(prev);
      } catch (err: any) {
        lineageEvents.push({ id: prevId, unavailable: true, reason: err.message });
      }
    }

    return lineageEvents;
  };

  const handleLookup = async () => {
    setLoading(true);
    setError(null);
    setLookupState(null);

    try {
      let resolvedEvent: any | null = null;
      let resolvedStoryId = storyId.trim() ? Number(storyId.trim()) : null;
      let resolvedRunGuid = runGuid.trim() || null;

      if (eventId.trim()) {
        addLog('NETWORK', `Forensic lookup: fetching event ${eventId.trim()}`);
        resolvedEvent = await fetchJson(`${basePath}/api/v1/events/${eventId.trim()}`, headers);
        resolvedStoryId = Number(resolvedEvent.story_id || resolvedEvent.story?.id || resolvedStoryId);
        resolvedRunGuid = resolvedRunGuid || resolvedEvent.story_run_guid || resolvedEvent.execution_run_guid || null;
      }

      if (!resolvedStoryId) {
        throw new Error('Story ID is required when looking up a run without an event ID.');
      }

      const [story, actionsPayload, run, lineage] = await Promise.all([
        fetchJson(`${basePath}/api/v1/stories/${resolvedStoryId}?include_live_activity=true`, headers),
        fetchJson(`${basePath}/api/v1/actions?story_id=${resolvedStoryId}&per_page=500&include_live_activity=true`, headers),
        resolvedRunGuid
          ? fetchJson(`${basePath}/api/v1/stories/${resolvedStoryId}/runs/${resolvedRunGuid}`, headers).catch((err: any) => {
              if (err.status === 404) {
                return { unavailable: true, retentionGap: `Run ${resolvedRunGuid} could not be retrieved. It may be outside retention.` };
              }
              throw err;
            })
          : Promise.resolve(null),
        resolvedEvent ? resolveLineage(resolvedEvent) : Promise.resolve([]),
      ]);

      const actionList = actionsPayload?.actions || actionsPayload?.agents || (Array.isArray(actionsPayload) ? actionsPayload : []);
      const resolvedAction = resolvedEvent
        ? actionList.find((item: any) => Number(item.id) === Number(resolvedEvent.action_id || resolvedEvent.agent_id))
        : null;

      let logs: any[] = [];
      if (resolvedAction?.id) {
        const logsPayload = await fetchJson(`${basePath}/api/v1/actions/${resolvedAction.id}/logs?per_page=100`, headers).catch((err: any) => {
          if (err.status === 404) return [];
          throw err;
        });
        const rawLogs = logsPayload?.logs || logsPayload || [];
        logs = Array.isArray(rawLogs)
          ? rawLogs.filter((log: any) => !resolvedRunGuid || (log.story_run_guid || log.run_guid || log.execution_run_guid) === resolvedRunGuid)
          : [];
      }

      const retentionGap = !resolvedEvent
        ? null
        : run?.retentionGap || run?.unavailable
          ? run.retentionGap || 'Run details are no longer available from the API.'
          : null;

      setLookupState({
        event: resolvedEvent,
        story,
        run,
        action: resolvedAction,
        logs,
        lineage,
        retentionGap,
      });

      addLog('SUCCESS', `Forensic lookup resolved story ${resolvedStoryId}${resolvedRunGuid ? ` run ${resolvedRunGuid}` : ''}`);
    } catch (err: any) {
      const message = err.message || 'Lookup failed';
      setError(message);
      addLog('ERROR', 'Forensic lookup failed', { error: message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', border: '1px solid rgba(96, 165, 250, 0.2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Forensic Lookup</h3>
          <p style={{ margin: '0.35rem 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Fetch deep context directly from Tines by old Event ID and Story Run GUID.
          </p>
        </div>
        {lookupState?.story?.id && (
          <button
            className="btn-glass"
            onClick={() => onOpenStory(Number(lookupState.story.id), 'live', undefined, lookupState.action?.id)}
            style={{ fontSize: '0.8rem' }}
          >
            Open Story
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.6fr 1fr auto', gap: '0.75rem', alignItems: 'end', marginBottom: '1rem' }}>
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>EVENT ID</div>
          <input value={eventId} onChange={(e) => setEventId(e.target.value)} placeholder="10529716683" />
        </div>
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>STORY RUN GUID</div>
          <input value={runGuid} onChange={(e) => setRunGuid(e.target.value)} placeholder="5a9e4adb-6ed9-484b-b5b8-303a1093c656" />
        </div>
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>STORY ID</div>
          <input value={storyId} onChange={(e) => setStoryId(e.target.value)} placeholder="Optional if Event ID resolves it" />
        </div>
        <button className="btn-primary" onClick={handleLookup} disabled={loading} style={{ height: '42px' }}>
          {loading ? 'Looking up...' : 'Lookup'}
        </button>
      </div>

      {error && (
        <div style={{ padding: '0.9rem 1rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#fda4af', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {lookupState && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr', gap: '1rem' }}>
          <div style={{ padding: '1rem', borderRadius: '10px', background: 'rgba(255,255,255,0.03)' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>EVENT</div>
            {lookupState.event ? (
              <>
                <div style={{ color: 'white', fontWeight: 600 }}>Event #{lookupState.event.id}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                  Action: {lookupState.action?.name || lookupState.event.action_id || lookupState.event.agent_id}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  Created: {new Date(lookupState.event.created_at).toLocaleString()}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#a78bfa', marginTop: '0.6rem', wordBreak: 'break-all' }}>
                  Run: {lookupState.event.story_run_guid || lookupState.event.execution_run_guid || 'Unknown'}
                </div>
                <pre style={{ marginTop: '0.75rem', maxHeight: '260px', overflow: 'auto', padding: '0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', color: '#cbd5e1', fontSize: '0.72rem' }}>
                  {JSON.stringify(lookupState.event, null, 2)}
                </pre>
              </>
            ) : (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No direct event was loaded. Run-only lookups require Story ID.</div>
            )}
          </div>

          <div style={{ padding: '1rem', borderRadius: '10px', background: 'rgba(255,255,255,0.03)' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>RUN / STORY CONTEXT</div>
            <div style={{ color: 'white', fontWeight: 600 }}>{lookupState.story?.name || `Story ${lookupState.story?.id}`}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
              Story ID: {lookupState.story?.id}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              Mode: {lookupState.run?.story_mode || lookupState.story?.story_mode || 'LIVE'}
            </div>
            {lookupState.retentionGap && (
              <div style={{ marginTop: '0.8rem', padding: '0.7rem 0.8rem', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', color: '#fcd34d', fontSize: '0.8rem' }}>
                {lookupState.retentionGap}
              </div>
            )}
            {lookupState.run && !lookupState.run.unavailable && (
              <pre style={{ marginTop: '0.75rem', maxHeight: '260px', overflow: 'auto', padding: '0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', color: '#cbd5e1', fontSize: '0.72rem' }}>
                {JSON.stringify(lookupState.run, null, 2)}
              </pre>
            )}
          </div>

          <div style={{ padding: '1rem', borderRadius: '10px', background: 'rgba(255,255,255,0.03)' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>LINEAGE / LOGS</div>
            <div style={{ fontSize: '0.8rem', color: 'white', fontWeight: 600, marginBottom: '0.6rem' }}>
              Upstream lineage
            </div>
            {lookupState.lineage.length > 0 ? lookupState.lineage.map((item) => (
              <div key={item.id} style={{ marginBottom: '0.6rem', padding: '0.6rem 0.7rem', borderRadius: '8px', background: 'rgba(0,0,0,0.25)' }}>
                <div style={{ color: item.unavailable ? '#fca5a5' : '#93c5fd', fontSize: '0.78rem', fontWeight: 600 }}>
                  Event #{item.id}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', marginTop: '0.2rem' }}>
                  {item.unavailable ? item.reason : `${item.action_id || item.agent_id || 'Unknown action'} · ${item.story_run_guid || 'No run guid'}`}
                </div>
              </div>
            )) : (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>No upstream events recorded on this event.</div>
            )}

            <div style={{ fontSize: '0.8rem', color: 'white', fontWeight: 600, marginTop: '1rem', marginBottom: '0.6rem' }}>
              Action logs in this run
            </div>
            {lookupState.logs.length > 0 ? lookupState.logs.slice(0, 8).map((log, index) => (
              <div key={index} style={{ marginBottom: '0.55rem', padding: '0.6rem 0.7rem', borderRadius: '8px', background: 'rgba(0,0,0,0.25)' }}>
                <div style={{ color: log.level === 4 ? '#fca5a5' : '#cbd5e1', fontSize: '0.72rem', fontWeight: 600 }}>
                  {new Date(log.created_at).toLocaleString()}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', marginTop: '0.2rem', wordBreak: 'break-word' }}>
                  {log.message}
                </div>
              </div>
            )) : (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>No action logs matched this run.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
