//require('electron-reload')(__dirname);
const { app, BrowserWindow } = require('electron');
const path = require('path');

// Importar handlers organizados
const { registerHandlers, rfidHandlers } = require('./src/handlers');

// Importar servicio de antena RFID
const rfidService = require('./src/antena/rfid-service');
const antenaConfig = require('./src/antena/config');

process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';

// require('electron-reload')(__dirname, {
//   electron: require(`${__dirname}/node_modules/electron`)
// });

function createWindow() {
  const mainWindow = new BrowserWindow({
    title: 'GLEF - Antenas App',
    width: 1366,
    height: 768,
    icon: app.isPackaged
      ? path.join(process.resourcesPath, 'icon.ico')
      : path.join(__dirname, 'build/icons/icons.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: true,
      nodeIntegration: true,
      webSecurity: false, // Deshabilitar la seguridad web para permitir CORS
    }
  });

  // mainWindow.setMenuBarVisibility(false);
  mainWindow.setMenu(null);
  // mainWindow.setResizable(false);
  // mainWindow.setMaximizable(false);
  // mainWindow.setFullScreenable(true);
  // mainWindow.setFullScreen(true);
  // mainWindow.setAlwaysOnTop(true);
  mainWindow.setBackgroundColor('#00356B');
  mainWindow.setTitle('ONPE - Antenas App ');
  // mainWindow.setProgressBar(0.5);
  // mainWindow.setOpacity(0.9);
  // mainWindow.setVisibleOnAllWorkspaces(true);
  mainWindow.setSkipTaskbar(false); // Mostrar en barra de tareas
  // mainWindow.setContentProtection(true);
  // mainWindow.setFocusable(true);

  // mainWindow.setIcon(path.join(__dirname, 'public/icons/icons.png'));

  mainWindow.loadFile('index.html');

  // Abrir DevTools cuando el contenido esté listo
  mainWindow.webContents.once('did-finish-load', () => {
  // mainWindow.webContents.openDevTools();
    // mainWindow.webContents.openDevTools({ mode: 'detach' });
  });
  // mainWindow.setIcon(path.join(__dirname, 'public/icons/icons.ico'));
}

app.whenReady().then(() => {
  // Registrar todos los handlers IPC
  registerHandlers();

  // Inicializar servicios de antena RFID
  rfidService.start();

  createWindow();

  // Inicializar conexión RFID del main process con la ventana principal
  const mainWindow = BrowserWindow.getAllWindows()[0];
  rfidHandlers.initRFIDConnection(mainWindow, antenaConfig.servidor.puerto);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // Detener servicios de antena RFID
  rfidService.stop();

  // Cerrar conexión RFID del main process
  rfidHandlers.closeRFIDConnection();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Manejo de cierre graceful
app.on('before-quit', () => {
  rfidService.stop();
  rfidHandlers.closeRFIDConnection();
});
