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

  // abrir links externos
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

  // auto‐update
  autoUpdater.autoDownload = true;
  autoUpdater.checkForUpdatesAndNotify();
  autoUpdater.on('update-available',     () => mainWindow.webContents.send('update_available'));
  autoUpdater.on('update-downloaded',    () => mainWindow.webContents.send('update_downloaded'));
  autoUpdater.on('update-not-available', () => mainWindow.webContents.send('update_not_available'));
  autoUpdater.on('error', err => console.error('Update error:', err));
}

app.whenReady().then(createWindow);

// 1) Selecionar somente pastas
ipcMain.handle('select-folder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  return canceled ? null : filePaths[0];
});

// 2) Selecionar somente arquivos .zip ou .pack
ipcMain.handle('select-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Arquivos Compactados', extensions: ARCHIVE_EXTS.map(e => e.slice(1)) },
      { name: 'Todos os Arquivos',   extensions: ['*'] }
    ]
  });
  return canceled ? null : filePaths[0];
});

// varre recursivamente um diretório procurando .fxap
function collectFxapFromDir(baseDir) {
  const found = [];
  (function walk(dir) {
    fs.readdirSync(dir).forEach(name => {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) {
        walk(full);
      } else {
        const f = name.toLowerCase();
        if (f.endsWith('.fxap')) {
          found.push(path.relative(baseDir, full));
        }
      }
    });
  })(baseDir);
  return found;
}

// Handler único de verificação
ipcMain.handle('check-encryption', async (_, selectedPath) => {
  if (!selectedPath) return { withRes: [], withoutRes: [] };

  const withRes = [];
  const withoutRes = [];
  const stats = fs.statSync(selectedPath);
  const name  = path.basename(selectedPath);

  if (stats.isDirectory()) {
    // pasta: varre tudo dentro
    const fxaps = collectFxapFromDir(selectedPath);
    if (fxaps.length) {
      withRes.push({ name, files: fxaps });
    } else {
      withoutRes.push(name);
    }
  }
  else if (stats.isFile() && ARCHIVE_EXTS.includes(path.extname(selectedPath).toLowerCase())) {
    // arquivo compactado: abre e filtra por entradas que terminam em .fxap
    const zip = new AdmZip(selectedPath);
    const fxaps = zip.getEntries()
      .map(e => e.entryName)
      .filter(n => n.toLowerCase().endsWith('.fxap'));
    if (fxaps.length) {
      withRes.push({ name, files: fxaps });
    } else {
      withoutRes.push(name);
    }
  }
  else {
    // outro tipo de arquivo
    withoutRes.push(name);
  }

  return { withRes, withoutRes };
});

// Handler de exclusão de .fxap
ipcMain.handle('delete-files', async (_, basePath, files) => {
  try {
    const stats = fs.statSync(basePath);
    const ext   = path.extname(basePath).toLowerCase();
    if (stats.isFile() && ARCHIVE_EXTS.includes(ext)) {
      const zip = new AdmZip(basePath);
      files.forEach(f => zip.deleteFile(f));
      zip.writeZip(basePath);
    } else {
      files.forEach(rel => {
        const full = path.join(basePath, rel);
        if (fs.existsSync(full)) fs.unlinkSync(full);
      });
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Controles de janela e update
ipcMain.handle('window-minimize',   () => mainWindow.minimize());
ipcMain.handle('window-close',      () => mainWindow.close());
ipcMain.handle('check_for_updates', () => autoUpdater.checkForUpdates());
ipcMain.handle('restart_app',       () => autoUpdater.quitAndInstall());
