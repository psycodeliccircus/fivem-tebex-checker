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
    width: 800,
    height: 600,
    icon: path.join(__dirname, 'build/icon.png'),
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  mainWindow.loadFile('index.html');

  // Força links externos no navegador padrão
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
  autoUpdater
    .on('update-available',     () => mainWindow.webContents.send('update_available'))
    .on('update-downloaded',    () => mainWindow.webContents.send('update_downloaded'))
    .on('update-not-available', () => mainWindow.webContents.send('update_not_available'))
    .on('error', err => console.error('Update error:', err));
}

app.whenReady().then(createWindow);


// --- Helpers ---

/** Abre diálogo para pasta */
ipcMain.handle('select-folder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  return canceled ? null : filePaths[0];
});

/** Abre diálogo para arquivo .zip/.pack */
ipcMain.handle('select-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Compactados',     extensions: ARCHIVE_EXTS.map(e => e.slice(1)) },
      { name: 'Todos os arquivos', extensions: ['*'] }
    ]
  });
  return canceled ? null : filePaths[0];
});

/**
 * Coleta todos os .fxap sob um diretório, recursivamente.
 * @param {string} dir 
 * @returns {string[]} caminhos relativos
 */
function collectFxapFromDir(dir) {
  const found = [];
  (function walk(current) {
    for (const name of fs.readdirSync(current)) {
      const full = path.join(current, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (name.toLowerCase().endsWith('.fxap')) {
        found.push(path.relative(dir, full));
      }
    }
  })(dir);
  return found;
}

/**
 * Reúne recursivamente todos os diretórios dentro de baseDir,
 * incluindo o próprio baseDir.
 * @param {string} baseDir 
 * @returns {{ name: string, full: string }[]}
 */
function listAllDirectories(baseDir) {
  const list = [];
  const baseName = path.basename(baseDir);
  list.push({ name: baseName, full: baseDir });

  (function walk(current, relPath) {
    for (const name of fs.readdirSync(current)) {
      const full = path.join(current, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        const relName = relPath ? `${relPath}/${name}` : name;
        list.push({ name: relName, full });
        walk(full, relName);
      }
    }
  })(baseDir, '');

  return list;
}

/**
 * Verifica um recurso único (diretório ou archive) e retorna
 * { name, full, files } se contiver .fxap, ou null caso contrário.
 */
function scanSingleResource(fullPath, name) {
  const stat = fs.statSync(fullPath);
  let fxaps = [];

  if (stat.isDirectory()) {
    fxaps = collectFxapFromDir(fullPath);
  } else {
    const ext = path.extname(fullPath).toLowerCase();
    if (ARCHIVE_EXTS.includes(ext)) {
      const zip = new AdmZip(fullPath);
      fxaps = zip.getEntries()
        .map(e => e.entryName)
        .filter(n => n.toLowerCase().endsWith('.fxap'));
    }
  }

  return fxaps.length
    ? { name, full: fullPath, files: fxaps }
    : null;
}


// --- Handler principal ---

/**
 * check-encryption:
 * - Se selecionou arquivo .zip/.pack → verifica só ele.
 * - Se selecionou pasta:
 *    • Se ela mesma contiver .fxap em qualquer nível → trata pasta inteira.
 *    • Senão → lista cada subpasta e classifica separadamente.
 */
ipcMain.handle('check-encryption', async (_, selectedPath) => {
  const withRes = [];
  const withoutRes = [];

  if (!selectedPath || !fs.existsSync(selectedPath)) {
    return { withRes, withoutRes };
  }

  const stat = fs.statSync(selectedPath);

  // 1) Seleção é arquivo compactado?
  if (stat.isFile() && ARCHIVE_EXTS.includes(path.extname(selectedPath).toLowerCase())) {
    const name = path.basename(selectedPath);
    const result = scanSingleResource(selectedPath, name);
    if (result) withRes.push(result);
    else        withoutRes.push(name);
    return { withRes, withoutRes };
  }

  // 2) Seleção é pasta
  if (stat.isDirectory()) {
    // 2a) checa se ela mesma tem algum .fxap
    const rootName = path.basename(selectedPath);
    const rootScan = scanSingleResource(selectedPath, rootName);
    if (rootScan) {
      withRes.push(rootScan);
      return { withRes, withoutRes };
    }
    // 2b) senão, lista todas as subpastas
    const dirs = listAllDirectories(selectedPath);
    // remove o primeiro item (é a própria base) já que sabemos que não tem .fxap nele
    dirs.shift();

    for (const { name, full } of dirs) {
      const scan = scanSingleResource(full, name);
      if (scan)     withRes.push(scan);
      else          withoutRes.push(name);
    }
  }

  return { withRes, withoutRes };
});


/** delete-resource: deleta pasta ou arquivo compactado */
ipcMain.handle('delete-resource', async (_event, _unused, resourceFullPath) => {
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

// Controles de janela e auto‐update
ipcMain.handle('window-minimize',   () => mainWindow.minimize());
ipcMain.handle('window-close',      () => mainWindow.close());
ipcMain.handle('check_for_updates', () => autoUpdater.checkForUpdates());
ipcMain.handle('restart_app',       () => autoUpdater.quitAndInstall());
