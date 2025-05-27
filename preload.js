// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectFolder:        () => ipcRenderer.invoke('select-folder'),
  selectFile:          () => ipcRenderer.invoke('select-file'),
  checkEncryption:     p  => ipcRenderer.invoke('check-encryption', p),
  deleteResource:      (base, full) => ipcRenderer.invoke('delete-resource', base, full),
  minimize:            () => ipcRenderer.invoke('window-minimize'),
  close:               () => ipcRenderer.invoke('window-close'),
  checkForUpdates:     () => ipcRenderer.invoke('check_for_updates'),
  restartApp:          () => ipcRenderer.invoke('restart_app'),
  onUpdateAvailable:   cb => ipcRenderer.on('update_available', cb),
  onUpdateDownloaded:  cb => ipcRenderer.on('update_downloaded', cb),
  onUpdateNotAvailable:cb => ipcRenderer.on('update_not_available', cb)
});
