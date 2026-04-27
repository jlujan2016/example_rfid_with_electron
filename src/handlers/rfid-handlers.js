/**
 * Handlers para eventos RFID
 */

const io = require('socket.io-client');

let socket = null;
let mainWindow = null;
let hardwareConnected = false; // Estado real del hardware RFID

/**
 * Enviar mensaje IPC al renderer de forma segura.
 * Protege contra "Render frame was disposed" cuando el renderer
 * se destruye (por ejemplo tras un OOM crash).
 */
function safeSend(channel, data) {
  try {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
      mainWindow.webContents.send(channel, data);
    }
  } catch (err) {
    console.warn(`safeSend(${channel}): ${err.message}`);
  }
}

/**
 * Inicializar conexión Socket.IO con el servidor RFID
 */
function initRFIDConnection(window, port = 3000) {
  mainWindow = window;
  
  if (socket) {
    socket.disconnect();
  }
  
  console.log(`Conectando a servidor RFID en puerto ${port}...`);
  
  socket = io(`http://localhost:${port}`);
  
  socket.on('connect', () => {
    console.log('✓ Main process conectado al servidor RFID');
    // NO enviar estado aquí - esperar evento rfid-hardware-status con el estado real
  });
  
  socket.on('disconnect', () => {
    console.log('✗ Main process desconectado del servidor RFID');
    hardwareConnected = false; // Resetear estado
    safeSend('rfid-status', { connected: false });
  });
  
  socket.on('rfid-tag', (data) => {
    console.log('Tag RFID detectado en main process:', data);
    
    // Enviar al renderer process
    safeSend('rfid-tag-detected', data);
  });
  
  // Escuchar eventos de estado del hardware RFID
  socket.on('rfid-hardware-status', (status) => {
    console.log('Estado del hardware RFID:', status.connected ? 'Conectado' : 'Desconectado', '-', status.message);
    
    // Actualizar estado global
    hardwareConnected = status.connected;
    
    // Enviar al renderer process
    safeSend('rfid-status', { connected: status.connected, message: status.message });
  });
  
  socket.on('connect_error', (error) => {
    console.error('Error de conexión Socket.IO en main process:', error.message);
  });
}

/**
 * Cerrar conexión Socket.IO
 */
function closeRFIDConnection() {
  if (socket) {
    socket.disconnect();
    socket = null;
    hardwareConnected = false; // Resetear estado
    console.log('Conexión RFID cerrada');
  }
}

/**
 * Handler para obtener estado de conexión RFID
 */
function handleGetRFIDStatus(event) {
  return {
    success: true,
    connected: hardwareConnected // Usar estado del hardware, no del socket
  };
}

/**
 * Handler para obtener configuración actual del lector RFID
 */
function handleGetReaderConfig(event) {
  return new Promise((resolve, reject) => {
    if (!socket || !socket.connected) {
      resolve({
        success: false,
        error: 'No hay conexión con el servidor RFID'
      });
      return;
    }
    
    // Timeout de 5 segundos
    const timeout = setTimeout(() => {
      resolve({
        success: false,
        error: 'Tiempo de espera agotado'
      });
    }, 5000);
    
    // Escuchar respuesta del servidor
    socket.once('reader-config-response', (config) => {
      clearTimeout(timeout);
      resolve({
        success: true,
        config: config
      });
    });
    
    // Solicitar configuración al servidor
    socket.emit('get-reader-config');
  });
}

/**
 * Handler para aplicar configuración del beeper inmediatamente
 */
function handleApplyBeeperConfig(event, config) {
  if (!socket || !socket.connected) {
    return {
      success: false,
      error: 'No hay conexión con el servidor RFID'
    };
  }
  
  // Emitir evento al servidor RFID para que aplique el beeper
  socket.emit('apply-beeper-config', config);
  
  return {
    success: true,
    message: `Beeper ${config.habilitado ? 'activado' : 'desactivado'}`
  };
}

module.exports = {
  initRFIDConnection,
  closeRFIDConnection,
  handleGetRFIDStatus,
  handleGetReaderConfig,
  handleApplyBeeperConfig
};
