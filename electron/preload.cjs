const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getProfiles: () => ipcRenderer.invoke('get-profiles'),
  saveProfile: (profile) => ipcRenderer.invoke('save-profile', profile),
  deleteProfile: (name) => ipcRenderer.invoke('delete-profile', name),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  
  // DuckDB Persistence
  dbSaveEvents: (events) => ipcRenderer.invoke('db-save-events', events),
  dbSaveLogs: (logs) => ipcRenderer.invoke('db-save-logs', logs),
  dbGetEvents: (args) => ipcRenderer.invoke('db-get-events', args),
  dbGetLogs: (args) => ipcRenderer.invoke('db-get-logs', args),
  dbGetDebugSummary: (args) => ipcRenderer.invoke('db-get-debug-summary', args),
  dbSaveInvestigation: (investigation) => ipcRenderer.invoke('db-save-investigation', investigation),
  dbListInvestigations: (args) => ipcRenderer.invoke('db-list-investigations', args),
  dbGetInvestigation: (id) => ipcRenderer.invoke('db-get-investigation', id),
  dbDeleteInvestigation: (id) => ipcRenderer.invoke('db-delete-investigation', id),
  dbClearAll: () => ipcRenderer.invoke('db-clear-all')
});
