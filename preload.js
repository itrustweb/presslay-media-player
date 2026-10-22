const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('pmp', {
  ready: () => ipcRenderer.invoke('ready'),
  pickFiles: () => ipcRenderer.invoke('pick-files'),
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  expand: (list) => ipcRenderer.invoke('expand', list),
  loadState: () => ipcRenderer.invoke('load-state'),
  saveState: (s) => ipcRenderer.send('save-state', s),
  tags: (p) => ipcRenderer.invoke('tags', p),
  mini: (on) => ipcRenderer.send('mini', on),
  exportM3u: (name, files) => ipcRenderer.invoke('export-m3u', name, files),
  importM3u: () => ipcRenderer.invoke('import-m3u'),
  reveal: (p) => ipcRenderer.send('reveal', p),
  pathFor: (f) => webUtils.getPathForFile(f),
  onOpen: (cb) => ipcRenderer.on('open-files', (e, l) => cb(l)),
  onCmd: (cb) => ipcRenderer.on('cmd', (e, c) => cb(c))
});
