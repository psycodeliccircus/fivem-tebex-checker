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

  // abre links externos
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

// Selecionar pasta
ipcMain.handle('select-folder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  return canceled ? null : filePaths[0];
});

// Selecionar arquivo .zip/.pack
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

// varre recursivamente por .fxap dentro de um diretório
function collectFxapFromDir(baseDir) {
  const found = [];
  (function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) {
        walk(full);
      } else if (name.toLowerCase().endsWith('.fxap')) {
        found.push(path.relative(baseDir, full));
      }
    }
  })(baseDir);
  return found;
}

// check-encryption: lista CADA subpasta e CADA ZIP/PACK dentro da pasta selecionada
ipcMain.handle('check-encryption', async (_, selectedPath) => {
  if (!selectedPath) return { withRes: [], withoutRes: [] };

  const withRes = [];
  const withoutRes = [];
  const stats = fs.statSync(selectedPath);
  
  // Se for diretório, lista seus filhos como recursos separados
  if (stats.isDirectory()) {
    for (const entry of fs.readdirSync(selectedPath)) {
      const full = path.join(selectedPath, entry);
      const ext  = path.extname(entry).toLowerCase();

      if (fs.statSync(full).isDirectory()) {
        // subpasta
        const fxaps = collectFxapFromDir(full);
        if (fxaps.length) withRes.push({ name: entry, full, files: fxaps });
        else withoutRes.push(entry);
      }
      else if (ARCHIVE_EXTS.includes(ext)) {
        // arquivo compactado
        const zip = new AdmZip(full);
        const fxaps = zip.getEntries()
          .map(e => e.entryName)
          .filter(n => n.toLowerCase().endsWith('.fxap'));
        if (fxaps.length) withRes.push({ name: entry, full, files: fxaps });
        else withoutRes.push(entry);
      }
    }
  }
  // Se for um arquivo compactado selecionado diretamente
  else if (stats.isFile() && ARCHIVE_EXTS.includes(path.extname(selectedPath).toLowerCase())) {
    const entryName = path.basename(selectedPath);
    const zip = new AdmZip(selectedPath);
    const fxaps = zip.getEntries()
      .map(e => e.entryName)
      .filter(n => n.toLowerCase().endsWith('.fxap'));
    if (fxaps.length) withRes.push({ name: entryName, full: selectedPath, files: fxaps });
    else withoutRes.push(entryName);
  }

  return { withRes, withoutRes };
});

// delete-resource: deleta inteira pasta ou arquivo compactado
ipcMain.handle('delete-resource', async (_, basePath, resourceFullPath) => {
  try {
    if (!fs.existsSync(resourceFullPath)) {
      return { success: false, error: 'Recurso não encontrado' };
    }
    const s = fs.statSync(resourceFullPath);
    if (s.isDirectory()) {
      fs.rmSync(resourceFullPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(resourceFullPath);
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
