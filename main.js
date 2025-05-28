// main.js (processo principal)
const {
  app, BrowserWindow, dialog, ipcMain, shell,
  Tray, Menu
} = require('electron');
const path   = require('path');
const fs     = require('fs');
const AdmZip = require('adm-zip');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let appTray;                // instância do Tray
const ARCHIVE_EXTS = ['.zip', '.pack'];

// =====================
// Cria a janela principal
// =====================
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800, height: 600,
    icon: getAssetPath('icon.png'),
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  mainWindow.loadFile('index.html');

  // Ao fechar, só esconde (até o usuário "Sair" via tray)
  mainWindow.on('close', e => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  // Links externos sempre no navegador
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

// =====================
// Gera o caminho correto para ícones/assets
// =====================
function getAssetPath(fileName) {
  if (app.isPackaged) {
    // Em produção, os arquivos ficam em resources/app.asar ou resources/app
    return path.join(process.resourcesPath, 'build', fileName);
  } else {
    // Em desenvolvimento
    return path.join(__dirname, 'build', fileName);
  }
}

// =====================
// Cria o ícone de Tray + menu
// =====================
function createTray() {
  if (appTray) return; // já existe

  appTray = new Tray(getAssetPath('icon.png'));
  const trayMenu = Menu.buildFromTemplate([
    {
      label: 'Verificar Update',
      click: () => autoUpdater.checkForUpdates()
    },
    {
      label: 'Sair',
      click: () => {
        app.isQuitting = true;
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

// =====================
// Inicialização
// =====================
app.whenReady().then(() => {
  // Necessário no Windows para notificações, Tray, etc.
  app.setAppUserModelId('com.github.psycodeliccircus.fivem-tebex-checker');

  createTray();
  createWindow();
});

// Re-exibe a janela no macOS ao clicar no dock icon
app.on('activate', () => mainWindow.show());

// Antes de dar app.quit(), marca a flag para não interceptar o close
app.on('before-quit', () => app.isQuitting = true);

// =====================
// Todos os handlers de IPC
// =====================

// Selecionar pasta
ipcMain.handle('select-folder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  return canceled ? null : filePaths[0];
});

// Selecionar arquivo compactado
ipcMain.handle('select-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Compactados',      extensions: ARCHIVE_EXTS.map(e => e.slice(1)) },
      { name: 'Todos os arquivos', extensions: ['*'] }
    ]
  });
  return canceled ? null : filePaths[0];
});

// Coleta .fxap recursivamente
function collectFxapFromDir(dir) {
  const found = [];
  (function walk(current) {
    for (const name of fs.readdirSync(current)) {
      const full = path.join(current, name);
      if (fs.statSync(full).isDirectory()) {
        walk(full);
      } else if (name.toLowerCase().endsWith('.fxap')) {
        found.push(path.relative(dir, full));
      }
    }
  })(dir);
  return found;
}

// Lista recursiva de subpastas
function listAllDirectories(baseDir) {
  const list = [];
  const baseName = path.basename(baseDir);
  list.push({ name: baseName, full: baseDir });
  (function walk(current, relPath) {
    for (const name of fs.readdirSync(current)) {
      const full = path.join(current, name);
      if (fs.statSync(full).isDirectory()) {
        const relName = relPath ? `${relPath}/${name}` : name;
        list.push({ name: relName, full });
        walk(full, relName);
      }
    }
  })(baseDir, '');
  return list;
}

// Scaneia um único recurso
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
  return fxaps.length
    ? { name, full: fullPath, files: fxaps }
    : null;
}

// Handler principal de scan
ipcMain.handle('check-encryption', async (_, selectedPath) => {
  const withRes = [], withoutRes = [];
  if (!selectedPath || !fs.existsSync(selectedPath)) return { withRes, withoutRes };

  const stat = fs.statSync(selectedPath);
  if (stat.isFile() && ARCHIVE_EXTS.includes(path.extname(selectedPath).toLowerCase())) {
    const name = path.basename(selectedPath);
    const res  = scanSingleResource(selectedPath, name);
    res ? withRes.push(res) : withoutRes.push(name);
    return { withRes, withoutRes };
  }
  if (stat.isDirectory()) {
    const rootName = path.basename(selectedPath);
    const rootScan = scanSingleResource(selectedPath, rootName);
    if (rootScan) {
      withRes.push(rootScan);
      return { withRes, withoutRes };
    }
    const dirs = listAllDirectories(selectedPath).slice(1);
    for (const { name, full } of dirs) {
      const sc = scanSingleResource(full, name);
      sc ? withRes.push(sc) : withoutRes.push(name);
    }
  }
  return { withRes, withoutRes };
});

// Handler de deleção
ipcMain.handle('delete-resource', async (_, _unused, resourceFullPath) => {
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

// Janela + updates
ipcMain.handle('window-minimize',   () => mainWindow.minimize());
ipcMain.handle('window-close',      () => mainWindow.close());
ipcMain.handle('check_for_updates', () => autoUpdater.checkForUpdates());
ipcMain.handle('restart_app',       () => autoUpdater.quitAndInstall());
