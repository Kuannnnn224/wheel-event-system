const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pmToolDesktop', {
  getDataDirectory: () => ipcRenderer.invoke('pm-tool:get-data-directory'),
  chooseDataDirectory: () => ipcRenderer.invoke('pm-tool:choose-data-directory'),
  saveFile: (payload) => ipcRenderer.invoke('pm-tool:save-file', payload),
  showItemInFolder: (filePath) => ipcRenderer.invoke('pm-tool:show-item-in-folder', filePath),
});
