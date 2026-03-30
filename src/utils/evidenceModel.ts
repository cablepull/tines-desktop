/**
 * Evidence Model: The normalization layer for the Tines Flow Debugger.
 * Correlates disparate API entities (Actions, Events, Logs) into a unified execution narrative.
 */

export type EntityType = 'action' | 'event' | 'log' | 'run' | 'record' | 'audit';

export interface EvidenceBase {
  id: string | number;
  type: EntityType;
  timestamp: string;
  source: string; // API Endpoint or origin
  confidence: number; // 0.0 to 1.0
}

export interface ActionEvidence extends EvidenceBase {
  type: 'action';
  name: string;
  agentType: string;
  status: 'ok' | 'error' | 'warning' | 'none';
  pendingCount: number;
}

export interface EventEvidence extends EvidenceBase {
  type: 'event';
  actionId: number;
  runGuid: string;
  previousEventIds: string[];
  payload: any;
  isReemitted: boolean;
}

export interface LogEvidence extends EvidenceBase {
  type: 'log';
  actionId?: number;
  level: 'info' | 'warn' | 'error';
  message: string;
  inboundEvent?: any;
}

export interface EvidenceModel {
  storyId: number;
  mode: 'live' | 'test' | 'draft';
  nodes: Map<number, ActionEvidence>;
  events: Map<string, EventEvidence>; // keyed by event UUID
  logs: LogEvidence[];
  
  // Correlations
  actionToEvents: Map<number, string[]>; // Action ID -> Event IDs
  eventToLogs: Map<string, LogEvidence[]>; // Event ID (via timestamp/proximity) -> Logs
}

export const createEmptyModel = (storyId: number, mode: 'live' | 'test' | 'draft'): EvidenceModel => ({
  storyId,
  mode,
  nodes: new Map(),
  events: new Map(),
  logs: [],
  actionToEvents: new Map(),
  eventToLogs: new Map(),
});

/**
 * Normalizes a Tines Action API response into ActionEvidence
 */
export const normalizeAction = (action: any): ActionEvidence => {
  return {
    id: action.id,
    type: 'action',
    timestamp: action.updated_at || action.created_at,
    source: `/api/v1/actions/${action.id}`,
    confidence: 1.0,
    name: action.name,
    agentType: action.type,
    status: action.not_working ? 'error' : (action.last_error_log_at ? 'warning' : 'ok'),
    pendingCount: action.pending_action_runs_count || 0,
  };
};

/**
 * Normalizes a Tines Event API response into EventEvidence
 */
export const normalizeEvent = (event: any): EventEvidence => {
  return {
    id: event.id,
    type: 'event',
    timestamp: event.created_at,
    source: `/api/v1/events/${event.id}`,
    confidence: 1.0,
    actionId: event.action_id,
    runGuid: event.story_run_guid,
    previousEventIds: event.previous_event_ids || [],
    payload: event.content || event.output,
    isReemitted: !!event.reemitted,
  };
};
