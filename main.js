// main.js (processo principal)
const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const AdmZip = require('adm-zip');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    icon: path.join(__dirname, 'build/icon.png'),
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');

  // --- intercepta tentativas de abrir novas janelas (target="_blank", window.open)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // --- intercepta navegações normais (href sem target)
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // se for uma URL externa, previne e abre no navegador
    if (url !== mainWindow.webContents.getURL()) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Auto‐update
  autoUpdater.autoDownload = true;
  autoUpdater.checkForUpdatesAndNotify();
  autoUpdater.on('update-available', () => {
    mainWindow.webContents.send('update_available');
  });
  autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send('update_downloaded');
  });
  autoUpdater.on('error', err => {
    console.error('Update error:', err);
  });
}

app.whenReady().then(createWindow);

// Selecionar pasta ou ZIP
ipcMain.handle('select-path', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory', 'openFile'],
    filters: [{ name: 'ZIP e Pastas', extensions: ['zip'] }]
  });
  return canceled ? null : filePaths[0];
});

// Classificar recursos em sem/com Tebex
ipcMain.handle('check-encryption', async (event, basePath) => {
  const withRes = [];
  const withoutRes = [];

  if (!fs.statSync(basePath).isDirectory()) {
    return { withRes, withoutRes };
  }

  for (const folder of fs.readdirSync(basePath)) {
    const full = path.join(basePath, folder);
    if (!fs.statSync(full).isDirectory()) continue;

    const fxap = [];
    (function walk(dir) {
      for (const f of fs.readdirSync(dir)) {
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) walk(p);
        else if (path.extname(p).toLowerCase() === '.fxap') {
          fxap.push(path.relative(basePath, p));
        }
      }
    })(full);

    if (fxap.length) withRes.push({ name: folder, files: fxap });
    else withoutRes.push(folder);
  }

  return { withRes, withoutRes };
});

// Deletar .fxap
ipcMain.handle('delete-files', async (event, basePath, files) => {
  try {
    const stat = fs.statSync(basePath);
    if (stat.isFile() && path.extname(basePath).toLowerCase() === '.zip') {
      const zip = new AdmZip(basePath);
      files.forEach(e => zip.deleteFile(e));
      zip.writeZip(basePath);
    } else {
      files.forEach(rel => {
        const full = path.join(basePath, rel);
        if (fs.existsSync(full)) fs.unlinkSync(full);
      });
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Controles de janela
ipcMain.handle('window-minimize', () => mainWindow.minimize());
ipcMain.handle('window-close',    () => mainWindow.close());

// Forçar check e restart de updates
ipcMain.handle('check_for_updates', () => autoUpdater.checkForUpdates());
ipcMain.handle('restart_app',      () => autoUpdater.quitAndInstall());
