/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useMemo, useRef } from 'react';
import { Configuration, ActionsApi, StoriesApi } from 'tines-sdk';
import type { Action, Story } from 'tines-sdk';
import { useLogger } from '../context/LogContext';
import NodeInspector from './NodeInspector';
import DebugInspector from './DebugInspector';
import StoryLedger from './StoryLedger';
import { jsPDF } from 'jspdf';
import type { InvestigationRecord } from '../electron';
import { usePerformanceMonitor } from '../utils/usePerformanceMonitor';
import { 
  type SafetyTier, 
  type SafetyInfo, 
  SAFETY_TIERS, 
  getEffectiveSafety 
} from '../utils/safetyEngine';
import {
  classifyEventSignal,
  classifyLogSignal,
  classifyActionLiveSignal,
  classifyStoryLiveSignal,
  combineSignals,
  type DebugSignal,
} from '../utils/debugEvidence';

interface StoryViewProps {
  tenant: string;
  apiKey: string;
  storyContext: { storyId: number, mode: 'live' | 'test' | 'draft', draftId?: number };
  focusActionId?: number | null;
  investigationToLoad?: InvestigationRecord | null;
  onInvestigationLoaded?: () => void;
  editable?: boolean;
  onOpenInEditor?: () => void;
  onBack: () => void;
}

interface BoardNote {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
}

export default function StoryView({ tenant, apiKey, storyContext, focusActionId, investigationToLoad = null, onInvestigationLoaded, editable = false, onOpenInEditor, onBack }: StoryViewProps) {
  const { storyId } = storyContext;
  const getStoredDebugLookbackHours = () => {
    if (typeof window === 'undefined') return 24;
    const raw = window.localStorage.getItem('tinesDesktop.debugLookbackHours');
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 24;
  };
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const { addLog } = useLogger();
  const { startMeasure, endMeasure } = usePerformanceMonitor('StoryView');

  // Persistence State
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('synced');
  const [lastSaved, setLastSaved] = useState<Date | null>(new Date());

  const [actionName, setActionName] = useState('');
  const [actionType, setActionType] = useState('Agents::WebhookAgent');
  const [creating, setCreating] = useState(false);
  const [viewMode, setViewMode] = useState<'canvas' | 'json' | 'safety' | 'debug' | 'ledger'>('canvas');
  const [zoom, setZoom] = useState(1);
  const [toolsCollapsed, setToolsCollapsed] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [customLabels, setCustomLabels] = useState<Record<number, string>>({});
  const [tierOverrides, setTierOverrides] = useState<Record<number, SafetyTier>>({});
  const [showGrid, setShowGrid] = useState(false);
  const [canvasSearch, setCanvasSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightedNodeId, setHighlightedNodeId] = useState<number | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [inspectedNode, setInspectedNode] = useState<Action | null>(null);
  const [draggedNode, setDraggedNode] = useState<number | null>(null);
  const [nodeDragOffset, setNodeDragOffset] = useState({ x: 0, y: 0 });

  // Phase 38: Debug Trace State
  const [eventMap, setEventMap] = useState<Map<number, any[]>>(new Map());
  const [debugLoading, setDebugLoading] = useState(false);
  const [debugNode, setDebugNode] = useState<Action | null>(null);
  const [selectedRunGuid, setSelectedRunGuid] = useState<string | null>(null);
  const [lastEventFetch, setLastEventFetch] = useState<Date | null>(null);
  const [storyMetadata, setStoryMetadata] = useState<Story | null>(null);
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [executionPath, setExecutionPath] = useState<Set<number>>(new Set());
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<Set<number>>(new Set());
  const [actionLogMap, setActionLogMap] = useState<Map<number, any[]>>(new Map());
  const [recentRuns, setRecentRuns] = useState<any[]>([]);
  const [runActionIdsMap, setRunActionIdsMap] = useState<Map<string, number[]>>(new Map());
  const [investigations, setInvestigations] = useState<InvestigationRecord[]>([]);
  const [investigationName, setInvestigationName] = useState('');
  const [investigationStatus, setInvestigationStatus] = useState<'open' | 'needs_review' | 'resolved' | 'archived'>('open');
  const [investigationSummary, setInvestigationSummary] = useState('');
  const [investigationFindings, setInvestigationFindings] = useState('');
  const [investigationsOpen, setInvestigationsOpen] = useState(false);
  const [savingInvestigation, setSavingInvestigation] = useState(false);
  const [selectedInvestigationId, setSelectedInvestigationId] = useState<string | null>(null);
  const [debugLookbackHours, setDebugLookbackHours] = useState(getStoredDebugLookbackHours);
  const [ledgerRefreshVersion, setLedgerRefreshVersion] = useState(0);
  const [debugBarExpanded, setDebugBarExpanded] = useState(true);

  const normalizeRunGuid = (item: any) => item.story_run_guid || item.run_guid || item.execution_run_guid || null;
  const hydrateCachedEvent = (evt: any) => ({
    ...evt,
    story_run_guid: normalizeRunGuid(evt),
    run_guid: evt.run_guid || normalizeRunGuid(evt),
  });
  const hydrateCachedLog = (log: any) => ({
    ...log,
    story_run_guid: normalizeRunGuid(log),
    run_guid: log.run_guid || normalizeRunGuid(log),
  });

  const getSignalDisplay = (signal: DebugSignal) => {
    switch (signal) {
      case 'blocked':
        return { icon: '⛔', color: '#ef4444', label: 'Flow-blocking' };
      case 'external':
        return { icon: '🌐', color: '#f97316', label: 'External issue' };
      case 'warning':
        return { icon: '⚠️', color: '#f59e0b', label: 'Advisory' };
      case 'ok':
        return { icon: '✅', color: '#22c55e', label: 'Healthy' };
      default:
        return { icon: '⏸', color: '#64748b', label: 'No events' };
    }
  };

  // Helper: classify the health of a node based on its events
  const getNodeHealth = (actionId: number): DebugSignal => {
    const act = actions.find(a => a.id === actionId);
    if (!act) return 'none';

    let events = eventMap.get(actionId) || [];
    let logs = actionLogMap.get(actionId) || [];
    
    // Run Isolation [D2]
    if (selectedRunGuid) {
      events = events.filter(e => e.story_run_guid === selectedRunGuid);
      logs = logs.filter(l => (l.story_run_guid || l.run_guid || l.execution_run_guid || l.inbound_event?.story_run_guid || null) === selectedRunGuid);
    }
    
    const eventSignals = events.map(classifyEventSignal);
    const logSignals = logs.map(classifyLogSignal).filter((signal) => signal !== 'ok');
    const liveSignal = classifyActionLiveSignal(act);
    return combineSignals([...eventSignals, ...logSignals, liveSignal]);
  };

  // Phase 38: Pre-compute debug stats (must use useMemo, not IIFE in JSX)

  const debugStats = useMemo(() => {
    let totalEvents = 0, okEvents = 0, blockedEvents = 0, externalEvents = 0, warningEvents = 0;
    let firstErrorActionId: number | undefined;
    const runGuids = new Set<string>();

    eventMap.forEach((evts, actionId) => {
      evts.forEach((e: any) => {
        if (e.story_run_guid) runGuids.add(e.story_run_guid);
        if (selectedRunGuid && e.story_run_guid !== selectedRunGuid) return;

        totalEvents++;
        const signal = classifyEventSignal(e);
        if (signal === 'blocked') { 
          blockedEvents++; 
          if (firstErrorActionId == null) firstErrorActionId = actionId;
        } else if (signal === 'external') {
          externalEvents++;
        } else if (signal === 'warning') {
          warningEvents++;
        } else if (signal === 'ok') {
          okEvents++;
        }
      });
    });

    const blockedActions = actions.filter(a => getNodeHealth(a.id!) === 'blocked').length;
    const externalActions = actions.filter(a => getNodeHealth(a.id!) === 'external').length;
    
    const warningActions = actions.filter(a => {
        const h = getNodeHealth(a.id!);
        return h === 'warning';
    }).length;

    const { pending_action_runs_count = 0 } = (storyMetadata as any) || {};
    const liveStorySignal = classifyStoryLiveSignal(storyMetadata);
    const executionSignal: DebugSignal = blockedActions > 0 || blockedEvents > 0
      ? 'blocked'
      : externalActions > 0 || externalEvents > 0
        ? 'external'
        : warningActions > 0
          ? 'warning'
          : totalEvents > 0
            ? 'ok'
            : 'none';
    const overallSignal: DebugSignal = combineSignals([liveStorySignal, executionSignal]);
    
    return { 
      totalEvents, 
      okEvents, 
      blockedEvents,
      externalEvents,
      warningEvents, 
      blockedActions,
      externalActions,
      warningActions,
      firstErrorActionId, 
      runGuids: Array.from(runGuids), 
      pendingRuns: pending_action_runs_count,
      executionSignal,
      liveStorySignal,
      overallSignal,
      overallDisplay: getSignalDisplay(overallSignal),
      // Backward-compatible aliases for existing UI reads.
      errorEvents: blockedEvents,
      failingActions: blockedActions,
    };
  }, [eventMap, selectedRunGuid, storyMetadata, actions, actionLogMap]);

  const [notes, setNotes] = useState<BoardNote[]>([]);
  const [nextNoteId, setNextNoteId] = useState(1);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [draggedNoteId, setDraggedNoteId] = useState<number | null>(null);
  const [noteDragOffset, setNoteDragOffset] = useState({ x: 0, y: 0 });

  const liveActivityStats = useMemo(() => {
    let blockedActions = 0;
    let warningActions = 0;
    let okActions = 0;

    actions.forEach((action) => {
      const signal = classifyActionLiveSignal(action);
      if (signal === 'blocked') blockedActions += 1;
      else if (signal === 'warning') warningActions += 1;
      else if (signal === 'ok') okActions += 1;
    });

    return {
      blockedActions,
      warningActions,
      okActions,
      storySignal: classifyStoryLiveSignal(storyMetadata),
      notWorkingActions: Number((storyMetadata as any)?.not_working_actions_count || 0),
      pendingRuns: Number((storyMetadata as any)?.pending_action_runs_count || 0),
      concurrentRuns: Number((storyMetadata as any)?.concurrent_runs_count || 0),
      tokensUsedPercentage: Number((storyMetadata as any)?.tokens_used_percentage || 0),
    };
  }, [actions, storyMetadata]);

  // Constants
  const NODE_W = 240, NODE_H = 120;

  // Connection State
  const [connectingFromId, setConnectingFromId] = useState<number | null>(null);
  const [dragMousePos, setDragMousePos] = useState({ x: 0, y: 0 });

  // Phase 28: Multi-Tier Safeguards
  const [safetyLock, setSafetyLock] = useState(true);

  // --- API / Infrastructure ---

  const actionsApi = useMemo(() => {
    const basePath = tenant.startsWith('http') ? tenant : `https://${tenant}`;
    const config = new Configuration({ basePath, accessToken: apiKey });
    return new ActionsApi(config);
  }, [tenant, apiKey]);

  const storiesApi = useMemo(() => {
    const basePath = tenant.startsWith('http') ? tenant : `https://${tenant}`;
    return new StoriesApi(new Configuration({ basePath, accessToken: apiKey }));
  }, [tenant, apiKey]);

  const appendStoryModeParams = (url: string) => {
    const { mode, draftId } = storyContext;
    const delimiter = url.includes('?') ? '&' : '?';
    const params = new URLSearchParams();

    if (mode === 'test') params.set('story_mode', 'TEST');
    if (mode === 'draft') {
      params.set('story_mode', 'BUILD');
      if (draftId) params.set('draft_id', String(draftId));
    }

    const serialized = params.toString();
    return serialized ? `${url}${delimiter}${serialized}` : url;
  };

  const mergeEventsIntoMap = (events: any[]) => {
    if (!events.length) return;

    setEventMap((prev) => {
      const next = new Map(prev);

      events.forEach((rawEvt) => {
        const evt = hydrateCachedEvent(rawEvt);
        const rawAid = evt.action_id || evt.agent_id;
        if (rawAid == null) return;
        const actionId = Number(rawAid);
        if (!Number.isFinite(actionId)) return;

        const existing = next.get(actionId) || [];
        const index = existing.findIndex((candidate) => String(candidate.id) === String(evt.id));
        if (index >= 0) {
          existing[index] = { ...existing[index], ...evt };
        } else {
          existing.push(evt);
        }
        existing.sort((a, b) => new Date(String(b.created_at || 0)).getTime() - new Date(String(a.created_at || 0)).getTime());
        next.set(actionId, [...existing]);
      });

      return next;
    });
  };

  const getRunTimestamp = (run: any) => {
    const timestamp = run?.started_at || run?.created_at || run?.updated_at || run?.completed_at || null;
    return timestamp ? new Date(timestamp).getTime() : 0;
  };

  const parseRunsPayload = (payload: any) => {
    const runs = payload?.runs || payload?.story_runs || payload?.execution_runs || (Array.isArray(payload) ? payload : []);
    return Array.isArray(runs) ? runs : [];
  };

  const extractRunEvents = (payload: any) => {
    const candidates = [
      payload?.events,
      payload?.story_events,
      payload?.execution_events,
      payload?.run_events,
      payload?.run?.events,
      payload?.data?.events,
    ];
    const found = candidates.find((candidate) => Array.isArray(candidate));
    return Array.isArray(found) ? found : [];
  };

  const deriveActionIdsFromRunPayload = (payload: any) => {
    const ids = new Set<number>();

    extractRunEvents(payload).forEach((event: any) => {
      const actionId = Number(event?.action_id || event?.agent_id);
      if (Number.isFinite(actionId)) ids.add(actionId);
    });

    const candidateCollections = [
      payload?.actions,
      payload?.agents,
      payload?.nodes,
      payload?.steps,
      payload?.run?.actions,
      payload?.data?.actions,
    ];
    candidateCollections.forEach((collection) => {
      if (!Array.isArray(collection)) return;
      collection.forEach((item: any) => {
        const actionId = Number(item?.action_id || item?.agent_id || item?.id);
        if (Number.isFinite(actionId)) ids.add(actionId);
      });
    });

    return Array.from(ids);
  };

  const fetchStoryMetadata = async () => {
    try {
      const { mode, draftId } = storyContext;
      const basePath = tenant.startsWith('http') ? tenant : `https://${tenant}`;
      
      let url = `${basePath}/api/v1/stories/${storyId}?include_live_activity=true`;
      if (mode === 'test') url += '&story_mode=TEST';
      if (mode === 'draft') {
        url += '&story_mode=BUILD';
        if (draftId) url += `&draft_id=${draftId}`;
      }

      const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${apiKey}` } });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const meta = await resp.json();

      setStoryMetadata(meta);
      if (meta.locked) {
        addLog('INFO', 'Story is locked on server');
      }
    } catch (err: any) {
      addLog('ERROR', 'Failed to fetch story metadata', { error: err.message });
    }
  };

  const toggleServerLock = async () => {
    if (!storyMetadata || !storyMetadata.id) return;
    const newStatus = !storyMetadata.locked;
    addLog('NETWORK', `${newStatus ? 'Locking' : 'Unlocking'} story on server...`);
    setSyncStatus('syncing');
    try {
      await storiesApi.updateStory({
        storyId: storyMetadata.id,
        storyUpdateRequest: { locked: newStatus }
      });
      setSyncStatus('synced');
      setLastSaved(new Date());
      fetchStoryMetadata(); // Refresh status
    } catch (err: any) {
      setSyncStatus('error');
      addLog('ERROR', 'Failed to update server lock', { error: err.message });
    }
  };

  const fetchActions = async () => {
    startMeasure('StoryLoad');
    try {
      setLoading(true);
      const { mode, draftId } = storyContext;
      addLog('NETWORK', `Fetching Story ${storyId} actions (Mode: ${mode})...`);
      
      const basePath = tenant.startsWith('http') ? tenant : `https://${tenant}`;
      let url = `${basePath}/api/v1/actions?story_id=${storyId}&per_page=500&include_live_activity=true`;
      if (mode === 'test') url += '&story_mode=TEST';
      if (mode === 'draft') {
        url += '&story_mode=BUILD';
        if (draftId) url += `&draft_id=${draftId}`;
      }

      const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${apiKey}` } });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const res = await resp.json();
      
      const rawActions = res.actions || res.agents || (Array.isArray(res) ? res : []);
      addLog('DEBUG', `Hydrated ${rawActions.length} actions from API response`);
      setActions(rawActions);
      endMeasure('StoryLoad');
      
      if (rawActions.length > 0) {
        setTimeout(() => recenterCanvas(rawActions), 100);
      }
    } catch (err: any) {
      addLog('ERROR', 'Failed to fetch actions', { error: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchActions(); 
    fetchStoryMetadata();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyId, storyContext.mode, storyContext.draftId, tenant, apiKey, storiesApi]);

  const loadInvestigations = async () => {
    if (!window.electronAPI) return;
    try {
      const records = await window.electronAPI.dbListInvestigations({ storyId: Number(storyId), limit: 20 });
      setInvestigations(records);
      setSelectedInvestigationId((current) => current && records.find((item) => item.id === current) ? current : records[0]?.id || null);
    } catch (err) {
      console.error('DuckDB: Failed to load investigations', err);
    }
  };

  // Phase 38: Fetch all events for the story to assess health
  useEffect(() => {
    // Clear maps on story switch to ensure irrelevance is avoided
    setEventMap(new Map());
    setActionLogMap(new Map());
    setRecentRuns([]);
    setRunActionIdsMap(new Map());
    setRunDebugSummary(null);
    setSelectedRunGuid(null);
    hydratedRunLogCacheRef.current.clear();
    hydratedRunEvidenceCacheRef.current.clear();
    fetchRecentRuns(true);
    fetchEvents(true);
    loadInvestigations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyId]);

  const fetchRecentRuns = async (forceRefresh = false) => {
    if (!forceRefresh && recentRuns.length > 0) return recentRuns;

    const basePath = tenant.startsWith('http') ? tenant : `https://${tenant}`;
    try {
      addLog('NETWORK', `Fetching recent runs for Story ${storyId}...`, { forceRefresh });
      const resp = await fetch(
        appendStoryModeParams(`${basePath}/api/v1/stories/${storyId}/runs?per_page=50`),
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const runs = parseRunsPayload(data)
        .filter((run: any) => run?.guid || run?.story_run_guid || run?.id)
        .sort((a: any, b: any) => getRunTimestamp(b) - getRunTimestamp(a));
      setRecentRuns(runs);
      addLog('DEBUG', `Hydrated ${runs.length} recent runs for Story ${storyId}`, {
        topRunGuids: runs.slice(0, 5).map((run: any) => run.guid || run.story_run_guid || run.run_guid || run.id),
      });
      return runs;
    } catch (err: any) {
      addLog('WARNING', `Recent runs fetch failed: ${err.message}`);
      return [];
    }
  };

  // Phase 38: Fetch Story Events for Debug Mode
  const fetchEvents = async (forceRefresh = false) => {
    setDebugLoading(true);
    
    // Phase 53: Try local DuckDB first if not forcing refresh
    if (!forceRefresh && window.electronAPI) {
      try {
        const localEvents = await window.electronAPI.dbGetEvents({ storyId: Number(storyId) });
        if (localEvents && localEvents.length > 0) {
          addLog('DEBUG', `Loaded ${localEvents.length} events from local DuckDB cache`);
          const map = new Map<number, any[]>();
          localEvents.forEach((rawEvt: any) => {
            const evt = hydrateCachedEvent(rawEvt);
            const rawAid = evt.action_id || evt.agent_id;
            if (rawAid != null) {
              const aid = Number(rawAid);
              if (!map.has(aid)) map.set(aid, []);
              map.get(aid)!.push(evt);
            }
          });
          setEventMap(map);
          setDebugLoading(false);
          return;
        }
      } catch (e) {
        console.error('DuckDB: Failed to load events', e);
      }
    }

    addLog('NETWORK', `Fetching execution events for Story ${storyId} from Tines...`);
    const basePath = tenant.startsWith('http') ? tenant : `https://${tenant}`;
    try {
      const resp = await fetch(
        appendStoryModeParams(`${basePath}/api/v1/events?story_id=${storyId}&per_page=500`),
        { headers: { 'Authorization': `Bearer ${apiKey}` } }
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const events: any[] = data.events || data.agents || (Array.isArray(data) ? data : []);

      // Group by action_id
      const map = new Map<number, any[]>();
      events.forEach(evt => {
        const rawAid = evt.action_id || evt.agent_id;
        if (rawAid != null) {
          const aid = Number(rawAid);
          if (!map.has(aid)) map.set(aid, []);
          map.get(aid)!.push(evt);
        }
      });
      setEventMap(map);
      setLastEventFetch(new Date());
      addLog('SUCCESS', `Loaded ${events.length} events across ${map.size} actions`);

      // Phase 53/55: Persist to DuckDB with traceability
      if (window.electronAPI && events.length > 0) {
        window.electronAPI.dbSaveEvents(events.map(e => ({ 
          ...e, 
          story_id: Number(storyId),
          run_guid: e.story_run_guid || e.execution_run_guid || null 
        })));
      }
    } catch (err: any) {
      addLog('ERROR', `Event fetch failed: ${err.message}`);
    }
    setDebugLoading(false);
  };

  // Phase 41: Fetch Story Logs [E2]
  // Removed fetchStoryLogs as it uses a deprecated/unavailable /api/v1/logs endpoint
  // that was causing 404 errors. Execution traces are now fully handled via fetchEvents.

  useEffect(() => {
    if (viewMode !== 'debug') return;
    const interval = setInterval(() => {
      fetchRecentRuns();
      fetchEvents();
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, storyId, tenant, apiKey]);

  // Phase 49: Fetch Action Logs for suspect actions [E2]
  const [runDebugSummary, setRunDebugSummary] = useState<{ story_id: number; run_guid?: string | null; since_iso?: string | null; events: any[]; logs: any[] } | null>(null);
  const hydratedRunLogCacheRef = useRef<Set<string>>(new Set());
  const hydratedRunEvidenceCacheRef = useRef<Set<string>>(new Set());
  const hydratingScopeKeysRef = useRef<Set<string>>(new Set());

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const runWithConcurrencyLimit = async <T,>(items: T[], concurrency: number, worker: (item: T) => Promise<void>) => {
    if (items.length === 0) return;

    let index = 0;
    const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (index < items.length) {
        const current = items[index++];
        await worker(current);
      }
    });

    await Promise.all(runners);
  };

  const fetchActionEvents = async (actionId: number, forceRefresh = false) => {
    if (!forceRefresh && window.electronAPI) {
      try {
        const localEvents = await window.electronAPI.dbGetEvents({
          storyId: Number(storyId),
          actionId,
          limit: 200,
          runGuid: selectedRunGuid || undefined,
          sinceIso: selectedRunGuid ? undefined : debugLookbackSinceIso,
        });
        if (localEvents && localEvents.length > 0) {
          addLog('DEBUG', `Loaded ${localEvents.length} cached action events for Action ${actionId}`, {
            scope: selectedRunGuid || `all-runs:${debugLookbackHours}h`,
          });
          mergeEventsIntoMap(localEvents);
          return localEvents;
        }
      } catch (err) {
        console.error('DuckDB: Failed to load action events', err);
      }
    }

    const basePath = tenant.startsWith('http') ? tenant : `https://${tenant}`;
    try {
      addLog('NETWORK', `Fetching action events for Action ${actionId}...`, {
        forceRefresh,
        scope: selectedRunGuid || `all-runs:${debugLookbackHours}h`,
      });
      const resp = await fetch(
        appendStoryModeParams(`${basePath}/api/v1/actions/${actionId}/events?per_page=100`),
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const events = data.events || data.agent_events || data.agents_events || (Array.isArray(data) ? data : []);
      const eventArray = Array.isArray(events)
        ? events.map((event: any) => ({
            ...event,
            story_id: Number(event.story_id || storyId),
            action_id: Number(event.action_id || event.agent_id || actionId),
            story_run_guid: event.story_run_guid || event.run_guid || event.execution_run_guid || null,
          }))
        : [];

      mergeEventsIntoMap(eventArray);

      if (window.electronAPI && eventArray.length > 0) {
        await window.electronAPI.dbSaveEvents(eventArray);
      }

      addLog('DEBUG', `Fetched ${eventArray.length} action events for Action ${actionId}`, {
        scope: selectedRunGuid || `all-runs:${debugLookbackHours}h`,
      });

      return eventArray;
    } catch (err: any) {
      addLog('WARNING', `Failed to fetch action events for Action ${actionId}: ${err.message}`);
      return [];
    }
  };

  const fetchActionLogs = async (actionId: number, forceRefresh = false) => {
    // Phase 53: Try local DuckDB first
    if (!forceRefresh && window.electronAPI) {
        try {
            const localLogs = await window.electronAPI.dbGetLogs({
              storyId: Number(storyId),
              actionId,
              limit: 200,
              runGuid: selectedRunGuid || undefined,
              sinceIso: selectedRunGuid ? undefined : debugLookbackSinceIso,
            });
            if (localLogs && localLogs.length > 0) {
                addLog('DEBUG', `Loaded ${localLogs.length} logs from DuckDB cache for action ${actionId}`);
                setActionLogMap(prev => {
                    const next = new Map(prev);
                    next.set(actionId, localLogs.map(hydrateCachedLog));
                    return next;
                });
                return { logs: localLogs, rateLimited: false };
            }
        } catch (e) {
            console.error('DuckDB: Failed to load logs', e);
        }
    }

    if (!forceRefresh && actionLogMap.has(actionId)) {
      addLog('DEBUG', `Using memory-cached logs for action ${actionId}`);
      return { logs: actionLogMap.get(actionId) || [], rateLimited: false };
    }
    const basePath = tenant.startsWith('http') ? tenant : `https://${tenant}`;
    try {
      addLog('NETWORK', `Fetching action logs for Action ${actionId} via REST...`, {
        forceRefresh,
        scope: selectedRunGuid || `all-runs:${debugLookbackHours}h`,
      });
      const resp = await fetch(
        appendStoryModeParams(`${basePath}/api/v1/actions/${actionId}/logs?per_page=100`),
        { headers: { 'Authorization': `Bearer ${apiKey}` } }
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const logs = data.logs || data;
      const logArray = Array.isArray(logs) ? logs : [];
      
      setActionLogMap(prev => {
        const next = new Map(prev);
        next.set(actionId, logArray);
        return next;
      });

      // Phase 53/55: Persist to DuckDB with traceability
      if (window.electronAPI && logArray.length > 0) {
        window.electronAPI.dbSaveLogs(logArray.map((l: any) => ({ 
          ...l, 
          story_id: Number(storyId), 
          action_id: actionId,
          run_guid: l.story_run_guid || l.execution_run_guid || l.inbound_event?.story_run_guid || null
        })));
      }
      addLog('DEBUG', `Fetched ${logArray.length} action logs for Action ${actionId} via REST`, {
        scope: selectedRunGuid || `all-runs:${debugLookbackHours}h`,
      });
      return { logs: logArray, rateLimited: false };
    } catch (err: any) {
       addLog('ERROR', `Failed to fetch logs for Action ${actionId}: ${err.message}`, {
        scope: selectedRunGuid || `all-runs:${debugLookbackHours}h`,
      });
       return { logs: [], rateLimited: err.message?.includes('429') };
    }
  };

  const fetchRunDetail = async (runGuid: string) => {
    const basePath = tenant.startsWith('http') ? tenant : `https://${tenant}`;
    try {
      addLog('NETWORK', `Fetching run detail for ${runGuid.slice(0, 8)}...`, { runGuid });
      const resp = await fetch(
        appendStoryModeParams(`${basePath}/api/v1/stories/${storyId}/runs/${runGuid}`),
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );
      if (resp.status === 404) return [];
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const payload = await resp.json();
      const runEvents = extractRunEvents(payload).map((event: any) => ({
        ...event,
        story_id: Number(event.story_id || storyId),
        action_id: Number(event.action_id || event.agent_id || event.action?.id || event.agent?.id),
        story_run_guid: event.story_run_guid || event.run_guid || event.execution_run_guid || runGuid,
      }));
      const actionIds = deriveActionIdsFromRunPayload(payload);

      if (runEvents.length > 0) {
        mergeEventsIntoMap(runEvents);
        if (window.electronAPI) {
          await window.electronAPI.dbSaveEvents(runEvents);
        }
      }

      setRunActionIdsMap((prev) => {
        const next = new Map(prev);
        next.set(runGuid, actionIds);
        return next;
      });

      addLog('DEBUG', `Run ${runGuid.slice(0, 8)}... resolved ${actionIds.length} participating actions`, {
        runGuid,
        eventCount: runEvents.length,
        actionIds,
      });

      return actionIds;
    } catch (err: any) {
      addLog('WARNING', `Run detail fetch failed for ${runGuid.slice(0, 8)}...: ${err.message}`);
      return [];
    }
  };

  const runActionIds = useMemo(() => {
    if (!selectedRunGuid) return [];
    const mapped = runActionIdsMap.get(selectedRunGuid);
    if (mapped && mapped.length > 0) return mapped;

    const ids = new Set<number>();
    eventMap.forEach((evts, actionId) => {
      if (evts.some((evt) => evt.story_run_guid === selectedRunGuid)) {
        ids.add(actionId);
      }
    });
    return Array.from(ids);
  }, [eventMap, selectedRunGuid, runActionIdsMap]);

  useEffect(() => {
    const syncDebugLookback = () => setDebugLookbackHours(getStoredDebugLookbackHours());
    window.addEventListener('focus', syncDebugLookback);
    window.addEventListener('storage', syncDebugLookback);
    return () => {
      window.removeEventListener('focus', syncDebugLookback);
      window.removeEventListener('storage', syncDebugLookback);
    };
  }, []);

  const debugLookbackSinceIso = useMemo(() => {
    const since = new Date(Date.now() - debugLookbackHours * 60 * 60 * 1000);
    return since.toISOString();
  }, [debugLookbackHours]);

  const debugRunOptions = useMemo(() => {
    const seen = new Set<string>();
    const fromRuns = recentRuns
      .map((run) => ({
        guid: String(run.guid || run.story_run_guid || run.run_guid || ''),
        label: `Run: ${String(run.guid || run.story_run_guid || run.run_guid || '').slice(0, 8)}...`,
      }))
      .filter((run) => run.guid)
      .filter((run) => {
        if (seen.has(run.guid)) return false;
        seen.add(run.guid);
        return true;
      });

    if (fromRuns.length > 0) return fromRuns;

    return debugStats.runGuids.map((guid) => ({
      guid,
      label: `Run: ${guid.slice(0, 8)}...`,
    }));
  }, [recentRuns, debugStats.runGuids]);

  const hydrateEvidenceForCurrentScope = async () => {
    const cacheKey = selectedRunGuid
      ? `${storyId}:run:${selectedRunGuid}`
      : `${storyId}:window:${debugLookbackSinceIso}`;
    if (hydratedRunEvidenceCacheRef.current.has(cacheKey)) {
      addLog('DEBUG', `Skipping evidence hydration for ${cacheKey}; cache already warm`);
      return cacheKey;
    }
    if (hydratingScopeKeysRef.current.has(cacheKey)) {
      addLog('DEBUG', `Skipping evidence hydration for ${cacheKey}; fetch already in flight`);
      return cacheKey;
    }

    hydratingScopeKeysRef.current.add(cacheKey);

    try {
    addLog('NETWORK', `Hydrating debugger evidence for ${cacheKey}`, {
      selectedRunGuid,
      lookbackHours: debugLookbackHours,
    });
    const runs = await fetchRecentRuns();
    const windowStartMs = new Date(debugLookbackSinceIso).getTime();
    const targetRunGuids = selectedRunGuid
      ? [selectedRunGuid]
      : runs
          .filter((run: any) => getRunTimestamp(run) >= windowStartMs)
          .map((run: any) => String(run.guid || run.story_run_guid || run.run_guid || ''))
          .filter(Boolean)
          .slice(0, 12);

      const runActionIdsFromDetails = new Set<number>();
      for (const runGuid of targetRunGuids) {
        const actionIds = await fetchRunDetail(runGuid);
        actionIds.forEach((actionId) => runActionIdsFromDetails.add(actionId));
      }

      const actionIdsToHydrate = new Set<number>(selectedRunGuid ? runActionIds : []);
      runActionIdsFromDetails.forEach((actionId) => actionIdsToHydrate.add(actionId));

      eventMap.forEach((evts, actionId) => {
        const relevant = selectedRunGuid
          ? evts.some((evt) => evt.story_run_guid === selectedRunGuid)
          : evts.some((evt) => {
              const createdAt = evt.created_at ? new Date(String(evt.created_at)).getTime() : 0;
              return createdAt >= windowStartMs;
            });
        if (relevant) actionIdsToHydrate.add(actionId);
      });

      const actionIdList = Array.from(actionIdsToHydrate);
      let rateLimited = false;
      addLog('DEBUG', `Preparing evidence hydration for ${actionIdList.length} actions`, {
        cacheKey,
        actionIds: actionIdList,
        targetRunGuids,
      });
      if (actionIdList.length > 0) {
        await runWithConcurrencyLimit(actionIdList, 2, async (actionId) => {
          const eventResults = await fetchActionEvents(actionId, true);
          if (eventResults.length === 0) {
            // Keep retries available when Tines is rate limiting evidence endpoints.
            // We infer this from the logger path because the fetch helpers already normalize failures.
          }
          await sleep(120);
          const logResults = await fetchActionLogs(actionId, true);
          if (!logResults || logResults.rateLimited) rateLimited = true;
          await sleep(180);
        });
      }

      if (!rateLimited) {
        hydratedRunEvidenceCacheRef.current.add(cacheKey);
        addLog('SUCCESS', `Hydrated debugger evidence for ${cacheKey}`, {
          actionCount: actionIdList.length,
          targetRunCount: targetRunGuids.length,
        });
      } else {
        addLog('WARNING', `Hydration for ${cacheKey} hit Tines rate limiting; retries remain enabled`, {
          actionCount: actionIdList.length,
          targetRunCount: targetRunGuids.length,
        });
      }

    if (!hydratedRunLogCacheRef.current.has(cacheKey)) {
      hydratedRunLogCacheRef.current.add(cacheKey);
    }

    return cacheKey;
    } finally {
      hydratingScopeKeysRef.current.delete(cacheKey);
    }
  };

  useEffect(() => {
    if (viewMode !== 'debug' || !window.electronAPI) {
      setRunDebugSummary(null);
      return;
    }

    let cancelled = false;

    const loadRunSummary = async () => {
      try {
        await hydrateEvidenceForCurrentScope();

        const summary = await window.electronAPI.dbGetDebugSummary({
          storyId: Number(storyId),
          runGuid: selectedRunGuid || null,
          sinceIso: selectedRunGuid ? null : debugLookbackSinceIso,
        });
        if (!cancelled) {
          setRunDebugSummary(summary);
        }
      } catch (err) {
        console.error('DuckDB: Failed to load run debug summary', err);
      }
    };

    loadRunSummary();
    return () => { cancelled = true; };
  }, [viewMode, selectedRunGuid, runActionIds, storyId, debugLookbackSinceIso, eventMap, recentRuns]);

  useEffect(() => {
    if (viewMode !== 'ledger') return;

    hydrateEvidenceForCurrentScope().catch((err) => {
      console.error('Ledger: Failed to hydrate evidence for current scope', err);
    }).finally(() => {
      setLedgerRefreshVersion((current) => current + 1);
    });
  }, [viewMode, selectedRunGuid, storyId, debugLookbackSinceIso, runActionIds, eventMap]);

  const runDebugCounts = useMemo(() => {
    const events = runDebugSummary?.events || [];
    const logs = runDebugSummary?.logs || [];
    const blockedEventSignals = events.filter((event) => classifyEventSignal(event) === 'blocked').length;
    const externalEventSignals = events.filter((event) => classifyEventSignal(event) === 'external').length;
    const warningEventSignals = events.filter((event) => classifyEventSignal(event) === 'warning').length;
    const okEvents = events.filter((event) => classifyEventSignal(event) === 'ok').length;
    const blockedLogs = logs.filter((log) => classifyLogSignal(log) === 'blocked').length;
    const externalLogs = logs.filter((log) => classifyLogSignal(log) === 'external').length;
    const warningLogs = logs.filter((log) => classifyLogSignal(log) === 'warning').length;
    const actionIds = new Set(events.map((event) => Number(event.action_id || event.agent_id)).filter(Number.isFinite));
    logs.forEach((log) => {
      const actionId = Number(log.action_id || log.agent_id);
      if (Number.isFinite(actionId)) actionIds.add(actionId);
    });
    const actionSignals = new Map<number, DebugSignal[]>();
    events.forEach((event) => {
      const actionId = Number(event.action_id || event.agent_id);
      if (!Number.isFinite(actionId)) return;
      actionSignals.set(actionId, [...(actionSignals.get(actionId) || []), classifyEventSignal(event)]);
    });
    logs.forEach((log) => {
      const actionId = Number(log.action_id || log.agent_id);
      if (!Number.isFinite(actionId)) return;
      actionSignals.set(actionId, [...(actionSignals.get(actionId) || []), classifyLogSignal(log)]);
    });

    let blockedActions = 0;
    let externalActions = 0;
    let warningActions = 0;
    let okActions = 0;
    actionSignals.forEach((signals) => {
      const signal = combineSignals(signals);
      if (signal === 'blocked') blockedActions++;
      else if (signal === 'external') externalActions++;
      else if (signal === 'warning') warningActions++;
      else if (signal === 'ok') okActions++;
    });

    const executionSignal: DebugSignal = blockedActions > 0 || blockedEventSignals + blockedLogs > 0
      ? 'blocked'
      : externalActions > 0 || externalEventSignals + externalLogs > 0
        ? 'external'
        : warningActions > 0 || warningEventSignals + warningLogs > 0
          ? 'warning'
          : events.length > 0 || logs.length > 0
            ? 'ok'
            : 'none';

    const liveSignal: DebugSignal = liveActivityStats.blockedActions > 0 || liveActivityStats.notWorkingActions > 0
      ? 'blocked'
      : liveActivityStats.warningActions > 0 || liveActivityStats.pendingRuns > 0
        ? 'warning'
        : executionSignal;

    const overallSignal = combineSignals([executionSignal, liveSignal]);

    return {
      totalEvents: events.length,
      actionCount: actionIds.size,
      blockedEvents: blockedEventSignals + blockedLogs,
      externalEvents: externalEventSignals + externalLogs,
      warningEvents: warningEventSignals + warningLogs,
      okEvents,
      blockedLogs,
      externalLogs,
      warningLogs,
      blockedActions,
      externalActions,
      warningActions,
      okActions,
      liveBlockedActions: liveActivityStats.blockedActions,
      liveWarningActions: liveActivityStats.warningActions,
      liveNotWorkingActions: liveActivityStats.notWorkingActions,
      livePendingRuns: liveActivityStats.pendingRuns,
      overallSignal,
    };
  }, [runDebugSummary, liveActivityStats]);

  const captureInvestigationScreenshot = async () => {
    if (!canvasRef.current) return null;
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(canvasRef.current, {
        backgroundColor: '#0f172a',
        scale: 1,
        logging: false,
      });
      return canvas.toDataURL('image/png');
    } catch (err) {
      console.error('Investigation: Screenshot capture failed', err);
      return null;
    }
  };

  const getSelectedEventRecord = () => {
    if (!selectedEventId) return null;
    for (const events of eventMap.values()) {
      const found = events.find((event) => Number(event.id) === Number(selectedEventId));
      if (found) return found;
    }
    return null;
  };

  const buildInvestigationArtifacts = async (screenshotDataUrl: string | null): Promise<InvestigationRecord['artifacts']> => {
    const artifacts: NonNullable<InvestigationRecord['artifacts']> = [];
    if (screenshotDataUrl) {
      artifacts.push({
        id: 'screenshot',
        kind: 'screenshot',
        label: 'Canvas Screenshot',
        filename: `investigation-story-${storyId}-canvas.png`,
        mime_type: 'text/plain',
        content: screenshotDataUrl,
      });
    }

    const selectedEvent = getSelectedEventRecord();
    if (selectedEvent) {
      artifacts.push({
        id: `event-${selectedEvent.id}`,
        kind: 'event',
        label: `Selected Event #${selectedEvent.id}`,
        filename: `investigation-event-${selectedEvent.id}.json`,
        mime_type: 'application/json',
        content: JSON.stringify(selectedEvent, null, 2),
      });
    }

    if (runDebugSummary) {
      const runLabel = selectedRunGuid ? `Run ${selectedRunGuid.slice(0, 8)}` : `All Runs ${debugLookbackHours}h`;
      artifacts.push({
        id: `run-${selectedRunGuid || 'window'}`,
        kind: 'run',
        label: `${runLabel} Summary`,
        filename: `investigation-run-${selectedRunGuid || `all-runs-${debugLookbackHours}h`}.json`,
        mime_type: 'application/json',
        content: JSON.stringify(runDebugSummary, null, 2),
      });
    }

    if (debugNode?.id) {
      const nodeEvents = eventMap.get(debugNode.id) || [];
      const nodeLogs = actionLogMap.get(debugNode.id) || [];
      if (nodeEvents.length > 0) {
        artifacts.push({
          id: `node-events-${debugNode.id}`,
          kind: 'node-events',
          label: `${debugNode.name || `Action ${debugNode.id}`} Events`,
          filename: `investigation-action-${debugNode.id}-events.json`,
          mime_type: 'application/json',
          content: JSON.stringify(nodeEvents, null, 2),
        });
      }
      if (nodeLogs.length > 0) {
        artifacts.push({
          id: `node-logs-${debugNode.id}`,
          kind: 'node-logs',
          label: `${debugNode.name || `Action ${debugNode.id}`} Logs`,
          filename: `investigation-action-${debugNode.id}-logs.json`,
          mime_type: 'application/json',
          content: JSON.stringify(nodeLogs, null, 2),
        });
      }
    }

    return artifacts;
  };

  const applyInvestigation = async (investigation: InvestigationRecord) => {
    setInvestigationName(investigation.name || '');
    setInvestigationStatus(investigation.status || 'open');
    setInvestigationSummary(investigation.summary || '');
    setInvestigationFindings(investigation.findings || '');
    setSelectedInvestigationId(investigation.id || null);
    setSelectedRunGuid(investigation.selected_run_guid || null);
    setSelectedEventId(investigation.selected_event_id || null);
    setNotes(investigation.notes || []);
    setHighlightedNodeIds(new Set(investigation.highlighted_node_ids || []));
    setExecutionPath(new Set());

    if (investigation.debug_action_id) {
      const targetAction = actions.find((action) => action.id === investigation.debug_action_id);
      if (targetAction) {
        setViewMode('debug');
        setDebugNode(targetAction);
        await fetchActionLogs(targetAction.id!, true);
      }
    } else {
      setDebugNode(null);
    }
  };

  useEffect(() => {
    if (!investigationToLoad) return;
    applyInvestigation(investigationToLoad).finally(() => {
      onInvestigationLoaded?.();
    });
  }, [investigationToLoad, actions]);

  const saveInvestigation = async () => {
    if (!window.electronAPI) return;
    setSavingInvestigation(true);
    try {
      const screenshotDataUrl = await captureInvestigationScreenshot();
      const artifacts = await buildInvestigationArtifacts(screenshotDataUrl);
      const payload: InvestigationRecord = {
        id: selectedInvestigationId || undefined,
        name: investigationName.trim() || `Story ${storyId} @ ${new Date().toLocaleString()}`,
        tenant,
        story_id: Number(storyId),
        mode: storyContext.mode,
        status: investigationStatus,
        summary: investigationSummary.trim(),
        findings: investigationFindings.trim(),
        draft_id: storyContext.draftId,
        screenshot_data_url: screenshotDataUrl,
        selected_run_guid: selectedRunGuid,
        selected_event_id: selectedEventId,
        debug_action_id: debugNode?.id || null,
        highlighted_node_ids: Array.from(highlightedNodeIds),
        notes,
        artifacts,
      };

      const saved = await window.electronAPI.dbSaveInvestigation(payload);
      setInvestigationName(saved.name);
      setSelectedInvestigationId(saved.id || null);
      await loadInvestigations();
      addLog('SUCCESS', `Saved investigation "${saved.name}" locally`);
    } catch (err: any) {
      addLog('ERROR', 'Failed to save investigation', { error: err.message || String(err) });
    } finally {
      setSavingInvestigation(false);
    }
  };

  // Phase 46: Trace Lineage Navigator
  const handleNavigateToEvent = (eventId: number) => {
    // Search for the event across the entire map
    let targetEvent: any = null;
    let targetActionId: number | null = null;

    for (const [aid, evts] of eventMap.entries()) {
      const found = evts.find(e => e.id === eventId);
      if (found) {
        targetEvent = found;
        targetActionId = aid;
        break;
      }
    }

    if (targetEvent && targetActionId != null) {
      const action = actions.find(a => a.id === targetActionId);
      if (action) {
        setDebugNode(action);
        setSelectedEventId(eventId);
        
        // Calculate the full lineage for highlighting
        const path = new Set<number>();
        const resolveLineage = (evtId: number) => {
          for (const evts of eventMap.values()) {
            const e = evts.find(ev => ev.id === evtId);
            if (e) {
              path.add(Number(e.action_id || e.agent_id));
              if (e.previous_event_ids) {
                e.previous_event_ids.forEach((id: number) => resolveLineage(id));
              }
              break;
            }
          }
        };
        resolveLineage(eventId);
        setExecutionPath(path);
      }
    }
  };

  // Causal Lineage Tracing [D3+46] - Highlight both Hovered and Selected traces
  const causalNodeIds = useMemo(() => {
    const nodes = new Set<number>();
    const events = new Set<number>();
    
    // 1. Add current executionPath (Selection)
    executionPath.forEach(id => nodes.add(id));

    // 2. Add hovered lineage (Hover)
    if (hoveredEventId) {
      const allEvents = Array.from(eventMap.values()).flat();
      const traverse = (id: number) => {
        if (events.has(id)) return;
        events.add(id);
        const evt = allEvents.find(e => e.id === id);
        if (evt) {
          nodes.add(Number(evt.action_id || evt.agent_id));
          if (evt.previous_event_ids) {
            evt.previous_event_ids.forEach((pid: number) => traverse(pid));
          }
        }
      };
      traverse(Number(hoveredEventId));
    }
    
    return nodes;
  }, [hoveredEventId, eventMap, executionPath]);

  const syncNodeCoordinates = async (targetId: number) => {
     if (!editable) return;
     const updatedAct = actions.find(a => a.id === targetId);
     if (updatedAct) {
       addLog('NETWORK', `Saving coordinates for ${updatedAct.name}`);
       setSyncStatus('syncing');
       try {
         await actionsApi.updateAction({ 
           actionId: updatedAct.id!, 
           actionUpdateRequest: { position: updatedAct.position } 
         });
         setSyncStatus('synced');
         setLastSaved(new Date());
       } catch(err: any) {
         setSyncStatus('error');
         addLog('ERROR', 'Coordinate sync failed', { error: err.message });
       }
     }
  };

  const finalizeConnection = async (targetId: number) => {
    if (!editable) return;
    if (safetyLock) return;
    if (connectingFromId === null || connectingFromId === targetId) {
      setConnectingFromId(null);
      return;
    }
    const targetAct = actions.find(a => a.id === targetId);
    if (!targetAct) return;
    if (targetAct.sources && (targetAct.sources as any).includes(connectingFromId)) {
      setConnectingFromId(null);
      return;
    }

    addLog('NETWORK', `Linking ${connectingFromId} -> ${targetId}`);
    setSyncStatus('syncing');
    try {
      const newSources = [...(targetAct.sources || []), connectingFromId];
      await actionsApi.updateAction({ 
        actionId: targetId, 
        actionUpdateRequest: { sourceIds: newSources as any } 
      });
      setSyncStatus('synced');
      setLastSaved(new Date());
      fetchActions();
    } catch (err: any) {
      setSyncStatus('error');
      addLog('ERROR', 'Link creation failed', { error: err.message });
    } finally {
      setConnectingFromId(null);
    }
  };

  const deleteConnection = async (sourceId: number, targetId: number) => {
    if (!editable) return;
    if (safetyLock) return;
    const targetAct = actions.find(a => a.id === targetId);
    if (!targetAct || !targetAct.sources) return;

    addLog('NETWORK', `Breaking connection ${sourceId} -X-> ${targetId}`);
    setSyncStatus('syncing');
    try {
      const newSources = targetAct.sources.filter(s => s !== sourceId);
      await actionsApi.updateAction({ 
        actionId: targetId, 
        actionUpdateRequest: { sourceIds: newSources as any } 
      });
      setSyncStatus('synced');
      setLastSaved(new Date());
      fetchActions();
    } catch (err: any) {
      setSyncStatus('error');
      addLog('ERROR', 'Link removal failed', { error: err.message });
    }
  };

  const handleDeleteAction = async (e: React.MouseEvent, id: number, name: string) => {
    if (!editable) return;
    if (safetyLock) return;
    e.stopPropagation();
    if (!window.confirm(`Destruct ${name}?`)) return;
    addLog('NETWORK', `Deleting action: ${name}`);
    setSyncStatus('syncing');
    try {
      const basePath = tenant.startsWith('http') ? tenant : `https://${tenant}`;
      await fetch(`${basePath}/api/v1/actions/${id}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        }
      });
      setSyncStatus('synced');
      setLastSaved(new Date());
      fetchActions();
    } catch(err: any) {
      setSyncStatus('error');
      addLog('ERROR', `Deletion failed`, { error: err.message });
    }
  };

  const handleCreateAction = async (e: React.FormEvent) => {
    if (!editable) return;
    if (safetyLock) return;
    e.preventDefault();
    if (!actionName) return;
    setCreating(true);
    setSyncStatus('syncing');
    try {
      await actionsApi.createAction({
        actionCreateRequest: {
          name: actionName,
          type: actionType as any,
          storyId: storyId,
          position: { x: (Math.random() * 400 + 100), y: (Math.random() * 300 + 100) } as any,
          options: {},
        }
      });
      setSyncStatus('synced');
      setLastSaved(new Date());
      setActionName('');
      fetchActions();
    } catch (err: any) {
      setSyncStatus('error');
      addLog('ERROR', `Creation failed`, { error: err.message });
    } finally {
      setCreating(false);
    }
  };

  // --- Canvas Interaction Handlers ---

  const getSafety = (act: any): SafetyInfo => getEffectiveSafety(act, tierOverrides);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.nondraggable')) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleNodeMouseDown = (e: React.MouseEvent, actionId: number) => {
    if (!editable) return;
    if (safetyLock) return;
    e.stopPropagation();
    if ((e.target as HTMLElement).tagName.toLowerCase() === 'button') return;
    setDraggedNode(actionId);
    setNodeDragOffset({ x: e.clientX, y: e.clientY });
  };

  const handleGlobalMouseMove = (e: React.MouseEvent) => {
    if (connectingFromId !== null) {
      setDragMousePos({ x: e.clientX, y: e.clientY });
      return;
    }
    if (draggedNoteId !== null) {
      if (e.buttons !== 1) { setDraggedNoteId(null); return; }
      const nx = e.clientX / zoom - noteDragOffset.x;
      const ny = e.clientY / zoom - noteDragOffset.y;
      setNotes(prev => prev.map(n => n.id === draggedNoteId ? { ...n, x: nx, y: ny } : n));
      return;
    }
    if (draggedNode) {
      if (e.buttons !== 1) { handleGlobalMouseUp(); return; }
      const tempActions = [...actions];
      const actIndex = tempActions.findIndex(a => a.id === draggedNode);
      if (actIndex >= 0) {
         const deltaX = e.clientX - nodeDragOffset.x;
         const deltaY = e.clientY - nodeDragOffset.y;
         tempActions[actIndex].position = {
            x: (tempActions[actIndex].position?.x || 0) + deltaX,
            y: (tempActions[actIndex].position?.y || 0) + deltaY
         };
         setActions(tempActions);
         setNodeDragOffset({ x: e.clientX, y: e.clientY });
      }
      return;
    }
    if (!isDragging) return;
    if (e.buttons !== 1) { setIsDragging(false); return; }
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleGlobalMouseUp = () => {
    setIsDragging(false);
    setDraggedNoteId(null);
    if (connectingFromId !== null) setConnectingFromId(null);
    if (draggedNode) {
       syncNodeCoordinates(draggedNode);
       setDraggedNode(null);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      setZoom(prev => Math.min(Math.max(prev - e.deltaY * 0.005, 0.1), 2.5));
    } else {
      setPan(prev => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
    }
  };

  const handleNodeClick = (e: React.MouseEvent, act: Action) => {
    e.stopPropagation();
    setInspectedNode(act);
  };

  const addNote = () => {
    if (!editable) return;
    const containerW = canvasRef.current?.clientWidth || 800;
    const containerH = canvasRef.current?.clientHeight || 600;
    const cx = (-pan.x + containerW / 2) / zoom;
    const cy = (-pan.y + containerH / 2) / zoom;
    setNotes(prev => [...prev, { id: nextNoteId, x: cx - 90, y: cy - 40, text: 'New note...', color: '#fbbf24' }]);
    setNextNoteId(n => n + 1);
  };

  // --- Export / Layout Handlers ---

  const recenterCanvas = (targetActions = actions) => {
    if (targetActions.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    targetActions.forEach((a: any) => {
      const ax = (a.position as any)?.x ?? (a.position as any)?.X ?? 0;
      const ay = (a.position as any)?.y ?? (a.position as any)?.Y ?? 0;
      if (ax < minX) minX = ax;
      if (ay < minY) minY = ay;
      if (ax + 240 > maxX) maxX = ax + 240;
      if (ay + 120 > maxY) maxY = ay + 120;
    });
    const graphW = maxX - minX;
    const graphH = maxY - minY;
    const containerW = canvasRef.current?.clientWidth || 800;
    const containerH = canvasRef.current?.clientHeight || 600;
    const fitZoom = Math.min(containerW / (graphW + 100), containerH / (graphH + 100), 1);
    const newZoom = Math.max(fitZoom, 0.15);
    const offsetX = (containerW / newZoom - graphW) / 2 - minX;
    const offsetY = (containerH / newZoom - graphH) / 2 - minY;
    setZoom(newZoom);
    setPan({ x: offsetX * newZoom, y: offsetY * newZoom });
  };

  const flyToNode = (actionId: number) => {
    const act = actions.find(a => a.id === actionId);
    if (!act) return;
    const containerW = canvasRef.current?.clientWidth || 800;
    const containerH = canvasRef.current?.clientHeight || 600;
    const targetZoom = 1.2;
    const nx = (act.position as any)?.x ?? (act.position as any)?.X ?? 0;
    const ny = (act.position as any)?.y ?? (act.position as any)?.Y ?? 0;
    const offsetX = containerW / 2 - (nx + 240 / 2) * targetZoom;
    const offsetY = containerH / 2 - (ny + 120 / 2) * targetZoom;
    setZoom(targetZoom);
    setPan({ x: offsetX, y: offsetY });
    setHighlightedNodeId(actionId);
    setInspectedNode(act);
    setSearchOpen(false);
    setCanvasSearch('');
    setTimeout(() => setHighlightedNodeId(null), 3000);
  };

  const autoLayout = () => {
    if (actions.length === 0) return;
    const NODE_W = 240, NODE_H = 120, GAP_X = 60, GAP_Y = 50;
    const childMap = new Map<number, number[]>();
    actions.forEach(a => {
      if (Array.isArray(a.sources)) {
        a.sources.forEach((sid: any) => childMap.set(sid, [...(childMap.get(sid) || []), a.id!]));
      }
    });
    const roots = actions.filter(a => !a.sources || (a.sources as any[]).length === 0).map(a => a.id!);
    if (roots.length === 0) roots.push(actions[0].id!);
    const depth = new Map<number, number>();
    const queue = [...roots];
    roots.forEach(r => depth.set(r, 0));
    while (queue.length > 0) {
      const cur = queue.shift()!;
      const children = childMap.get(cur) || [];
      children.forEach(c => {
        if (!depth.has(c)) {
          depth.set(c, (depth.get(cur) || 0) + 1);
          queue.push(c);
        }
      });
    }
    const maxDepth = Math.max(...Array.from(depth.values()), 0);
    actions.forEach(a => { if (!depth.has(a.id!)) depth.set(a.id!, maxDepth + 1); });
    const rows = new Map<number, number[]>();
    actions.forEach(a => {
      const d = depth.get(a.id!) || 0;
      rows.set(d, [...(rows.get(d) || []), a.id!]);
    });
    const newActions = [...actions];
    const sortedRows = Array.from(rows.keys()).sort((a, b) => a - b);
    sortedRows.forEach((rowIdx, ri) => {
      const ids = rows.get(rowIdx)!;
      const rowWidth = ids.length * (NODE_W + GAP_X) - GAP_X;
      const startX = -rowWidth / 2;
      ids.forEach((id, ci) => {
        const idx = newActions.findIndex(a => a.id === id);
        if (idx >= 0) {
          newActions[idx] = { ...newActions[idx], position: { x: startX + ci * (NODE_W + GAP_X), y: ri * (NODE_H + GAP_Y) } };
        }
      });
    });
    setActions(newActions);
    setTimeout(recenterCanvas, 50);
  };

  const getGridInfo = () => {
    const NODE_W = 240, NODE_H = 120;
    if (actions.length === 0) return { cells: [], cols: 0, rows: 0, minX: 0, minY: 0, cellW: 0, cellH: 0 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    actions.forEach((a: any) => {
      minX = Math.min(minX, a.position?.x || 0);
      minY = Math.min(minY, a.position?.y || 0);
      maxX = Math.max(maxX, (a.position?.x || 0) + NODE_W);
      maxY = Math.max(maxY, (a.position?.y || 0) + NODE_H);
    });
    const pad = 40;
    minX -= pad; minY -= pad; maxX += pad; maxY += pad;
    const cellW = 600, cellH = 450;
    const cols = Math.max(1, Math.ceil((maxX - minX) / cellW));
    const rows = Math.max(1, Math.ceil((maxY - minY) / cellH));
    const cells: any[] = [];
    let page = 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        cells.push({ label: `${r+1}-${c+1}`, x: minX + c * cellW, y: minY + r * cellH, w: cellW, h: cellH, page: page++ });
      }
    }
    return { cells, cols, rows, minX, minY, cellW, cellH };
  };

  const exportSVG = () => {
    const pad = 60;
    let gMinX = Infinity, gMinY = Infinity, gMaxX = -Infinity, gMaxY = -Infinity;
    actions.forEach((a: any) => {
      gMinX = Math.min(gMinX, a.position?.x || 0);
      gMinY = Math.min(gMinY, a.position?.y || 0);
      gMaxX = Math.max(gMaxX, (a.position?.x || 0) + NODE_W);
      gMaxY = Math.max(gMaxY, (a.position?.y || 0) + NODE_H);
    });
    const svgW = gMaxX - gMinX + pad * 2;
    const svgH = gMaxY - gMinY + pad * 2;
    const isSafety = viewMode === 'safety';
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="${gMinX - pad} ${gMinY - pad} ${svgW} ${svgH}" style="background:#0f172a;font-family:system-ui,sans-serif">`;
    actions.forEach(act => {
      if (!act.sources || !Array.isArray(act.sources)) return;
      act.sources.forEach((sid: any) => {
        const src = actions.find(a => a.id === sid);
        if (!src) return;
        const x1 = (src.position?.x || 0) + NODE_W/2, y1 = (src.position?.y || 0) + NODE_H;
        const x2 = (act.position?.x || 0) + NODE_W/2, y2 = act.position?.y || 0;
        const color = isSafety ? getEffectiveSafety(act).color : '#334155';
        svg += `<path d="M${x1} ${y1} C${x1} ${(y1+y2)/2},${x2} ${(y1+y2)/2},${x2} ${y2}" fill="none" stroke="${color}" stroke-width="2.5" opacity="0.7"/>`;
      });
    });
    actions.forEach(act => {
      const x = act.position?.x || 0, y = act.position?.y || 0;
      const safety = getEffectiveSafety(act);
      const fill = isSafety ? safety.bgColor : 'rgba(30,41,59,0.9)';
      const border = isSafety ? safety.color : '#6366f1';
      svg += `<rect x="${x}" y="${y}" width="${NODE_W}" height="${NODE_H - 20}" rx="10" fill="${fill}" stroke="${border}" stroke-width="2"/>`;
    });
    svg += '</svg>';
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tines-story-${storyId}${isSafety ? '-safety' : ''}.svg`;
    a.click();
    addLog('SUCCESS', `Exported SVG (${Math.round(svgW)}x${Math.round(svgH)})`);
  };

  // Phase 13: Multi-Page PDF Export
  const exportPDF = () => {
    if (actions.length === 0) return;
    const grid = getGridInfo();
    const isSafety = viewMode === 'safety';
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();

    // Helper: render graph region to a PDF page
    const renderRegion = (regionX: number, regionY: number, regionW: number, regionH: number, pageLabel: string) => {
      pdf.setFillColor(15, 23, 42);
      pdf.rect(0, 0, pw, ph, 'F');
      const scale = Math.min(pw / regionW, ph / regionH) * 0.9;
      const offX = (pw - regionW * scale) / 2 - regionX * scale;
      const offY = (ph - regionH * scale) / 2 - regionY * scale;

      // Links
      actions.forEach(act => {
        if (!act.sources || !Array.isArray(act.sources)) return;
        act.sources.forEach((sid: any) => {
          const src = actions.find(a => a.id === sid);
          if (!src) return;
          const x1 = ((src.position?.x || 0) + NODE_W/2) * scale + offX;
          const y1 = ((src.position?.y || 0) + NODE_H) * scale + offY;
          const x2 = ((act.position?.x || 0) + NODE_W/2) * scale + offX;
          const y2 = (act.position?.y || 0) * scale + offY;
          const color = isSafety ? getEffectiveSafety(act).color : '#475569';
          pdf.setDrawColor(color);
          pdf.setLineWidth(1.5);
          pdf.line(x1, y1, x2, y2);
        });
      });

      // Nodes
      actions.forEach(act => {
        const nx = (act.position?.x || 0) * scale + offX;
        const ny = (act.position?.y || 0) * scale + offY;
        const nw = NODE_W * scale;
        const nh = (NODE_H - 20) * scale;
        // Only render nodes within visible region (with padding)
        if (nx + nw < -50 || nx > pw + 50 || ny + nh < -50 || ny > ph + 50) return;
        const safety = getEffectiveSafety(act);
        const borderColor = isSafety ? safety.color : ((act.type === 'Agents::WebhookAgent' || act.type === 'Agents::TriggerAgent') ? '#22c55e' : '#6366f1');
        pdf.setFillColor(30, 41, 59);
        pdf.roundedRect(nx, ny, nw, nh, 4, 4, 'F');
        pdf.setDrawColor(borderColor);
        pdf.setLineWidth(2);
        pdf.roundedRect(nx, ny, nw, nh, 4, 4, 'S');
        pdf.setFontSize(Math.max(8, 11 * scale));
        pdf.setTextColor(255, 255, 255);
        pdf.text((act.name || 'Unnamed').substring(0, 30), nx + 8 * scale, ny + 20 * scale);
        pdf.setFontSize(Math.max(6, 8 * scale));
        pdf.setTextColor(isSafety ? safety.color : '#94a3b8');
        pdf.text((act.type || '').replace('Agents::', ''), nx + 8 * scale, ny + 36 * scale);
        if (isSafety) {
          pdf.setTextColor(safety.color);
          pdf.text(`${safety.label}`, nx + 8 * scale, ny + 50 * scale);
        }
      });

      // Page label
      pdf.setFontSize(10);
      pdf.setTextColor(100, 116, 139);
      pdf.text(pageLabel, 20, ph - 15);
      pdf.text(`Tines Story ${storyId} | ${isSafety ? 'Safety Map' : 'Visual Canvas'}`, pw - 250, ph - 15);
    };

    // Page 1: Overview with grid numbers
    let oMinX = Infinity, oMinY = Infinity, oMaxX = -Infinity, oMaxY = -Infinity;
    actions.forEach((a: any) => {
      oMinX = Math.min(oMinX, a.position?.x || 0);
      oMinY = Math.min(oMinY, a.position?.y || 0);
      oMaxX = Math.max(oMaxX, (a.position?.x || 0) + NODE_W);
      oMaxY = Math.max(oMaxY, (a.position?.y || 0) + NODE_H);
    });
    const padO = 80;
    renderRegion(oMinX - padO, oMinY - padO, oMaxX - oMinX + padO * 2, oMaxY - oMinY + padO * 2, 'Page 1 — Overview');

    // Draw grid overlay on overview
    const overScale = Math.min(pw / (oMaxX - oMinX + padO * 2), ph / (oMaxY - oMinY + padO * 2)) * 0.9;
    const overOffX = (pw - (oMaxX - oMinX + padO * 2) * overScale) / 2 - (oMinX - padO) * overScale;
    const overOffY = (ph - (oMaxY - oMinY + padO * 2) * overScale) / 2 - (oMinY - padO) * overScale;
    grid.cells.forEach(cell => {
      const cx = cell.x * overScale + overOffX;
      const cy = cell.y * overScale + overOffY;
      const cw = cell.w * overScale;
      const ch = cell.h * overScale;
      pdf.setDrawColor('#64748b');
      pdf.setLineWidth(0.5);
      pdf.setLineDashPattern([4, 3], 0);
      pdf.rect(cx, cy, cw, ch, 'S');
      pdf.setLineDashPattern([], 0);
      pdf.setFontSize(12);
      pdf.setTextColor('#94a3b8');
      pdf.text(`P${cell.page}`, cx + 4, cy + 14);
    });

    // Detail pages
    grid.cells.forEach(cell => {
      pdf.addPage();
      renderRegion(cell.x, cell.y, cell.w, cell.h, `Page ${cell.page} — Section ${cell.label}`);
      // Section number badge
      pdf.setFillColor(71, 85, 105);
      pdf.roundedRect(pw - 60, 15, 45, 22, 4, 4, 'F');
      pdf.setFontSize(12);
      pdf.setTextColor(255, 255, 255);
      pdf.text(cell.label, pw - 52, 31);
    });

    pdf.save(`tines-story-${storyId}${isSafety ? '-safety' : ''}.pdf`);
    addLog('SUCCESS', `Exported ${1 + grid.cells.length}-page PDF`);
  };

  // Phase 15: Export as Mermaid (LLM-friendly Graphing Language)
  const exportMermaid = () => {
    let mmd = 'graph TD\n';
    // Style definitions
    mmd += '  classDef safe stroke:#22c55e,stroke-width:2px,fill:rgba(34,197,94,0.1),color:#fff\n';
    mmd += '  classDef read-only stroke:#3b82f6,stroke-width:2px,fill:rgba(59,130,246,0.1),color:#fff\n';
    mmd += '  classDef interactive stroke:#f59e0b,stroke-width:2px,fill:rgba(245,158,11,0.1),color:#fff\n';
    mmd += '  classDef mutating stroke:#ef4444,stroke-width:2px,fill:rgba(239,68,68,0.1),color:#fff\n\n';

    actions.forEach(a => {
      const safety = getSafety(a);
      const name = (a.name || 'Unnamed').replace(/[\[\]\(\)\"]/g, '');
      const type = (a.type || '').replace('Agents::', '');
      mmd += `  ${a.id}["${name} (${type})"]\n`;
      mmd += `  class ${a.id} ${safety.tier}\n`;
    });

    actions.forEach(a => {
      if (a.sources && Array.isArray(a.sources)) {
        a.sources.forEach(srcId => {
          mmd += `  ${srcId} --> ${a.id}\n`;
        });
      }
    });

    const blob = new Blob([mmd], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `story-${storyId}-graph.mmd`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    addLog('SUCCESS', 'Exported Story as Mermaid (LLM-friendly)');
    setExportMenuOpen(false);
  };

  useEffect(() => {
    if (actions.length > 0 && pan.x === 0 && pan.y === 0) {
      // Small delay to ensure canvas ref is mounted
      setTimeout(recenterCanvas, 100);
    }
  }, [actions]);


  // Phase 37: Global Actions "Fly-To" Navigation
  useEffect(() => {
    if (focusActionId && actions.length > 0) {
      const target = actions.find(a => a.id === focusActionId);
      if (target && target.position) {
        addLog('INFO', `Auto-centering on focused action: ${target.name} (ID: ${focusActionId})`);
        
        // Calculate the center of the viewport in canvas coordinates
        const containerW = canvasRef.current?.clientWidth || window.innerWidth;
        const containerH = canvasRef.current?.clientHeight || window.innerHeight;
        
        // targetPos * zoom + pan = containerCenter
        // pan = containerCenter - (targetPos * zoom)
        // We also want to center the node itself (NODE_W/2, NODE_H/2)
        const targetZoom = 1.0; // Reset to a readable zoom level
        const nx = (target.position?.x ?? 0) + NODE_W / 2;
        const ny = (target.position?.y ?? 0) + NODE_H / 2;
        
        setZoom(targetZoom);
        setPan({
          x: containerW / 2 - nx * targetZoom,
          y: containerH / 2 - ny * targetZoom
        });
        
        setHighlightedNodeId(focusActionId);
        setInspectedNode(target);
        setTimeout(() => setHighlightedNodeId(null), 3000);
      }
    }
  }, [focusActionId, actions]);


  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '2rem 3rem', overflow: 'hidden' }} onMouseMove={handleGlobalMouseMove} onMouseUp={handleGlobalMouseUp}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <button onClick={onBack} className="btn-glass" style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }}>
          ← Back
        </button>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {!editable && (
            <button
              onClick={onOpenInEditor}
              className="btn-primary"
              style={{ fontSize: '0.8rem', padding: '0.5rem 1rem', background: '#f59e0b', color: '#111827' }}
              title="Open this story in the mutable editor surface"
            >
              ✏️ Open in Editor
            </button>
          )}
          <button
            onClick={() => setInvestigationsOpen((open) => !open)}
            className="btn-glass"
            style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }}
          >
            💾 Investigations
          </button>
          <button 
            onClick={() => (window as any).electronAPI?.openExternal(`https://${tenant.replace('https://', '')}/stories/${storyId}`)} 
            className="btn-primary" 
            style={{ fontSize: '0.8rem', padding: '0.5rem 1rem', background: 'var(--success-color)' }}
          >
            ⭧ Open securely in Cloud
          </button>
        </div>
      </div>

      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.25rem', fontWeight: 600 }}>Story Canvas</h1>
        <p style={{ color: 'var(--text-secondary)' }}>ID: {storyId}</p>
      </header>

      {!editable && (
        <div className="glass-panel" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem', borderColor: 'rgba(245, 158, 11, 0.25)', background: 'rgba(245, 158, 11, 0.06)' }}>
          <div style={{ fontWeight: 700, color: '#fbbf24', fontSize: '0.85rem', marginBottom: '0.35rem' }}>READ-ONLY STORY VIEW</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <span>This canvas is safe for browsing, debugging, exports, and investigations. Use `Editor` when you need to mutate the tenant.</span>
            <button
              onClick={onOpenInEditor}
              className="btn-glass"
              style={{ fontSize: '0.8rem', padding: '0.45rem 0.9rem', borderColor: 'rgba(245, 158, 11, 0.35)', color: '#fbbf24' }}
            >
              Open in Editor
            </button>
          </div>
        </div>
      )}

      {/* Mode Switcher & Recenter */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', alignItems: 'center' }}>
        <button onClick={() => setViewMode('canvas')} className={viewMode === 'canvas' ? 'btn-primary' : 'btn-glass'}>
          Visual Canvas
        </button>
        <button onClick={() => setViewMode('safety')} className={viewMode === 'safety' ? 'btn-primary' : 'btn-glass'} style={viewMode === 'safety' ? { background: '#f59e0b' } : {}}>
          ⚠ Safety Map
        </button>
        <button onClick={() => setViewMode('json')} className={viewMode === 'json' ? 'btn-primary' : 'btn-glass'}>
          Raw Context JSON
        </button>
        <button 
          onClick={() => { setViewMode('debug'); fetchRecentRuns(true); fetchEvents(); }} 
          className={viewMode === 'debug' ? 'btn-primary' : 'btn-glass'} 
          style={viewMode === 'debug' ? { background: '#8b5cf6' } : {}}
        >
          🐛 Debug Trace
        </button>
        <button 
          onClick={() => setViewMode('ledger')} 
          className={viewMode === 'ledger' ? 'btn-primary' : 'btn-glass'} 
          style={viewMode === 'ledger' ? { background: '#10b981' } : {}}
        >
          🗄️ Story Ledger
        </button>
        {(viewMode === 'canvas' || viewMode === 'safety' || viewMode === 'debug') && actions.length > 0 && (
           <button 
             onClick={() => recenterCanvas()} 
             className="btn-glass" 
             style={{ marginLeft: 'auto', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success-color)', border: '1px solid var(--success-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
             ⌖ Focus Canvas Over Nodes
           </button>
        )}
      </div>

      {viewMode === 'json' ? (
        <div style={{ overflow: 'auto', maxHeight: '80vh' }}>
          {actions.map((act, i) => {
            const safety = getEffectiveSafety(act);
            const isOverridden = tierOverrides[act.id!] !== undefined;
            return (
              <div key={act.id || i} style={{
                marginBottom: '0.75rem', borderRadius: '8px', overflow: 'hidden',
                border: `1px solid ${safety.color}44`, background: safety.bgColor
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.5rem 1rem', borderBottom: `1px solid ${safety.color}33`,
                  background: `${safety.color}15`
                }}>
                  <span style={{ fontWeight: 600, color: 'white', fontSize: '0.9rem' }}>
                    {act.name || 'Unnamed'}
                  </span>
                  <span style={{
                    fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px',
                    background: safety.bgColor, color: safety.color, fontWeight: 600
                  }}>
                    {isOverridden ? '\ud83d\udd13 ' : ''}{safety.icon} {safety.label}
                  </span>
                </div>
                <pre style={{
                  padding: '0.75rem 1rem', margin: 0,
                  fontSize: '0.8rem', color: '#a5d6ff', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                  background: 'rgba(0,0,0,0.3)'
                }}>
                  {JSON.stringify(act, null, 2)}
                </pre>
              </div>
            );
          })}
          {actions.length === 0 && (
            <pre style={{
              background: 'rgba(0,0,0,0.5)', padding: '1.5rem', borderRadius: '12px',
              color: '#a5d6ff', fontSize: '0.85rem', border: '1px solid var(--glass-border)'
            }}>
              []
            </pre>
          )}
        </div>
      ) : (
        <>
        {investigationsOpen && (
          <div className="glass-panel nondraggable" style={{ marginBottom: '1rem', padding: '1rem 1.25rem', display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>
            <div style={{ minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Save Investigation</div>
                <input
                  value={investigationName}
                  onChange={(e) => setInvestigationName(e.target.value)}
                  placeholder={`Story ${storyId} failure analysis`}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Status</div>
                <select value={investigationStatus} onChange={(e) => setInvestigationStatus(e.target.value as 'open' | 'needs_review' | 'resolved' | 'archived')} style={{ width: '100%' }}>
                  <option value="open">Open</option>
                  <option value="needs_review">Needs Review</option>
                  <option value="resolved">Resolved</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Summary</div>
                <textarea
                  value={investigationSummary}
                  onChange={(e) => setInvestigationSummary(e.target.value)}
                  placeholder="Short summary of what this investigation is about"
                  style={{ width: '100%', minHeight: '72px' }}
                />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Findings</div>
                <textarea
                  value={investigationFindings}
                  onChange={(e) => setInvestigationFindings(e.target.value)}
                  placeholder="Key findings, hypotheses, or conclusion notes"
                  style={{ width: '100%', minHeight: '120px' }}
                />
              </div>
              <button className="btn-primary" onClick={saveInvestigation} disabled={savingInvestigation}>
                {savingInvestigation ? 'Saving...' : selectedInvestigationId ? 'Update Investigation' : 'Save Investigation'}
              </button>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Saves story context, selected run/event, current debug node, notes, highlights, summary/findings, and downloadable artifacts.
              </div>
            </div>

            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Current Saved Record</div>
              {selectedInvestigationId ? (
                (() => {
                  const current = investigations.find((item) => item.id === selectedInvestigationId);
                  if (!current) {
                    return <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>This investigation has not been reloaded yet.</div>;
                  }
                  return (
                    <div style={{ border: '1px solid var(--accent-color)', borderRadius: '10px', padding: '0.9rem', background: 'rgba(255,255,255,0.03)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 700, color: 'white' }}>{current.name}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                            {new Date(current.updated_at || current.created_at || '').toLocaleString()}
                          </div>
                        </div>
                        <span style={{ fontSize: '0.68rem', padding: '0.2rem 0.5rem', borderRadius: '999px', background: 'rgba(59,130,246,0.16)', color: '#93c5fd' }}>
                          {(current.status || 'open').replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                      {current.summary && (
                        <div style={{ fontSize: '0.78rem', color: '#e2e8f0', marginTop: '0.55rem', lineHeight: 1.45 }}>
                          {current.summary}
                        </div>
                      )}
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.55rem' }}>
                        {(current.artifacts || []).length} artifact(s) · {(current.notes || []).length} note(s)
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Saved investigations are now browsed from the dedicated `Investigations` section in the sidebar. This panel is focused on saving and updating the current story context.
                </div>
              )}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', flex: 1, minHeight: '600px' }}>
          
        {/* Actions Canvas Plane */}
        <div ref={canvasRef}
          style={{ 
            flex: 2, position: 'relative', overflow: 'hidden', 
            background: 'var(--bg-card)', border: '1px solid var(--glass-border)',
            borderRadius: '12px', height: '100%', minHeight: '600px',
            cursor: isDragging ? 'grabbing' : 'grab',
            backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
            backgroundPosition: `${pan.x}px ${pan.y}px`
          }}
          onMouseDown={handleMouseDown}
          onWheel={handleWheel}
        >
          {/* Header Overlay */}
          <div 
            className="glass-panel" 
            style={{
              position: 'absolute', top: '1rem', left: '1rem', right: '1rem',
              height: '4rem', zIndex: 100, display: 'flex', alignItems: 'center', padding: '0 1.5rem',
              gap: '1rem'
            }}
          >
            <button className="btn-glass" onClick={onBack} title="Back to Dashboard">←</button>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0 }}>Story {storyId}</h2>
                <span style={{ 
                  fontSize: '0.65rem', fontWeight: 800, padding: '2px 6px', 
                  borderRadius: '4px', background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa',
                  border: '1px solid rgba(139, 92, 246, 0.3)', letterSpacing: '0.05em'
                }}>ALPHA</span>

                {/* Phase 27: Status Badges */}
                {storyMetadata && (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ 
                    fontSize: '0.65rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px',
                    background: storyContext.mode === 'live' ? 'rgba(34,197,94,0.1)' : 'rgba(139,92,246,0.1)',
                    color: storyContext.mode === 'live' ? 'var(--success-color)' : '#a78bfa',
                    border: `1px solid ${storyContext.mode === 'live' ? 'rgba(34,197,94,0.3)' : 'rgba(139,92,246,0.3)'}`
                  }}>
                    ENV: {storyContext.mode.toUpperCase()}
                  </span>
                  {!storyMetadata.published && (
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)' }}>DRAFT</span>
                  )}
                  {storyMetadata.changeControlEnabled && (
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)' }}>CHANGE CONTROL</span>
                  )}
                  {storyMetadata.locked && (
                    <span title="This story is locked on the Tines server" style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}>SERVER LOCKED</span>
                  )}
                </div>
                )}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {syncStatus === 'syncing' ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#f59e0b' }}>
                    <span className="pulse-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b' }}></span>
                    Syncing...
                  </span>
                ) : syncStatus === 'error' ? (
                  <span style={{ color: '#ef4444' }}>⚠️ Sync Error</span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#10b981' }}>
                    ✓ Synced
                    {lastSaved && <span style={{ opacity: 0.6, fontSize: '0.7rem' }}>· {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                  </span>
                )}
              </div>
            </div>

            <div style={{ flex: 1 }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {editable ? (
                <>
                  <button 
                    onClick={() => setSafetyLock(!safetyLock)} 
                    className="btn-glass"
                    style={{ 
                      padding: '0.4rem 0.8rem', 
                      fontSize: '0.75rem', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.4rem',
                      borderColor: safetyLock ? 'var(--accent-color)' : 'rgba(239, 68, 68, 0.4)',
                      background: safetyLock ? 'rgba(99, 102, 241, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      color: safetyLock ? 'var(--accent-hover)' : '#f87171'
                    }}
                  >
                    {safetyLock ? '🛡️ Shield ON' : '🔓 Shield OFF'}
                  </button>

                  <button 
                    onClick={toggleServerLock} 
                    className="btn-glass"
                    style={{ 
                      padding: '0.4rem 0.8rem', 
                      fontSize: '0.75rem', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.4rem',
                      borderColor: storyMetadata?.locked ? 'rgba(239, 68, 68, 0.6)' : undefined,
                      background: storyMetadata?.locked ? 'rgba(239, 68, 68, 0.05)' : undefined
                    }}
                  >
                    {storyMetadata?.locked ? '☁️ Server: LOCKED' : '☁️ Server: OPEN'}
                  </button>
                </>
              ) : (
                <>
                  <span className="btn-glass" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', borderColor: 'rgba(245, 158, 11, 0.35)', color: '#fbbf24' }}>
                    READ ONLY
                  </span>
                  <span className="btn-glass" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>
                    {storyMetadata?.locked ? '☁️ Server: LOCKED' : '☁️ Server: OPEN'}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Sub-Header: Health Ribbon */}
          {storyMetadata && (
            <div style={{
              position: 'absolute', top: '5rem', left: '1rem', right: '1rem',
              background: 'rgba(30, 41, 59, 0.5)',
              backdropFilter: 'blur(8px)',
              border: '1px solid var(--glass-border)',
              borderRadius: '8px',
              padding: '0.4rem 1rem',
              display: 'flex',
              gap: '1.5rem',
              fontSize: '0.7rem',
              color: 'var(--text-secondary)',
              zIndex: 90,
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, color: 'white', fontSize: '0.65rem', opacity: 0.7 }}>HEALTH:</span>
                <span style={{ 
                  color: getSignalDisplay(liveActivityStats.storySignal).color,
                  textTransform: 'uppercase', fontWeight: 800
                }}>
                  {getSignalDisplay(liveActivityStats.storySignal).label}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>TOKENS:</span>
                <div style={{ width: 60, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ 
                    width: `${Math.min(100, (storyMetadata as any)?.tokens_used_percentage || 0)}%`, 
                    height: '100%', 
                    background: ((storyMetadata as any)?.tokens_used_percentage || 0) > 80 ? 'var(--danger-color)' : 'var(--accent-color)' 
                  }} />
                </div>
                <span style={{ fontWeight: 600, color: 'white' }}>{liveActivityStats.tokensUsedPercentage}%</span>
              </div>

              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <span style={{ opacity: 0.7 }}>RUNS:</span>
                <span style={{ color: 'white', fontWeight: 600 }}>{liveActivityStats.pendingRuns} pending / {liveActivityStats.concurrentRuns} active</span>
              </div>

              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <span style={{ opacity: 0.7 }}>ACTIONS:</span>
                <span style={{ color: liveActivityStats.notWorkingActions > 0 ? '#ef4444' : 'white', fontWeight: 600 }}>
                  {liveActivityStats.notWorkingActions} not working
                </span>
              </div>

              <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                <button 
                  onClick={() => { fetchRecentRuns(true); fetchEvents(true); }}
                  style={{ 
                    background: 'rgba(255,255,255,0.1)', border: '1px solid var(--glass-border)', borderRadius: '4px', padding: '2px 8px', color: 'white', fontSize: '0.6rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                  }}
                  title="Force refresh from Tines Cloud (bypasses DuckDB cache)"
                >
                  <span>☁️</span> CLOUD RE-SYNC
                </button>
                <div style={{ opacity: 0.5, fontSize: '0.6rem' }}>
                  ID: {storyId} · SYNCED {lastSaved?.toLocaleTimeString()}
                </div>
              </div>
            </div>
          )}


      {/* Canvas Controls HUD */}
          <div style={{ position: 'absolute', bottom: '20px', right: '20px', zIndex: 1000, display: 'flex', gap: '0.5rem', background: 'var(--bg-card)', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--glass-border)', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
            <button
              className="btn-glass"
              onClick={autoLayout}
              style={{ padding: '4px 12px' }}
              title={editable ? 'Auto-layout nodes' : 'Auto-layout nodes locally for easier inspection'}
            >
              ✨
            </button>
            <button className="btn-glass" onClick={() => setShowGrid(g => !g)} style={{ padding: '4px 12px', color: showGrid ? '#3b82f6' : undefined }} title="Toggle grid overlay">▦</button>
            
            <div style={{ position: 'relative' }}>
              <button 
                className="btn-glass" 
                onClick={() => setExportMenuOpen(prev => !prev)} 
                style={{ padding: '4px 12px', color: exportMenuOpen ? '#3b82f6' : undefined }} 
                title="Export Story options (SVG, PDF, Mermaid)"
              >
                📤 Export
              </button>
              {exportMenuOpen && (
                <div className="nondraggable" style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: '8px', background: 'rgba(15, 23, 42, 0.95)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.5rem', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <button className="btn-glass" onClick={() => { exportSVG(); setExportMenuOpen(false); }} style={{ width: '100%', textAlign: 'left', padding: '8px 12px' }} title="Export as static vector image">
                    🖼️ SVG Image
                  </button>
                  <button className="btn-glass" onClick={() => { exportPDF(); setExportMenuOpen(false); }} style={{ width: '100%', textAlign: 'left', padding: '8px 12px' }} title="Multi-page PDF for printing (with grid)">
                    📄 PDF Document
                  </button>
                  <button className="btn-glass" onClick={exportMermaid} style={{ width: '100%', textAlign: 'left', padding: '8px 12px' }} title="Graphing language perfect for LLMs and documentation">
                    🤖 Mermaid (.mmd)
                  </button>
                </div>
              )}
            </div>

            <button className="btn-glass" onClick={() => setSearchOpen(s => !s)} style={{ padding: '4px 12px', color: searchOpen ? '#3b82f6' : undefined }} title="Search actions on canvas">🔍</button>
            <span style={{ width: '1px', background: 'var(--glass-border)' }} />
            {editable && <button className="btn-glass" onClick={addNote} style={{ padding: '4px 12px', color: '#fbbf24' }} title="Add sticky note">📝 {notes.length > 0 ? notes.length : ''}</button>}
            <button className="btn-glass" onClick={() => setZoom(z => Math.max(z - 0.2, 0.1))} style={{ padding: '4px 12px' }} title="Zoom out">−</button>
            <button className="btn-glass" onClick={() => setZoom(1)} style={{ padding: '4px 12px', minWidth: '60px' }} title="Reset zoom to 100%">{Math.round(zoom * 100)}%</button>
            <button className="btn-glass" onClick={() => setZoom(z => Math.min(z + 0.2, 2.5))} style={{ padding: '4px 12px' }} title="Zoom in">+</button>
          </div>

          {/* Canvas Search Overlay */}
          {searchOpen && (
            <div className="nondraggable" style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 1001, width: '360px' }}>
              <input
                autoFocus
                value={canvasSearch}
                onChange={e => setCanvasSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Escape') { setSearchOpen(false); setCanvasSearch(''); }
                  if (e.key === 'Enter') {
                    const match = actions.find(a => 
                      (a.name || '').toLowerCase().includes(canvasSearch.toLowerCase()) ||
                      (a.type || '').toLowerCase().includes(canvasSearch.toLowerCase()) ||
                      a.id?.toString() === canvasSearch ||
                      (a as any).guid === canvasSearch
                    );
                    if (match) flyToNode(match.id!);
                  }
                }}
                placeholder="Search actions... (Enter to fly, Esc to close)"
                style={{ width: '100%', padding: '0.75rem 1rem', background: 'rgba(15, 23, 42, 0.95)', border: '1.5px solid var(--accent-color)', borderRadius: '12px', color: 'white', fontSize: '0.95rem', outline: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
              />
              {canvasSearch.length > 0 && (
                <div style={{ marginTop: '8px', background: 'rgba(15, 23, 42, 0.98)', border: '1px solid var(--glass-border)', borderRadius: '12px', maxHeight: '300px', overflowY: 'auto', boxShadow: '0 12px 48px rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)' }}>
                  {actions
                    .filter(a => 
                      (a.name || '').toLowerCase().includes(canvasSearch.toLowerCase()) || 
                      (a.type || '').toLowerCase().includes(canvasSearch.toLowerCase()) ||
                      a.id?.toString().includes(canvasSearch) ||
                      (a as any).guid?.toLowerCase().includes(canvasSearch.toLowerCase())
                    )
                    .slice(0, 10)
                    .map(a => {
                      const s = getSafety(a);
                      return (
                        <div
                          key={a.id}
                          onClick={() => flyToNode(a.id!)}
                          style={{ padding: '0.75rem 1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.15)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <span style={{ fontSize: '1.1rem' }}>{s.icon}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, color: 'white', fontSize: '0.9rem' }}>{a.name || 'Unnamed'}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{(a.type || '').replace('Agents::', '')}</div>
                          </div>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>#{a.id}</span>
                        </div>
                      );
                    })}
                  {actions.filter(a => (a.name || '').toLowerCase().includes(canvasSearch.toLowerCase()) || (a.type || '').toLowerCase().includes(canvasSearch.toLowerCase())).length === 0 && (
                    <div style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center' }}>No matching actions found</div>
                  )}
                </div>
              )}
            </div>
          )}

          <div style={{
            position: 'absolute', width: '100%', height: '100%',
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            transition: isDragging ? 'none' : 'transform 0.05s linear'
          }}>
            {/* SVG Connecting Lines Layer */}
            <svg style={{ position: 'absolute', top: 0, left: 0, width: '5000px', height: '5000px', pointerEvents: 'none', overflow: 'visible' }}>
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orientation="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="rgba(255,255,255,0.3)" />
                </marker>
              </defs>
              {actions?.flatMap(act => {
                if (!act || !Array.isArray(act.sources) || act.sources.length === 0) return [];
                return act.sources.map(sourceId => {
                  const sourceAct = actions.find(a => a?.id === sourceId);
                  if (!sourceAct) return null;
                  
                  const x1 = ((sourceAct.position as any)?.x ?? (sourceAct.position as any)?.X ?? 0) + 240; 
                  const y1 = ((sourceAct.position as any)?.y ?? (sourceAct.position as any)?.Y ?? 0) + 60; 
                  const x2 = ((act.position as any)?.x ?? (act.position as any)?.X ?? 0);
                  const y2 = ((act.position as any)?.y ?? (act.position as any)?.Y ?? 0) + 60;
                  const mx = (x1 + x2) / 2;
                  const my = (y1 + y2) / 2;
                  
                  // Safety Map: color SVG links by the receiver's safety tier
                  let strokeColor = 'rgba(255,255,255,0.2)';
                  if (viewMode === 'safety') {
                    strokeColor = getEffectiveSafety(act).color;
                  }

                  // Causal Lineage Highlight [D3]
                  const isCausal = viewMode === 'debug' && causalNodeIds.has(sourceId) && causalNodeIds.has(act.id!);
                  if (isCausal) {
                    strokeColor = '#a78bfa'; // Purple glow for causal path
                  }

                  return (
                    <g key={`${sourceId}-${act.id}`} style={{ transition: 'opacity 0.3s ease' }}>
                      <path 
                        d={`M ${x1} ${y1} C ${x1 + 50} ${y1}, ${x2 - 50} ${y2}, ${x2} ${y2}`}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={isCausal ? "5" : "3"}
                        opacity={hoveredEventId && !isCausal ? "0.1" : (isCausal ? "1" : "0.8")}
                        markerEnd="url(#arrowhead)"
                        style={{ filter: isCausal ? 'drop-shadow(0 0 8px #a78bfa)' : 'none' }}
                      />
                      {editable && (
                        <>
                          <circle 
                            cx={mx} cy={my} r="8" 
                            fill="#ef4444" 
                            style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                            onClick={(e) => { e.stopPropagation(); deleteConnection(sourceId, act.id!); }}
                          >
                            <title>Delete connection</title>
                          </circle>
                          <text x={mx} y={my + 2} textAnchor="middle" style={{ fontSize: '10px', fill: 'white', pointerEvents: 'none' }}>×</text>
                        </>
                      )}
                    </g>
                  );
                }).filter(Boolean);
              })}
              
              {/* Ghost Link while connecting */}
              {connectingFromId !== null && (() => {
                 const src = actions.find(a => a.id === connectingFromId);
                 if (!src) return null;
                 const sx = (src.position?.x || 0) + 240;
                 const sy = (src.position?.y || 0) + 60;
                 // Convert screen mouse pos back to canvas coordinates
                 const tx = (dragMousePos.x - pan.x) / zoom;
                 const ty = (dragMousePos.y - pan.y) / zoom;
                 return (
                   <path 
                      d={`M ${sx} ${sy} C ${sx + 50} ${sy}, ${tx - 50} ${ty}, ${tx} ${ty}`}
                      fill="none" 
                      stroke="var(--accent-color)" 
                      strokeWidth="3" 
                      strokeDasharray="5,5"
                      opacity="0.6"
                      markerEnd="url(#arrowhead)"
                    />
                 );
              })()}
            </svg>

            {loading && <div style={{ position: 'absolute', top: 20, left: 20, opacity: 0.7 }}>Loading connections...</div>}
            
            {actions?.map(act => {
              if (!act) return null;
              const safety = getEffectiveSafety(act);
              const isOverridden = tierOverrides[act.id!] !== undefined;
              const isTrigger = act.type === 'Agents::WebhookAgent' || act.type === 'Agents::TriggerAgent';
              const isBeingDragged = draggedNode === act.id;
              const isSafetyMode = viewMode === 'safety';
              const displayLabel = customLabels[act.id!] || safety.label;
              
              return (
              <div key={act.id} className="glass-panel nondraggable" 
                onMouseDown={(e) => handleNodeMouseDown(e, act.id!)}
                onClick={(e) => handleNodeClick(e, act)}
                style={{ 
                position: 'absolute',
                left: (act.position as any)?.x ?? (act.position as any)?.X ?? 0,
                top: (act.position as any)?.y ?? (act.position as any)?.Y ?? 0,
                width: '240px', padding: '1.25rem',
                borderTop: `3px solid ${isSafetyMode ? safety.color : (isTrigger ? 'var(--success-color)' : 'var(--accent-color)')}`,
                background: isSafetyMode ? safety.bgColor : undefined,
                cursor: isBeingDragged ? 'grabbing' : 'grab', zIndex: isBeingDragged ? 50 : 10,
                userSelect: 'none', transition: isBeingDragged ? 'none' : 'box-shadow 0.2s ease, outline 0.2s ease',
                outline: highlightedNodeId === act.id || highlightedNodeIds.has(act.id!) ? '4px solid var(--accent-color)' : 'none',
                outlineOffset: '4px',
                // Causal Lineage Highlight [D3+46] - Dim non-participating nodes during a trace
                 opacity: (hoveredEventId || executionPath.size > 0 || highlightedNodeIds.size > 0) && !causalNodeIds.has(act.id!) && !highlightedNodeIds.has(act.id!) ? 0.3 : 1,
                boxShadow: viewMode === 'debug' && act.id != null ? (() => {
                  const h = getNodeHealth(act.id);
                  const signal = getSignalDisplay(h);
                  const isCausal = causalNodeIds.has(act.id!);
                  if (isCausal) return `0 0 20px 4px #a78bfa, 0 8px 32px rgba(0,0,0,0.5)`;
                  
                  return h === 'blocked' ? '0 0 0 3px #ef4444, 0 8px 32px rgba(239,68,68,0.4)'
                    : h === 'external' ? '0 0 0 3px #f97316, 0 8px 28px rgba(249,115,22,0.28)'
                    : h === 'warning' ? '0 0 0 3px #f59e0b'
                    : h === 'ok' ? '0 0 0 3px #22c55e'
                    : `0 0 0 3px ${signal.color}`;
                })() : (isBeingDragged ? '0 16px 48px rgba(0,0,0,0.6)' : '0 8px 32px rgba(0,0,0,0.3)')
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <h4 style={{ fontWeight: 600, color: 'white', margin: 0, pointerEvents: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{act.name || 'Unnamed Action'}</h4>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
                    {isSafetyMode ? (
                      <span 
                        style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 600, letterSpacing: '0.5px', background: safety.bgColor, color: safety.color, cursor: 'pointer', pointerEvents: 'auto', position: 'relative' }}
                        onClick={(e) => {
                          if (!editable) return;
                          e.stopPropagation();
                          // Cycle through tiers on click
                          const tiers: SafetyTier[] = ['safe', 'read-only', 'interactive', 'mutating'];
                          const currentIdx = tiers.indexOf(safety.tier);
                          const nextTier = tiers[(currentIdx + 1) % tiers.length];
                          setTierOverrides(prev => ({ ...prev, [act.id!]: nextTier }));
                        }}
                        onContextMenu={(e) => {
                          if (!editable) return;
                          e.preventDefault();
                          e.stopPropagation();
                          // Right-click to reset to auto
                          setTierOverrides(prev => { const n = {...prev}; delete n[act.id!]; return n; });
                          setCustomLabels(prev => { const n = {...prev}; delete n[act.id!]; return n; });
                        }}
                        title={`Click to cycle tier${isOverridden ? ' • Right-click to reset to auto' : ''}`}
                      >
                        {isOverridden ? '🔓' : ''} {safety.icon} {displayLabel}
                      </span>
                    ) : (
                      isTrigger && <span style={{ background: 'rgba(34,197,94,0.1)', color: 'var(--success-color)', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 600, letterSpacing: '0.5px', pointerEvents: 'none' }}>TRIGGER</span>
                    )}
                    {editable && <button onClick={(e) => handleDeleteAction(e, act.id!, act.name!)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.25rem', padding: 0, pointerEvents: 'auto' }} title="Delete Action">×</button>}
                  </div>
                  {/* Debug Mode: health badge */}
                  {viewMode === 'debug' && act.id != null && (() => {
                    const h = getNodeHealth(act.id);
                    const signal = getSignalDisplay(h);
                    return (
                      <span 
                        className="nondraggable"
                        style={{ 
                          fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 600,
                          background: `${signal.color}22`, color: signal.color, cursor: 'pointer', pointerEvents: 'auto'
                        }}
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setDebugNode(act); 
                          fetchRecentRuns();
                          fetchEvents();
                          if (act.id) {
                            fetchActionEvents(act.id, true);
                            fetchActionLogs(act.id, true);
                          }
                        }}
                        title={`Debug: ${signal.label} — click to inspect events`}
                      >
                        {signal.icon} {(eventMap.get(act.id) || []).length} evt{(eventMap.get(act.id) || []).length !== 1 ? 's' : ''}
                      </span>
                    );
                  })()}
                </div>
                <span style={{ fontSize: '0.75rem', color: isSafetyMode ? safety.color : (isTrigger ? 'var(--success-color)' : 'var(--accent-hover)'), pointerEvents: 'none' }}>
                  {typeof act.type === 'string' ? act.type.replace('Agents::', '') : 'Unknown Agent'}
                </span>
                {isSafetyMode && act.type === 'Agents::HTTPRequestAgent' && (
                  <div style={{ fontSize: '0.65rem', color: safety.color, marginTop: '0.25rem', opacity: 0.8, pointerEvents: 'none' }}>
                    HTTP {(act as any).options?.method?.toUpperCase() || 'UNKNOWN'} → {(act as any).options?.url?.split('/').slice(0,4).join('/') || 'N/A'}
                  </div>
                )}
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem', pointerEvents: 'none' }}>ID: {act.id}</div>
                
                {/* Connection Port (Right side) */}
                {editable && <div 
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setConnectingFromId(act.id!);
                    setDragMousePos({ x: e.clientX, y: e.clientY });
                  }}
                  onMouseUp={(e) => {
                    e.stopPropagation();
                    finalizeConnection(act.id!);
                  }}
                  className="pulse-dot"
                  style={{
                    position: 'absolute', right: '-8px', top: '50%', transform: 'translateY(-50%)',
                    width: '16px', height: '16px', background: 'var(--accent-color)',
                    border: '3px solid var(--bg-card)', borderRadius: '50%', cursor: 'crosshair',
                    zIndex: 20, pointerEvents: 'auto'
                  }}
                  title="Drag to connect"
                />}
                
                {/* Drop Target (Left side - invisible but active) */}
                {editable && <div 
                  onMouseUp={(e) => {
                    e.stopPropagation();
                    finalizeConnection(act.id!);
                  }}
                  style={{
                    position: 'absolute', left: '-10px', top: 0, bottom: 0, width: '30px',
                    zIndex: 15, pointerEvents: 'auto'
                  }}
                />}
              </div>
            )})}

            {/* Board Notes / Comments */}
            {notes.map(note => (
              <div
                key={`note-${note.id}`}
                className="nondraggable"
                onMouseDown={(e) => {
                  if (!editable) return;
                  e.stopPropagation();
                  setDraggedNoteId(note.id);
                  setNoteDragOffset({ x: e.clientX / zoom - note.x, y: e.clientY / zoom - note.y });
                }}
                onDoubleClick={(e) => {
                  if (!editable) return;
                  e.stopPropagation();
                  setEditingNoteId(note.id);
                }}
                style={{
                  position: 'absolute',
                  left: note.x,
                  top: note.y,
                  width: '180px',
                  minHeight: '80px',
                  background: `${note.color}dd`,
                  borderRadius: '4px',
                  padding: '0.75rem',
                  boxShadow: draggedNoteId === note.id ? '0 12px 36px rgba(0,0,0,0.5)' : '0 4px 12px rgba(0,0,0,0.3)',
                  cursor: draggedNoteId === note.id ? 'grabbing' : 'grab',
                  zIndex: draggedNoteId === note.id ? 60 : 5,
                  userSelect: 'none',
                  transition: draggedNoteId === note.id ? 'none' : 'box-shadow 0.2s ease',
                  fontFamily: "'Georgia', serif",
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.65rem', color: 'rgba(0,0,0,0.4)', fontWeight: 600 }}>📌 NOTE</span>
                  {editable && <button
                    onClick={(e) => { e.stopPropagation(); setNotes(prev => prev.filter(n => n.id !== note.id)); }}
                    style={{ background: 'transparent', border: 'none', color: 'rgba(0,0,0,0.3)', cursor: 'pointer', fontSize: '1rem', padding: 0, pointerEvents: 'auto', lineHeight: 1 }}
                    title="Delete note"
                  >×</button>}
                </div>
                {editingNoteId === note.id ? (
                  <textarea
                    autoFocus
                    value={note.text}
                    onChange={(e) => setNotes(prev => prev.map(n => n.id === note.id ? { ...n, text: e.target.value } : n))}
                    onBlur={() => setEditingNoteId(null)}
                    onKeyDown={(e) => { if (e.key === 'Escape') setEditingNoteId(null); }}
                    style={{ width: '100%', minHeight: '50px', background: 'transparent', border: 'none', color: 'rgba(0,0,0,0.8)', fontSize: '0.8rem', resize: 'vertical', outline: 'none', fontFamily: "'Georgia', serif" }}
                  />
                ) : (
                  <div style={{ fontSize: '0.8rem', color: 'rgba(0,0,0,0.8)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {note.text}
                  </div>
                )}
              </div>
            ))};

            {/* Numbered Grid Overlay */}
            {showGrid && actions.length > 0 && (() => {
              const grid = getGridInfo();
              return grid.cells.map(cell => (
                <div key={`grid-${cell.label}`} style={{
                  position: 'absolute', left: cell.x, top: cell.y, width: cell.w, height: cell.h,
                  border: '1.5px dashed rgba(71, 85, 105, 0.5)',
                  pointerEvents: 'none', zIndex: 1
                }}>
                  <div style={{
                    position: 'absolute', top: 4, left: 6,
                    background: 'rgba(30, 41, 59, 0.85)', padding: '2px 8px', borderRadius: '4px',
                    fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.5px'
                  }}>
                    P{cell.page} · {cell.label}
                  </div>
                </div>
              ));
            })()}

            {/* Safety Map Legend */}
            {viewMode === 'safety' && (
              <div style={{ position: 'fixed', top: '120px', right: '20px', zIndex: 2000, background: 'rgba(15, 23, 42, 0.95)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '1rem 1.25rem', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', minWidth: '200px' }}>
                <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', fontWeight: 600, color: 'white' }}>Safety Classification</h4>
                {(['safe', 'read-only', 'interactive', 'mutating'] as SafetyTier[]).map(tier => {
                  const info = SAFETY_TIERS[tier];
                  const count = actions.filter(a => getSafety(a).tier === tier).length;
                  return (
                    <div key={tier} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.8rem' }}>
                      <span>{info.icon}</span>
                      <span style={{ color: info.color, fontWeight: 500, flex: 1 }}>{info.label}</span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Create Action Drawer — Collapsible */}
        {editable && (viewMode === 'canvas' || viewMode === 'safety') && (
          <div className="glass-panel nondraggable" style={{ 
            width: toolsCollapsed ? '40px' : '280px', 
            padding: toolsCollapsed ? '1rem 0.5rem' : '1.5rem', 
            background: 'rgba(59, 130, 246, 0.05)', borderColor: 'rgba(59, 130, 246, 0.2)',
            transition: 'width 0.25s ease, padding 0.25s ease',
            overflow: 'hidden', flexShrink: 0, position: 'relative'
          }}>
          <button 
            onClick={() => setToolsCollapsed(c => !c)}
            style={{ position: 'absolute', top: '0.5rem', right: toolsCollapsed ? '0.5rem' : '0.75rem', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1rem', zIndex: 10 }}
            title={toolsCollapsed ? 'Show tools' : 'Hide tools'}
          >
            {toolsCollapsed ? '◂' : '▸'}
          </button>
          {!toolsCollapsed && (
          <>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem', fontWeight: 500 }}>Create Action</h3>
          <form onSubmit={handleCreateAction} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ACTION NAME</label>
              <input required value={actionName} onChange={e => setActionName(e.target.value)} placeholder="e.g. Receive Webhook" style={{ background: 'var(--bg-card)', color: 'white', border: '1px solid var(--glass-border)', padding: '0.75rem', borderRadius: '8px' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ACTION TYPE</label>
              <select value={actionType} onChange={e => setActionType(e.target.value)} style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: 'white', borderRadius: '8px', outline: 'none' }}>
                <optgroup label="🟢 Entry Points">
                  <option value="Agents::WebhookAgent">Webhook — Receive inbound data</option>
                  <option value="Agents::FormAgent">Form — Collect user input</option>
                  <option value="Agents::IMAPAgent">IMAP — Monitor email inbox</option>
                </optgroup>
                <optgroup label="🔵 Logic & Transform">
                  <option value="Agents::EventTransformationAgent">Event Transform — Reshape data</option>
                  <option value="Agents::TriggerAgent">Trigger — Conditional branching</option>
                  <option value="Agents::GroupAgent">Group — Batch & aggregate events</option>
                </optgroup>
                <optgroup label="🟡 Communication">
                  <option value="Agents::HTTPRequestAgent">HTTP Request — Make API calls</option>
                  <option value="Agents::EmailAgent">Email — Send email notifications</option>
                  <option value="Agents::LLMAgent">LLM — AI language model</option>
                </optgroup>
                <optgroup label="🔴 Advanced">
                  <option value="Agents::SendToStoryAgent">Send to Story — Chain automations</option>
                </optgroup>
              </select>
            </div>

            <button type="submit" className="btn-primary" disabled={creating} style={{ marginTop: '0.5rem' }}>
              {creating ? 'Building...' : '+ Attach Action'}
            </button>
          </form>

          {/* Quick Templates */}
          <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>⚡ Quick Templates</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[
                { name: 'Receive Webhook', type: 'Agents::WebhookAgent', icon: '🌐', desc: 'Inbound HTTP trigger' },
                { name: 'HTTP GET Request', type: 'Agents::HTTPRequestAgent', icon: '📡', desc: 'Fetch external data' },
                { name: 'Slack Notification', type: 'Agents::HTTPRequestAgent', icon: '💬', desc: 'Post to Slack channel' },
                { name: 'Conditional Branch', type: 'Agents::TriggerAgent', icon: '🔀', desc: 'If/then logic split' },
                { name: 'Data Transform', type: 'Agents::EventTransformationAgent', icon: '🔄', desc: 'Reshape event payload' },
                { name: 'LLM Summarize', type: 'Agents::LLMAgent', icon: '🧠', desc: 'AI text generation' },
                { name: 'Send Email Alert', type: 'Agents::EmailAgent', icon: '📧', desc: 'Email notification' },
              ].map(tpl => (
                <button
                  key={tpl.name}
                  className="btn-glass"
                  disabled={creating}
                    onClick={async () => {
                      if (safetyLock) return;
                      setCreating(true);
                    addLog('NETWORK', `Creating template: ${tpl.name}`);
                    try {
                      await actionsApi.createAction({ actionCreateRequest: { name: tpl.name, type: tpl.type as any, storyId: storyId, options: {}, position: {} as any } });
                      addLog('SUCCESS', `Template "${tpl.name}" attached!`);
                      fetchActions();
                    } catch (err: any) { addLog('ERROR', `Template failed: ${err.message}`); }
                    setCreating(false);
                  }}
                  style={{ textAlign: 'left', padding: '0.5rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <span style={{ fontSize: '1rem' }}>{tpl.icon}</span>
                  <div>
                    <div style={{ fontWeight: 500 }}>{tpl.name}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{tpl.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
        )}
      </div>
    )}
          {/* Phase 54: Story Event Ledger View */}
          {viewMode === 'ledger' && (
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 100, background: '#0f172a' }}>
              <StoryLedger 
                storyId={Number(storyId)}
                actions={actions}
                refreshVersion={ledgerRefreshVersion}
                onFlyToNode={(id) => {
                  setViewMode('canvas');
                  setTimeout(() => flyToNode(id), 100);
                }}
                onClose={() => setViewMode('canvas')}
              />
            </div>
          )}

        {inspectedNode && viewMode !== 'debug' && <NodeInspector action={inspectedNode} tenant={tenant} apiKey={apiKey} readOnly={!editable} onClose={() => setInspectedNode(null)} />}
        {debugNode && viewMode === 'debug' && (
          <DebugInspector
            action={debugNode}
            events={eventMap.get(debugNode.id!) || []}
            logs={actionLogMap.get(debugNode.id!) || []}
            readOnly={!editable}
            onClose={() => {
              setDebugNode(null);
              setExecutionPath(new Set());
              setSelectedEventId(null);
            }}
            onRefresh={() => {
              fetchRecentRuns(true);
              fetchEvents();
              if (debugNode?.id) {
                fetchActionEvents(debugNode.id, true);
                fetchActionLogs(debugNode.id, true);
              }
            }}
            onHoverEvent={setHoveredEventId}
            onNavigateToEvent={handleNavigateToEvent}
            highlightEventId={selectedEventId}
            tenant={tenant}
            apiKey={apiKey}
          />
        )}
      </div>

      {viewMode === 'debug' && !debugLoading && (
        <div style={{
          position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(15,18,30,0.9)', border: '1px solid rgba(139,92,246,0.4)',
          borderRadius: '12px', padding: '0.6rem 1.25rem',
          display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center',
          backdropFilter: 'blur(12px)', zIndex: 1000, boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
        }}>
          {!debugBarExpanded ? (
            <button
              className="btn-glass"
              onClick={() => setDebugBarExpanded(true)}
              style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}
              title={`Expand debug bar. Current status: ${getSignalDisplay(runDebugCounts.overallSignal).label}.`}
            >
              <span style={{ color: '#a78bfa', fontWeight: 700 }}>🐛 Debug</span>
              <div
                className="pulse-dot"
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: getSignalDisplay(runDebugCounts.overallSignal).color,
                  boxShadow: `0 0 8px ${getSignalDisplay(runDebugCounts.overallSignal).color}`,
                }}
              />
            </button>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#a78bfa', fontWeight: 700 }}>🐛 DEBUG</span>
                <div
                  className="pulse-dot"
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: getSignalDisplay(runDebugCounts.overallSignal).color,
                    boxShadow: `0 0 8px ${getSignalDisplay(runDebugCounts.overallSignal).color}`,
                  }}
                />
              </div>
              <button
                className="btn-glass"
                onClick={() => setDebugBarExpanded(false)}
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                title="Collapse debug bar"
              >
                ▾ Collapse
              </button>
              <select 
                value={selectedRunGuid || ''} 
                onChange={e => setSelectedRunGuid(e.target.value || null)}
                className="btn-glass"
                style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', maxWidth: '190px' }}
              >
                <option value="">{`All Runs (${debugLookbackHours}h)`}</option>
                {debugRunOptions.map(({ guid, label }) => (
                  <option key={guid} value={guid}>{label}</option>
                ))}
              </select>
              <span style={{ height: '1rem', width: '1px', background: 'rgba(255,255,255,0.1)' }} />
              <span title={selectedRunGuid ? `${runDebugCounts.totalEvents} events across ${runDebugCounts.actionCount} actions in the selected execution run.` : `${runDebugCounts.totalEvents} events across ${runDebugCounts.actionCount} actions in the last ${debugLookbackHours} hours.`} style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Scope: <strong style={{ color: 'white' }}>{runDebugCounts.totalEvents}</strong> events
              </span>
              <span title="Execution-only signals derived from run events and any correlated logs." style={{ fontSize: '0.72rem', color: '#94a3b8', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Exec
              </span>
              <span
                title="Combined event and log signals that indicate a local flow break in this run scope."
                style={{ fontSize: '0.78rem', color: runDebugCounts.blockedEvents > 0 ? '#ef4444' : 'var(--text-secondary)' }}
              >
                ⛔ {runDebugCounts.blockedEvents}
              </span>
              <span
                title="Combined event and log signals that indicate downstream HTTP or remote-system issues."
                style={{ fontSize: '0.78rem', color: runDebugCounts.externalEvents > 0 ? '#f97316' : 'var(--text-secondary)' }}
              >
                🌐 {runDebugCounts.externalEvents}
              </span>
              <span
                title="Combined event and log warnings worth review."
                style={{ fontSize: '0.78rem', color: runDebugCounts.warningEvents > 0 ? '#f59e0b' : 'var(--text-secondary)' }}
              >
                ⚠️ {runDebugCounts.warningEvents}
              </span>
              <span
                title="Events classified as healthy."
                style={{ fontSize: '0.78rem', color: '#22c55e' }}
              >
                ✅ {runDebugCounts.okEvents}
              </span>
              <span
                title="Raw error-level action logs returned by Tines for actions participating in this execution scope."
                style={{ fontSize: '0.78rem', color: runDebugCounts.blockedLogs > 0 ? '#ef4444' : 'var(--text-secondary)' }}
              >
                🪵 {runDebugCounts.blockedLogs}
              </span>
              <span style={{ height: '1rem', width: '1px', background: 'rgba(255,255,255,0.1)' }} />
              <span title="Story/action live-activity signals from supported REST fields such as not_working, last_error_log_at, and pending action runs." style={{ fontSize: '0.72rem', color: '#94a3b8', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Health
              </span>
              <span 
                className="btn-status-error"
                style={{ 
                  fontSize: '0.78rem', 
                  color: runDebugCounts.liveBlockedActions > 0 ? '#ef4444' : 'var(--text-secondary)', 
                  cursor: 'pointer',
                  fontWeight: 700,
                  background: highlightedNodeIds.size > 0 ? 'rgba(239,68,68,0.2)' : 'transparent',
                  padding: '2px 6px', borderRadius: '4px'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (highlightedNodeIds.size > 0) {
                    setHighlightedNodeIds(new Set());
                    return;
                  }
                  const errIds = actions.filter(a => classifyActionLiveSignal(a) === 'blocked').map(a => a.id!);
                  setHighlightedNodeIds(new Set(errIds));
                }}
                title="Click to highlight actions that Tines currently reports as not working."
              >⛔ {runDebugCounts.liveBlockedActions}</span>
              <span
                title="Actions with recent error-log or monitor/backlog signals from live activity."
                style={{ fontSize: '0.78rem', color: runDebugCounts.liveWarningActions > 0 ? '#f59e0b' : 'var(--text-secondary)' }}
              >
                ⚠️ {runDebugCounts.liveWarningActions}
              </span>
              {runDebugCounts.livePendingRuns > 0 && <span title="Story-level backlog currently pending in Tines." style={{ fontSize: '0.78rem', color: '#60a5fa' }}>⏳ {runDebugCounts.livePendingRuns}</span>}
            </>
          )}
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Fetched: {lastEventFetch ? lastEventFetch.toLocaleTimeString() : 'N/A'}</span>
          
          <button 
            className="btn-glass"
            onClick={() => {
              fetchStoryMetadata();
              fetchActions();
              fetchRecentRuns(true);
              fetchEvents();
              // Refresh current debug logs if active
              if (debugNode?.id) {
                fetchActionEvents(debugNode.id, true);
                fetchActionLogs(debugNode.id, true);
              }
            }}
            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
            title="Force Global Refresh"
          >
            🔄
          </button>
        </div>
      )}
      </>
      )}
    </div>
  );
}
