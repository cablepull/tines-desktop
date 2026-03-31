export interface InvestigationArtifact {
  id: string;
  kind: 'screenshot' | 'event' | 'run' | 'logs' | 'node-events' | 'node-logs';
  label: string;
  filename: string;
  mime_type: string;
  content: string;
}

export interface InvestigationRecord {
  id?: string;
  name: string;
  tenant?: string;
  story_id: number;
  mode: 'live' | 'test' | 'draft';
  status?: 'open' | 'needs_review' | 'resolved' | 'archived';
  summary?: string;
  findings?: string;
  draft_id?: number;
  created_at?: string;
  updated_at?: string;
  screenshot_data_url?: string | null;
  selected_run_guid?: string | null;
  selected_event_id?: number | null;
  debug_action_id?: number | null;
  highlighted_node_ids?: number[];
  notes?: Array<{ id: number; x: number; y: number; text: string; color: string }>;
  artifacts?: InvestigationArtifact[];
}

export interface IElectronAPI {
  getProfiles: () => Promise<any[]>;
  saveProfile: (profile: any) => Promise<any[]>;
  deleteProfile: (name: string) => Promise<any[]>;
  openExternal: (url: string) => Promise<boolean>;
  
  // DuckDB Persistence
  dbSaveEvents: (events: any[]) => Promise<void>;
  dbSaveLogs: (logs: any[]) => Promise<void>;
  dbGetEvents: (params: { storyId: number; actionId?: number; limit?: number; offset?: number; runGuid?: string | null; sinceIso?: string | null }) => Promise<any[]>;
  dbGetLogs: (params: { storyId: number; actionId?: number; limit?: number; offset?: number; runGuid?: string | null; sinceIso?: string | null }) => Promise<any[]>;
  dbGetDebugSummary: (params: { storyId: number; runGuid?: string | null; sinceIso?: string | null }) => Promise<{ story_id: number; run_guid?: string | null; since_iso?: string | null; events: any[]; logs: any[] }>;
  dbSaveInvestigation: (investigation: InvestigationRecord) => Promise<InvestigationRecord>;
  dbListInvestigations: (params?: { storyId?: number; limit?: number }) => Promise<InvestigationRecord[]>;
  dbGetInvestigation: (id: string) => Promise<InvestigationRecord | null>;
  dbDeleteInvestigation: (id: string) => Promise<void>;
  dbClearAll: () => Promise<void>;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
