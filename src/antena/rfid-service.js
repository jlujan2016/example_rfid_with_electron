/**
 * Servicio para gestionar el lector RFID y Socket.IO
 */

const net = require('net');
const http = require('http');
const socketIo = require('socket.io');
const antenaConfig = require('./config');
const { FrameParser, Parsers } = require('./nodejs-uhf-commands/protocol-builder');
const { Commands } = require('./nodejs-uhf-commands/commands');
const { obtenerConfiguracionDistancia } = require('./nodejs-uhf-commands/utils');

class RFIDService {
  constructor() {
    this.readerClient = null;
    this.io = null;
    this.httpServer = null;
    this.tagCache = new Map();
    this.tagCounter = new Map();
    this.parser = null;
    this.isHardwareConnected = false; // Estado de conexión del hardware
    this._cacheCleanupInterval = null;

    // Límites para evitar fugas de memoria
    this.MAX_CACHE_SIZE = 5000;       // Máximo de entradas en tagCache
    this.MAX_COUNTER_SIZE = 10000;    // Máximo de entradas en tagCounter
    this.CACHE_CLEANUP_MS = 30000;    // Limpiar cache cada 30 segundos
    this.CACHE_MAX_AGE_MS = 60000;    // Entradas del cache expiran después de 60s
  }

  /**
   * Verificar si el hardware RFID está conectado
   */
  isRFIDConnected() {
    return this.isHardwareConnected && this.readerClient && !this.readerClient.destroyed;
  }

  /**
   * Limpiar entradas antiguas del tagCache para evitar fuga de memoria.
   * También limita el tamaño del tagCounter.
   */
  cleanupCaches() {
    const now = Date.now();

    // Eliminar entradas del tagCache más antiguas que CACHE_MAX_AGE_MS
    for (const [epc, timestamp] of this.tagCache) {
      if (now - timestamp > this.CACHE_MAX_AGE_MS) {
        this.tagCache.delete(epc);
      }
    }

    // Si tagCache sigue demasiado grande, eliminar las más antiguas
    if (this.tagCache.size > this.MAX_CACHE_SIZE) {
      const sorted = [...this.tagCache.entries()].sort((a, b) => a[1] - b[1]);
      const toRemove = sorted.slice(0, sorted.length - this.MAX_CACHE_SIZE);
      for (const [epc] of toRemove) {
        this.tagCache.delete(epc);
      }
    }

    // Limitar tamaño de tagCounter (mantener los más recientes por timestamp de cache)
    if (this.tagCounter.size > this.MAX_COUNTER_SIZE) {
      const activeEpcs = new Set(this.tagCache.keys());
      for (const epc of this.tagCounter.keys()) {
        if (!activeEpcs.has(epc)) {
          this.tagCounter.delete(epc);
        }
      }
    }
  }

  /**
   * Iniciar limpieza periódica de caches
   */
  startCacheCleanup() {
    if (this._cacheCleanupInterval) return;
    this._cacheCleanupInterval = setInterval(() => {
      this.cleanupCaches();
    }, this.CACHE_CLEANUP_MS);
  }

  /**
   * Detener limpieza periódica
   */
  stopCacheCleanup() {
    if (this._cacheCleanupInterval) {
      clearInterval(this._cacheCleanupInterval);
      this._cacheCleanupInterval = null;
    }
  }

  /**
   * Inicializar servidor Socket.IO para comunicación con el frontend
   */
  initSocketServer() {
    this.httpServer = http.createServer();
    this.io = socketIo(this.httpServer);

    this.httpServer.listen(antenaConfig.servidor.puerto, () => {
      console.log(`Servidor Socket.IO escuchando en http://localhost:${antenaConfig.servidor.puerto}`);
    });

    this.io.on('connection', (socket) => {
      console.log('✓ Cliente web conectado mediante WebSocket.');
      
      // Enviar el estado actual del hardware al cliente que se conecta
      const hardwareStatus = this.isRFIDConnected();
      socket.emit('rfid-hardware-status', { 
        connected: hardwareStatus, 
        message: hardwareStatus ? 'Lector RFID conectado' : 'Lector RFID desconectado' 
      });
      console.log(`   Estado del hardware enviado al cliente: ${hardwareStatus ? 'Conectado' : 'Desconectado'}`);
      
      // Escuchar eventos para aplicar configuración del beeper
      socket.on('apply-beeper-config', (config) => {
        this.applyBeeperConfig(config);
      });
      
      // Escuchar eventos para obtener configuración del lector
      socket.on('get-reader-config', () => {
        this.getReaderConfig().then(config => {
          socket.emit('reader-config-response', config);
        }).catch(error => {
          socket.emit('reader-config-response', {
            error: error.message
          });
        });
      });
      
      socket.on('disconnect', () => {
        console.log('✗ Cliente web desconectado.');
      });
    });
  }

  /**
   * Conectar al lector RFID por TCP/IP
   */
  connectRFIDReader() {
    const configDistancia = obtenerConfiguracionDistancia(antenaConfig.lector.distanciaMetros);
    
    // Verificar tipo de conexión
    if (antenaConfig.conexion.tipo === 'usb') {
      console.warn('⚠️  Conexión USB aún no implementada. Use conexión TCP/IP.');
      // TODO: Implementar conexión USB con SerialPort
      return;
    }
    
    // Conexión TCP/IP
    this.readerClient = new net.Socket();
    this.parser = new FrameParser();

    this.readerClient.connect(antenaConfig.conexion.puerto, antenaConfig.conexion.ip, () => {
      console.log(`✓ Conectado al lector RFID en ${antenaConfig.conexion.ip}:${antenaConfig.conexion.puerto}\n`);
      
      // Marcar hardware como conectado
      this.isHardwareConnected = true;
      
      // Emitir evento de conexión exitosa
      if (this.io) {
        this.io.emit('rfid-hardware-status', { connected: true, message: 'Lector RFID conectado' });
      }
      
      console.log('📡 Configurando lector...\n');
      console.log(`   Distancia configurada: ${configDistancia.distanciaReal} metros`);
      console.log(`   ${configDistancia.descripcion}\n`);
      
      // 1. Configurar potencia
      setTimeout(() => {
        console.log(`1. Configurando potencia a ${configDistancia.potencia} dBm...`);
        const setPowerCmd = Commands.setPower(configDistancia.potencia);
        console.log('   Trama:', setPowerCmd.toString('hex').toUpperCase());
        this.readerClient.write(setPowerCmd);
      }, 500);
      
      // 2. Activar beeper
      setTimeout(() => {
        console.log('\n2. Activando beeper...');
        const beepCmd = Commands.beep(antenaConfig.lector.beeper.habilitado, antenaConfig.lector.beeper.duracion);
        console.log('   Trama:', beepCmd.toString('hex').toUpperCase());
        this.readerClient.write(beepCmd);
      }, 1000);
      
      // 3. Desactivar filtros (para leer todos los tags)
      setTimeout(() => {
        console.log('\n3. Desactivando filtros EPC...');
        const clearFilterCmd = Commands.setFilter('EPC', 0, 0, '');
        console.log('   Trama:', clearFilterCmd.toString('hex').toUpperCase());
        this.readerClient.write(clearFilterCmd);
      }, 1500);
      
      // 4. Iniciar inventory continuo con comando UR4 SDK (0x82)
      setTimeout(() => {
        console.log('\n4. Iniciando lectura continua (Start Inventory UR4)...');
        const startInventoryCmd = Commands.startInventoryUR4();
        console.log('   Trama:', startInventoryCmd.toString('hex').toUpperCase());
        this.readerClient.write(startInventoryCmd);
        console.log('\n✓ Configuración completa - el lector enviará tags automáticamente...');
        console.log('━'.repeat(60) + '\n');
      }, 2000);
    });

    this.readerClient.on('data', (data) => {
      const frames = this.parser.addData(data);
      
      frames.forEach(frame => {
        // 0x83 = Respuesta de Continuous Inventory (comando UR4 SDK)
        if (frame.command === 0x83) {
          const tag = Parsers.parseTagFromUR4Response(frame.data);
          
          if (tag && !Parsers.isDuplicate(tag.epc, this.tagCache, antenaConfig.tags.umbralDuplicados)) {
            // Incrementar contador
            const count = (this.tagCounter.get(tag.epc) || 0) + 1;
            this.tagCounter.set(tag.epc, count);
            
            console.log(`\n┌─ TAG DETECTADO ────────────────────────`);
            console.log(`│ EPC    : ${tag.epc}`);
            console.log(`│ PC     : ${tag.pc}`);
            console.log(`│ RSSI   : ${tag.rssi} dBm`);
            console.log(`│ Antena : ${tag.antenna}`);
            console.log(`│ Lecturas: ${count}`);
            console.log(`│ Tiempo : ${new Date().toLocaleTimeString()}`);
            console.log('└────────────────────────────────────────\n');
            
            // Emitir por WebSocket
            if (this.io) {
              this.io.emit('rfid-tag', { ...tag, count });
            }
          }
        }
      });
    });

    this.readerClient.on('close', () => {
      console.log('\n✗ Conexión con el lector RFID cerrada.');
      
      // Marcar hardware como desconectado
      this.isHardwareConnected = false;
      
      // Emitir evento de desconexión
      if (this.io) {
        this.io.emit('rfid-hardware-status', { connected: false, message: 'Lector RFID desconectado' });
      }
    });

    this.readerClient.on('error', (err) => {
      console.error('\n✗ Error de conexión con el lector RFID:', err.message);
      console.error('Verifica que:');
      console.error('  - La antena esté encendida');
      console.error(`  - La IP de la antena sea correcta: ${antenaConfig.conexion.ip}`);
      console.error(`  - El puerto sea correcto: ${antenaConfig.conexion.puerto}`);
      console.error('  - Tu PC esté en la misma red: 192.168.99.x');
      
      // Marcar hardware como desconectado
      this.isHardwareConnected = false;
      
      // Emitir evento de error/desconexión
      if (this.io) {
        this.io.emit('rfid-hardware-status', { connected: false, message: `Error: ${err.message}` });
      }
    });
  }

  /**
   * Detener el lector RFID
   */
  stopRFIDReader() {
    if (this.readerClient && !this.readerClient.destroyed) {
      try {
        const stopInventoryCmd = Commands.stopInventoryUR4();
        this.readerClient.write(stopInventoryCmd, () => {
          console.log('Inventory detenido.');
          if (this.readerClient && !this.readerClient.destroyed) {
            this.readerClient.end();
          }
          this.readerClient = null;
        });
      } catch (error) {
        console.log('Error al detener inventory:', error.message);
        if (this.readerClient) {
          this.readerClient.destroy();
          this.readerClient = null;
        }
      }
    } else {
      this.readerClient = null;
    }
  }

  /**
   * Aplicar configuración del beeper inmediatamente
   */
  applyBeeperConfig(config) {
    if (!this.readerClient || this.readerClient.destroyed) {
      console.error('✗ No se puede aplicar beeper: lector no conectado');
      return false;
    }
    
    console.log(`\n🔔 Aplicando configuración del beeper...`);
    console.log(`   Habilitado: ${config.habilitado ? 'Sí' : 'No'}`);
    console.log(`   Duración: ${config.duracion}ms`);
    
    const beepCmd = Commands.beep(config.habilitado, config.duracion);
    console.log('   Trama:', beepCmd.toString('hex').toUpperCase());
    this.readerClient.write(beepCmd);
    
    console.log('✓ Comando de beeper enviado correctamente\n');
    return true;
  }

  /**
   * Obtener configuración actual del lector
   */
  async getReaderConfig() {
    if (!this.readerClient || this.readerClient.destroyed) {
      throw new Error('Lector no conectado');
    }
    
    console.log('\n📖 Obteniendo configuración del lector...');
    
    // Usar valores actuales del config.js como base
    const { obtenerConfiguracionDistancia } = require('./nodejs-uhf-commands/utils');
    const configDistancia = obtenerConfiguracionDistancia(antenaConfig.lector.distanciaMetros);
    
    const config = {
      potencia: configDistancia.potencia,
      sesion: null,
      linkProfile: null,
      beeper: {
        habilitado: antenaConfig.lector.beeper.habilitado,
        duracion: antenaConfig.lector.beeper.duracion
      },
      distanciaEstimada: antenaConfig.lector.distanciaMetros
    };
    
    console.log('📋 Configuración actual del archivo config.js:');
    console.log(`   Distancia configurada: ${config.distanciaEstimada} metros`);
    console.log(`   Potencia calculada: ${config.potencia} dBm`);
    console.log(`   Beeper: ${config.beeper.habilitado ? 'Activado' : 'Desactivado'} (${config.beeper.duracion}ms)`);
    
    return new Promise((resolve, reject) => {
      let potenciaRecibida = false;
      let timeoutId = null;
      
      // Handler temporal para respuestas
      const dataHandler = (data) => {
        try {
          const frames = this.parser.addData(data);
          
          frames.forEach(frame => {
            console.log(`   Respuesta del lector - Comando: 0x${frame.command.toString(16).toUpperCase()}, Data length: ${frame.data.length}`);
            console.log(`   Data bytes: ${Array.from(frame.data).map(b => '0x' + b.toString(16).toUpperCase()).join(' ')}`);
            
            // Respuesta de Get Power (comando 0x95 es la respuesta a 0x94)
            if (frame.command === 0x95) {
              if (frame.data.length >= 2) {
                // Formato: [byte0] [potencia]
                // El segundo byte es la potencia en dBm
                const potencia = frame.data[1];
                
                if (potencia >= 5 && potencia <= 30) { // Validar rango válido
                  config.potencia = potencia;
                  potenciaRecibida = true;
                  console.log(`   ✓ Potencia obtenida del lector: ${config.potencia} dBm`);
                  
                  // Calcular distancia estimada basada en potencia
                  if (config.potencia <= 7) {
                    config.distanciaEstimada = 0.5;
                  } else if (config.potencia <= 18) {
                    config.distanciaEstimada = 2;
                  } else if (config.potencia <= 22) {
                    config.distanciaEstimada = 4;
                  } else if (config.potencia <= 25) {
                    config.distanciaEstimada = 6;
                  } else if (config.potencia <= 28) {
                    config.distanciaEstimada = 8;
                  } else {
                    config.distanciaEstimada = 10;
                  }
                  
                  console.log(`   Distancia estimada: ${config.distanciaEstimada} metros`);
                  
                  // Limpiar timeout y handler
                  if (timeoutId) clearTimeout(timeoutId);
                  this.readerClient.removeListener('data', dataHandler);
                  
                  console.log('✓ Configuración obtenida del lector correctamente\n');
                  resolve(config);
                } else {
                  console.log(`   ⚠️  Potencia fuera de rango: ${potencia} dBm (0x${potencia.toString(16).toUpperCase()})`);
                  console.log(`   → Este comando podría no ser soportado por tu modelo de lector`);
                }
              } else if (frame.data.length === 1) {
                // Formato alternativo: solo 1 byte con la potencia directamente
                const potencia = frame.data[0];
                
                if (potencia >= 5 && potencia <= 30) {
                  config.potencia = potencia;
                  potenciaRecibida = true;
                  console.log(`   ✓ Potencia obtenida del lector: ${config.potencia} dBm`);
                  
                  // Calcular distancia estimada
                  if (config.potencia <= 7) {
                    config.distanciaEstimada = 0.5;
                  } else if (config.potencia <= 18) {
                    config.distanciaEstimada = 2;
                  } else if (config.potencia <= 22) {
                    config.distanciaEstimada = 4;
                  } else if (config.potencia <= 25) {
                    config.distanciaEstimada = 6;
                  } else if (config.potencia <= 28) {
                    config.distanciaEstimada = 8;
                  } else {
                    config.distanciaEstimada = 10;
                  }
                  
                  console.log(`   Distancia estimada: ${config.distanciaEstimada} metros`);
                  
                  // Limpiar timeout y handler
                  if (timeoutId) clearTimeout(timeoutId);
                  this.readerClient.removeListener('data', dataHandler);
                  
                  console.log('✓ Configuración obtenida del lector correctamente\n');
                  resolve(config);
                }
              }
            }
          });
        } catch (error) {
          console.error('   Error al parsear respuesta:', error.message);
        }
      };
      
      // Agregar listener temporal
      this.readerClient.on('data', dataHandler);
      
      // Timeout de 3 segundos
      timeoutId = setTimeout(() => {
        this.readerClient.removeListener('data', dataHandler);
        if (!potenciaRecibida) {
          console.log('⚠️  El lector no soporta el comando Get Power o respondió con formato inesperado');
          console.log('✓ Usando configuración del archivo config.js\n');
          resolve(config);
        }
      }, 3000);
      
      // Enviar comando para obtener potencia
      console.log('\n🔍 Intentando obtener potencia del lector...');
      const getPowerCmd = Commands.getPower();
      console.log('   Trama enviada:', getPowerCmd.toString('hex').toUpperCase());
      this.readerClient.write(getPowerCmd);
    });
  }

  /**
   * Cerrar el servidor Socket.IO
   */
  closeSocketServer() {
    if (this.io) {
      try {
        this.io.close();
        console.log('Socket.IO cerrado.');
      } catch (error) {
        console.log('Error al cerrar Socket.IO:', error.message);
      }
      this.io = null;
    }
    
    if (this.httpServer) {
      try {
        this.httpServer.close();
        console.log('Servidor HTTP cerrado.');
      } catch (error) {
        console.log('Error al cerrar servidor HTTP:', error.message);
      }
      this.httpServer = null;
    }
  }

  /**
   * Inicializar todos los servicios
   */
  start() {
    this.initSocketServer();
    this.connectRFIDReader();
    this.startCacheCleanup();
  }

  /**
   * Detener todos los servicios
   */
  stop() {
    this.stopCacheCleanup();
    this.tagCache.clear();
    this.tagCounter.clear();
    this.stopRFIDReader();
    this.closeSocketServer();
  }
}

module.exports = new RFIDService();
