const {
  app, BrowserWindow, dialog, ipcMain, shell,
  Tray, Menu
} = require('electron');
const path   = require('path');
const fs     = require('fs');
const AdmZip = require('adm-zip');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let appTray;
const ARCHIVE_EXTS = ['.zip', '.pack'];

function getAssetPath(fileName) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'build', fileName);
  } else {
    return path.join(__dirname, 'build', fileName);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    icon: getAssetPath('icon.png'),
    //fullscreen: true,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  mainWindow.maximize();

  mainWindow.loadFile('index.html');

  mainWindow.on('close', e => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (url !== mainWindow.webContents.getURL()) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  autoUpdater.autoDownload = true;
  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater
    .on('update-available', () => {
      mainWindow.webContents.send('update_available');
    })
    .on('download-progress', progress => {
      mainWindow.webContents.send('update-progress', {
        percent: progress.percent,
        transferred: progress.transferred,
        total: progress.total
      });
    })
    .on('update-downloaded', () => {
      mainWindow.webContents.send('update_downloaded');
    })
    .on('update-not-available', () => {
      mainWindow.webContents.send('update_not_available');
    })
    .on('error', err => {
      console.error('Update error:', err);
    });
}

function createTray() {
  if (appTray) return;
  appTray = new Tray(getAssetPath('icon.png'));
  const trayMenu = Menu.buildFromTemplate([
    { type: 'separator' },
    { label: 'Verificar Update', click: () => autoUpdater.checkForUpdates() },
    {
      label: 'Sair',
      click: () => {
        app.isQuitting = true;
        if (appTray) { appTray.destroy(); appTray = null; }
        app.quit();
      }
    }
  ]);
  appTray.setToolTip('FiveM Tebex Checker');
  appTray.setContextMenu(trayMenu);
  appTray.on('click', () => {
    if (mainWindow.isVisible()) mainWindow.hide();
    else mainWindow.show();
  });
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.github.psycodeliccircus.fivem-tebex-checker');
  createTray();
  createWindow();
});

app.on('activate', () => {
  if (mainWindow) mainWindow.show();
});

app.on('before-quit', () => {
  app.isQuitting = true;
  if (appTray) { appTray.destroy(); appTray = null; }
});

// === Scan helpers ===

function collectFxapFromDir(dir) {
  const found = [];
  (function walk(cur) {
    for (const name of fs.readdirSync(cur)) {
      const full = path.join(cur, name);
      if (fs.statSync(full).isDirectory()) {
        walk(full);
      } else if (name.toLowerCase().endsWith('.fxap')) {
        found.push(path.relative(dir, full));
      }
    }
  })(dir);
  return found;
}

function listAllDirectories(baseDir) {
  const list = [];
  const baseName = path.basename(baseDir);
  list.push({ name: baseName, full: baseDir });
  (function walk(cur, rel) {
    for (const name of fs.readdirSync(cur)) {
      const full = path.join(cur, name);
      if (fs.statSync(full).isDirectory()) {
        const relName = rel ? `${rel}/${name}` : name;
        list.push({ name: relName, full });
        walk(full, relName);
      }
    }
  })(baseDir, '');
  return list;
}

function scanSingleResource(fullPath, name) {
  const stat = fs.statSync(fullPath);
  let fxaps = [];
  if (stat.isDirectory()) {
    fxaps = collectFxapFromDir(fullPath);
  } else if (ARCHIVE_EXTS.includes(path.extname(fullPath).toLowerCase())) {
    const zip = new AdmZip(fullPath);
    fxaps = zip.getEntries()
      .map(e => e.entryName)
      .filter(n => n.toLowerCase().endsWith('.fxap'));
  }
  return fxaps.length ? { name, full: fullPath, files: fxaps } : null;
}

// === IPC handlers ===

ipcMain.handle('select-folder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  return canceled ? null : filePaths[0];
});

ipcMain.handle('select-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Compactados', extensions: ARCHIVE_EXTS.map(e => e.slice(1)) },
      { name: 'Todos os arquivos', extensions: ['*'] }
    ]
  });
  return canceled ? null : filePaths[0];
});

// check-encryption with progress
ipcMain.handle('check-encryption', async (event, selectedPath) => {
  const withRes = [], withoutRes = [];
  if (!selectedPath || !fs.existsSync(selectedPath)) {
    event.sender.send('check-progress', { processed: 0, total: 0, current: '' });
    return { withRes, withoutRes };
  }

  const stat = fs.statSync(selectedPath);
  let items = [];
  if (stat.isFile() && ARCHIVE_EXTS.includes(path.extname(selectedPath).toLowerCase())) {
    items = [{ name: path.basename(selectedPath), full: selectedPath }];
  } else if (stat.isDirectory()) {
    const all = listAllDirectories(selectedPath);
    items = all.slice(1);
  }

  const total = items.length;
  event.sender.send('check-progress', { processed: 0, total, current: '' });

  for (let i = 0; i < items.length; i++) {
    const { name, full } = items[i];
    const res = scanSingleResource(full, name);
    if (res) withRes.push(res);
    else withoutRes.push(name);

    event.sender.send('check-progress', {
      processed: i + 1,
      total,
      current: name
    });
  }

  return { withRes, withoutRes };
});

ipcMain.handle('delete-resource', async (_e, _u, resourceFullPath) => {
  try {
    if (!fs.existsSync(resourceFullPath)) {
      return { success: false, error: 'Recurso não encontrado' };
    }
    const stat = fs.statSync(resourceFullPath);
    if (stat.isDirectory()) {
      fs.rmSync(resourceFullPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(resourceFullPath);
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('window-close', () => {
  app.isQuitting = true;
  if (appTray) { appTray.destroy(); appTray = null; }
  mainWindow.destroy();
  app.quit();
});

ipcMain.handle('window-minimize', () => mainWindow.minimize());
ipcMain.handle('check_for_updates', () => autoUpdater.checkForUpdates());
ipcMain.handle('restart_app', () => autoUpdater.quitAndInstall());

// Expõe nome e versão ao renderer
ipcMain.handle('get-app-info', () => {
  return {
    name: "FiveM Tebex Checker",
    version: app.getVersion()
  };
});
