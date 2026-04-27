const { contextBridge, ipcRenderer } = require('electron');

let pendingApiRequests = 0;

function emitLoadingState() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('api-loading', {
    detail: {
      pending: pendingApiRequests,
      loading: pendingApiRequests > 0
    }
  }));
}

function invokeWithLoading(channel, ...args) {
  pendingApiRequests += 1;
  emitLoadingState();

  // Intercept responses to handle not-authenticated signals from main
  return ipcRenderer.invoke(channel, ...args)
    .then((res) => {
      try {
        if (res && (res.notAuthenticated === true)) {
          // Intentar redirigir la ventana al login
          try {
            // limpiar session en renderer si existe
            try { localStorage.removeItem('app_session'); } catch (e) {}
            location.href = 'public/login.html';
          } catch (e) {
            // noop
          }
        }
      } catch (e) {
        // noop
      }
      return res;
    })
    .finally(() => {
      pendingApiRequests = Math.max(0, pendingApiRequests - 1);
      emitLoadingState();
    });
}

contextBridge.exposeInMainWorld('adidasAPI', {
  saveImage: (dataUrl, filename) => invokeWithLoading('save-image', dataUrl, filename)
});

contextBridge.exposeInMainWorld('api', {
  getRopas: () => invokeWithLoading('get-ropas'),
  downloadFile: (data) => invokeWithLoading('download-file', data),
  enviarCategorias: (data) => invokeWithLoading('enviar-categorias', data),
  validarRfid: (data) => invokeWithLoading('validar-rfid', data),
  validarRfidArcos: (data) => invokeWithLoading('validar-rfid-arcos', data),
  getSelects: (data) => invokeWithLoading('get-selects', data),
  getSelects2: (data) => invokeWithLoading('get-selects2', data),
  getSelectsMateriales: (data) => invokeWithLoading('get-selects-materiales', data),
  getLocales: (data) => invokeWithLoading('get-locales', data),
  getHomeData: (data) => invokeWithLoading('get-home-data', data),
  findProcesoElectoral: (data) => invokeWithLoading('find-proceso-electoral', data),
  getMarcacionesReporte: (data) => invokeWithLoading('get-marcaciones-reporte', data),
  limpiarDatos: (data) => invokeWithLoading('limpiar-datos', data),
  // Handlers de configuración
  saveSettings: (key, value) => invokeWithLoading('save-settings', key, value),
  getSettings: (key) => invokeWithLoading('get-settings', key),
  hasSettings: (key) => invokeWithLoading('has-settings', key),
  unsetSettings: (key) => invokeWithLoading('unset-settings', key),
  reloadApiConfig: () => invokeWithLoading('reload-api-config'),
  getAllSettings: () => invokeWithLoading('get-all-settings'),
  // Handlers de configuración de antena
  saveAntennaConfig: (config) => invokeWithLoading('save-antenna-config', config),
  getAntennaConfig: () => invokeWithLoading('get-antenna-config'),
  reloadAntennaConfig: () => invokeWithLoading('reload-antenna-config'),
  getReaderConfig: () => invokeWithLoading('get-reader-config'),
  applyBeeperConfig: (config) => invokeWithLoading('apply-beeper-config', config),
  // Handlers de RFID
  getRFIDStatus: () => invokeWithLoading('get-rfid-status'),
  // Generic makeRequest that uses main process makeRequest (respects config.api.baseUrl)
  makeRequest: (endpoint, method, data) => invokeWithLoading('make-request', endpoint, method, data),
  // Listeners para eventos RFID
  onRFIDTagDetected: (callback) => ipcRenderer.on('rfid-tag-detected', (event, data) => callback(data)),
  onRFIDStatusChange: (callback) => ipcRenderer.on('rfid-status', (event, data) => callback(data)),
  // Remover listeners
  removeRFIDListeners: () => {
    ipcRenderer.removeAllListeners('rfid-tag-detected');
    ipcRenderer.removeAllListeners('rfid-status');
  }
});
