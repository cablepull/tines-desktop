export interface InvestigationRecord {
  id?: string;
  name: string;
  tenant?: string;
  story_id: number;
  mode: 'live' | 'test' | 'draft';
  draft_id?: number;
  created_at?: string;
  updated_at?: string;
  screenshot_data_url?: string | null;
  selected_run_guid?: string | null;
  selected_event_id?: number | null;
  debug_action_id?: number | null;
  highlighted_node_ids?: number[];
  notes?: Array<{ id: number; x: number; y: number; text: string; color: string }>;
}

export interface IElectronAPI {
  getProfiles: () => Promise<any[]>;
  saveProfile: (profile: any) => Promise<any[]>;
  deleteProfile: (name: string) => Promise<any[]>;
  openExternal: (url: string) => Promise<boolean>;
  
  // DuckDB Persistence
  dbSaveEvents: (events: any[]) => Promise<void>;
  dbSaveLogs: (logs: any[]) => Promise<void>;
  dbGetEvents: (params: { storyId: number; actionId?: number; limit?: number; offset?: number }) => Promise<any[]>;
  dbGetLogs: (params: { storyId: number; actionId?: number; limit?: number; offset?: number }) => Promise<any[]>;
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
