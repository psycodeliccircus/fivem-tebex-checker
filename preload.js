// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectFolder:        () => ipcRenderer.invoke('select-folder'),
  selectFile:          () => ipcRenderer.invoke('select-file'),
  checkEncryption:     (p) => ipcRenderer.invoke('check-encryption', p),
  deleteResource:      (p, r) => ipcRenderer.invoke('delete-resource', p, r),

  // progresso
  onProgress:          (cb) => ipcRenderer.on('check-progress', (_e, data) => cb(data)),

  // updates
  checkForUpdates:     () => ipcRenderer.invoke('check_for_updates'),
  onUpdateAvailable:   (cb) => ipcRenderer.on('update_available',    () => cb()),
  onUpdateDownloaded:  (cb) => ipcRenderer.on('update_downloaded',   () => cb()),
  onUpdateNotAvailable:(cb) => ipcRenderer.on('update_not_available',() => cb()),
  restartApp:          () => ipcRenderer.invoke('restart_app'),

  // janelas
  windowMinimize:      () => ipcRenderer.invoke('window-minimize'),
  windowClose:         () => ipcRenderer.invoke('window-close'),
});
