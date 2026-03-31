const { app, BrowserWindow, ipcMain, safeStorage, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const db = require('./db.cjs');

const profilesPath = () => path.join(app.getPath('userData'), 'tines-profiles.enc');
const isDev = process.env.NODE_ENV === 'development';
const remoteDebugPort = process.env.REMOTE_DEBUG_PORT || '9223';

if (isDev && !app.commandLine.hasSwitch('remote-debugging-port')) {
  app.commandLine.appendSwitch('remote-debugging-port', remoteDebugPort);
}

// Initialize DuckDB
app.whenReady().then(async () => {
  await db.init(app.getPath('userData'));
});

ipcMain.handle('db-save-events', (event, events) => db.saveEvents(events));
ipcMain.handle('db-save-logs', (event, logs) => db.saveLogs(logs));
ipcMain.handle('db-get-events', (event, { storyId, actionId, limit, offset, runGuid, sinceIso }) => db.getEvents(storyId, actionId, limit, offset, runGuid, sinceIso));
ipcMain.handle('db-get-logs', (event, { storyId, actionId, limit, offset, runGuid, sinceIso }) => db.getLogs(storyId, actionId, limit, offset, runGuid, sinceIso));
ipcMain.handle('db-get-debug-summary', (event, { storyId, runGuid, sinceIso }) => db.getDebugSummary(storyId, { runGuid, sinceIso }));
ipcMain.handle('db-save-investigation', (event, investigation) => db.saveInvestigation(investigation));
ipcMain.handle('db-list-investigations', (event, args) => db.listInvestigations(args));
ipcMain.handle('db-get-investigation', (event, id) => db.getInvestigation(id));
ipcMain.handle('db-delete-investigation', (event, id) => db.deleteInvestigation(id));
ipcMain.handle('db-clear-all', () => db.clearDatabase());

ipcMain.handle('get-profiles', () => {
  const pPath = profilesPath();
  if (!fs.existsSync(pPath)) return [];
  try {
    const encrypted = fs.readFileSync(pPath);
    if (!safeStorage.isEncryptionAvailable()) return JSON.parse(encrypted.toString());
    const decrypted = safeStorage.decryptString(encrypted);
    return JSON.parse(decrypted);
  } catch (e) {
    console.error('Failed to read profiles', e);
    return [];
  }
});

ipcMain.handle('save-profile', (event, profile) => {
  let profiles = [];
  const pPath = profilesPath();
  if (fs.existsSync(pPath)) {
    try {
      const encrypted = fs.readFileSync(pPath);
      const decrypted = safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(encrypted) : encrypted.toString();
      profiles = JSON.parse(decrypted);
    } catch(e) {}
  }
  
  const idx = profiles.findIndex(p => p.name === profile.name);
  if (idx > -1) profiles[idx] = profile;
  else profiles.push(profile);

  const json = JSON.stringify(profiles);
  const data = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(json) : Buffer.from(json);
  fs.writeFileSync(pPath, data);
  return profiles;
});

ipcMain.handle('delete-profile', (event, name) => {
  const pPath = profilesPath();
  if (!fs.existsSync(pPath)) return [];
  let profiles = [];
  try {
    const encrypted = fs.readFileSync(pPath);
    const decrypted = safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(encrypted) : encrypted.toString();
    profiles = JSON.parse(decrypted);
    profiles = profiles.filter(p => p.name !== name);
    const json = JSON.stringify(profiles);
    const data = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(json) : Buffer.from(json);
    fs.writeFileSync(pPath, data);
  } catch(e) {}
  return profiles;
});

ipcMain.handle('open-external', async (event, url) => {
  await shell.openExternal(url);
  return true;
});

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
    titleBarStyle: 'hiddenInset', // looks premium on macOS
  });

  if (isDev) {
    mainWindow.loadURL(`http://localhost:${process.env.VITE_PORT || 5199}`);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Allow opening DevTools in production with a shortcut for Alpha debugging
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if ((input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i') {
      mainWindow.webContents.openDevTools();
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
