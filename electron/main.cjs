const { app, BrowserWindow, ipcMain, safeStorage, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const profilesPath = () => path.join(app.getPath('userData'), 'tines-profiles.enc');

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

const isDev = process.env.NODE_ENV === 'development';

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
    mainWindow.loadURL('http://localhost:5199');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
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
