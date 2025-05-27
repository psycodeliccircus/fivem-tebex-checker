// main.js (processo principal)
const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const path    = require('path');
const fs      = require('fs');
const AdmZip  = require('adm-zip');
const { autoUpdater } = require('electron-updater');

let mainWindow;
const ARCHIVE_EXTS = ['.zip', '.pack'];

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800, height: 600,
    icon: path.join(__dirname, 'build/icon.png'),
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.loadFile('index.html');

  // Links externos
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

  // Auto‐update
  autoUpdater.autoDownload = true;
  autoUpdater.checkForUpdatesAndNotify();
  autoUpdater.on('update-available',     () => mainWindow.webContents.send('update_available'));
  autoUpdater.on('update-downloaded',    () => mainWindow.webContents.send('update_downloaded'));
  autoUpdater.on('update-not-available', () => mainWindow.webContents.send('update_not_available'));
  autoUpdater.on('error', err => console.error('Update error:', err));
}

app.whenReady().then(createWindow);

// 1) Selecionar pasta
ipcMain.handle('select-folder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  return canceled ? null : filePaths[0];
});

// 2) Selecionar arquivo compactado
ipcMain.handle('select-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Arquivos compactados', extensions: ARCHIVE_EXTS.map(e => e.slice(1)) },
      { name: 'Todos os arquivos',    extensions: ['*'] }
    ]
  });
  return canceled ? null : filePaths[0];
});

// varre recursivamente diretório em busca de .fxap
function collectFxapFromDir(baseDir) {
  const found = [];
  (function walk(dir) {
    fs.readdirSync(dir).forEach(name => {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) {
        walk(full);
      } else {
        if (name.toLowerCase().endsWith('.fxap')) {
          found.push(path.relative(baseDir, full));
        }
      }
    });
  })(baseDir);
  return found;
}

// handler único: check-encryption
ipcMain.handle('check-encryption', async (_, selectedPath) => {
  if (!selectedPath) return { withRes: [], withoutRes: [] };

  const withRes = [];
  const withoutRes = [];
  const stats = fs.statSync(selectedPath);
  const name  = path.basename(selectedPath);

  if (stats.isDirectory()) {
    const fxaps = collectFxapFromDir(selectedPath);
    if (fxaps.length) withRes.push({ name, full: selectedPath });
    else withoutRes.push(name);
  }
  else if (stats.isFile() && ARCHIVE_EXTS.includes(path.extname(selectedPath).toLowerCase())) {
    const zip = new AdmZip(selectedPath);
    const fxaps = zip.getEntries()
      .map(e => e.entryName)
      .filter(n => n.toLowerCase().endsWith('.fxap'));
    if (fxaps.length) withRes.push({ name, full: selectedPath });
    else withoutRes.push(name);
  }
  else {
    withoutRes.push(name);
  }

  return { withRes, withoutRes };
});

// handler novo: delete-resource — deleta todo recurso (pasta ou arquivo)
ipcMain.handle('delete-resource', async (_, basePath, resourceFullPath) => {
  try {
    if (!fs.existsSync(resourceFullPath)) {
      return { success: false, error: 'Recurso não encontrado' };
    }
    const stats = fs.statSync(resourceFullPath);
    if (stats.isDirectory()) {
      // deleta pasta recursivamente
      fs.rmSync(resourceFullPath, { recursive: true, force: true });
    } else {
      // deleta arquivo (ZIP/pack)
      fs.unlinkSync(resourceFullPath);
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// controles de janela e update
ipcMain.handle('window-minimize',   () => mainWindow.minimize());
ipcMain.handle('window-close',      () => mainWindow.close());
ipcMain.handle('check_for_updates', () => autoUpdater.checkForUpdates());
ipcMain.handle('restart_app',       () => autoUpdater.quitAndInstall());
