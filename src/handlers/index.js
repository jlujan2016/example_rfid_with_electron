/**
 * Punto de entrada para todos los handlers IPC
 * Registra automáticamente todos los handlers con ipcMain
 */

const { ipcMain } = require('electron');
const apiHandlers = require('./api-handlers');
const fileHandlers = require('./file-handlers');
const settingsHandlers = require('./settings-handlers');
const rfidHandlers = require('./rfid-handlers');

/**
 * Registrar todos los handlers IPC
 */
function registerHandlers() {
  console.log('Registrando handlers IPC...');

  // Handlers de archivos
  ipcMain.handle('save-image', fileHandlers.handleSaveImage);
  ipcMain.handle('download-file', fileHandlers.handleDownloadFile);
  ipcMain.handle('get-selects', apiHandlers.handleGetSelects);
  ipcMain.handle('get-selects2', apiHandlers.handleGetSelects2);
  ipcMain.handle('get-selects-materiales', apiHandlers.handleGetSelectsMateriales);
  ipcMain.handle('get-home-data', apiHandlers.handleGetHomeData);
  ipcMain.handle('get-ropas', fileHandlers.handleGetRopas);

  // Locales
  ipcMain.handle('get-locales', apiHandlers.handleGetLocales);

  // Handlers de API
  ipcMain.handle('enviar-categorias', apiHandlers.handleEnviarCategorias);
  ipcMain.handle('validar-rfid', apiHandlers.handleValidarRfid);
  ipcMain.handle('validar-rfid-arcos', apiHandlers.handleValidarRfidArcos);
  ipcMain.handle('find-proceso-electoral', apiHandlers.handleFindProcesoElectoral);
  ipcMain.handle('get-marcaciones-reporte', apiHandlers.handleGetMarcacionesReporte);
  ipcMain.handle('limpiar-datos', apiHandlers.handleLimpiarDatos);
  // Exponer makeRequest genérico para el renderer (invoca la función central que usa config.api.baseUrl)
  ipcMain.handle('make-request', async (event, endpoint, method = 'GET', data = null) => {
    try {
      return await apiHandlers.makeRequest(endpoint, method, data);
    } catch (err) {
      // Devolver error serializable
      return { success: false, error: err && err.message ? err.message : String(err), __internalError: { code: err.code, address: err.address, port: err.port } };
    }
  });

  // Handlers de configuración
  ipcMain.handle('save-settings', settingsHandlers.handleSaveSettings);
  ipcMain.handle('get-settings', settingsHandlers.handleGetSettings);
  ipcMain.handle('has-settings', settingsHandlers.handleHasSettings);
  ipcMain.handle('unset-settings', settingsHandlers.handleUnsetSettings);
  ipcMain.handle('reload-api-config', settingsHandlers.handleReloadApiConfig);
  ipcMain.handle('get-all-settings', settingsHandlers.handleGetAllSettings);

  // Handlers de configuración de antena
  ipcMain.handle('save-antenna-config', settingsHandlers.handleSaveAntennaConfig);
  ipcMain.handle('get-antenna-config', settingsHandlers.handleGetAntennaConfig);
  ipcMain.handle('reload-antenna-config', settingsHandlers.handleReloadAntennaConfig);
  ipcMain.handle('get-reader-config', rfidHandlers.handleGetReaderConfig);
  ipcMain.handle('apply-beeper-config', rfidHandlers.handleApplyBeeperConfig);

  // Handlers de RFID
  ipcMain.handle('get-rfid-status', rfidHandlers.handleGetRFIDStatus);

  console.log('✓ Handlers IPC registrados correctamente');
}

/**
 * Remover todos los handlers (útil para hot reload)
 */
function unregisterHandlers() {
  ipcMain.removeHandler('save-image');
  ipcMain.removeHandler('download-file');
  ipcMain.removeHandler('get-ropas');
  ipcMain.removeHandler('enviar-categorias');
  ipcMain.removeHandler('save-settings');
  ipcMain.removeHandler('get-settings');
  ipcMain.removeHandler('has-settings');
  ipcMain.removeHandler('unset-settings');
  ipcMain.removeHandler('reload-api-config');
  ipcMain.removeHandler('save-antenna-config');
  ipcMain.removeHandler('get-antenna-config');
  ipcMain.removeHandler('reload-antenna-config');
  ipcMain.removeHandler('get-rfid-status');
}

module.exports = {
  registerHandlers,
  unregisterHandlers,
  apiHandlers,
  fileHandlers,
  settingsHandlers,
  rfidHandlers
};
