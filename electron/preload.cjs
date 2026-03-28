const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getProfiles: () => ipcRenderer.invoke('get-profiles'),
  saveProfile: (profile) => ipcRenderer.invoke('save-profile', profile),
  deleteProfile: (name) => ipcRenderer.invoke('delete-profile', name),
  openExternal: (url) => ipcRenderer.invoke('open-external', url)
});
