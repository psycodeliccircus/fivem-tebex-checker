const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // pasta/arquivo
  selectFolder:        () => ipcRenderer.invoke('select-folder'),
  selectFile:          () => ipcRenderer.invoke('select-file'),

  // scan
  checkEncryption:     (path) => ipcRenderer.invoke('check-encryption', path),
  deleteResource:      (path, res) => ipcRenderer.invoke('delete-resource', path, res),
  onProgress:          (cb) => ipcRenderer.on('check-progress', (_e, data) => cb(data)),

  //version
  getAppInfo:          () => ipcRenderer.invoke('get-app-info'),

  // updates
  checkForUpdates:     () => ipcRenderer.invoke('check_for_updates'),
  onUpdateAvailable:   (cb) => ipcRenderer.on('update_available',    () => cb()),
  onUpdateProgress:    (cb) => ipcRenderer.on('update-progress',     (_e, data) => cb(data)),
  onUpdateDownloaded:  (cb) => ipcRenderer.on('update_downloaded',   () => cb()),
  onUpdateNotAvailable:(cb) => ipcRenderer.on('update_not_available',() => cb()),
  restartApp:          () => ipcRenderer.invoke('restart_app'),

  // janela
  windowMaximize:      () => ipcRenderer.invoke('window-maximize'),
  windowMinimize:      () => ipcRenderer.invoke('window-minimize'),
  windowClose:         () => ipcRenderer.invoke('window-close'),
});
