const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  startOpenClaw: () => ipcRenderer.invoke('start-openclaw'),
  startCrabwalk: () => ipcRenderer.invoke('start-crabwalk'),
  stopProcess: (name: string) => ipcRenderer.invoke('stop-process', name),
  getProcessStatus: () => ipcRenderer.invoke('get-process-status'),
  checkLaunchAgent: () => ipcRenderer.invoke('check-launch-agent'),
  enableLaunchAgent: () => ipcRenderer.invoke('enable-launch-agent'),
  disableLaunchAgent: () => ipcRenderer.invoke('disable-launch-agent'),
  getPaths: () => ipcRenderer.invoke('get-paths'),
  getOpenClawPanelUrl: () => ipcRenderer.invoke('get-openclaw-panel-url'),
  getCrabwalkPanelUrl: () => ipcRenderer.invoke('get-crabwalk-panel-url'),
  waitAndOpenOpenClaw: () => ipcRenderer.invoke('wait-and-open-openclaw'),
  waitAndOpenCrabwalk: () => ipcRenderer.invoke('wait-and-open-crabwalk'),
  openInSafari: (url: string) => ipcRenderer.invoke('open-in-safari', url),
  getAutoStartConfig: () => ipcRenderer.invoke('get-autostart-config'),
  saveAutoStartConfig: (config: any) => ipcRenderer.invoke('save-autostart-config', config),
  getProjectDefaults: () => ipcRenderer.invoke('get-project-defaults'),
  getEffectiveConfig: () => ipcRenderer.invoke('get-effective-config'),
  onServiceStarted: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on('service-started', callback)
    return () => ipcRenderer.removeListener('service-started', callback)
  },
})
