// preload.js (exposição segura)
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectPath:        () => ipcRenderer.invoke('select-path'),
  checkEncryption:   p  => ipcRenderer.invoke('check-encryption', p),
  deleteFiles:       (p,f) => ipcRenderer.invoke('delete-files', p, f),
  minimize:          () => ipcRenderer.invoke('window-minimize'),
  close:             () => ipcRenderer.invoke('window-close'),
  checkForUpdates:   () => ipcRenderer.invoke('check_for_updates'),
  restartApp:        () => ipcRenderer.invoke('restart_app'),
  onUpdateAvailable: cb => ipcRenderer.on('update_available', cb),
  onUpdateDownloaded:cb => ipcRenderer.on('update_downloaded', cb)
});
