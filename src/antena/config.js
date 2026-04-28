/**
 * Configuración global de la aplicación
 */

const settings = require('electron-settings');

// Configuración por defecto
const defaultConfig = {
    // Tipo de conexión
    conexion: {
        tipo: 'tcp', // 'tcp' o 'usb'
        // TCP/IP
        ip: '192.168.1.180',
        puerto: 8888,
        // USB (cuando se implemente)
        usbPort: '/dev/ttyUSB0',
        baudRate: 115200
    },
    
    // Configuración del Lector RFID
    lector: {
        // === CONFIGURACIÓN DE DISTANCIA SIMPLIFICADA ===
        // Especifica la distancia de lectura en metros (0.1-15+)
        // Valores decimales para centímetros:
        //   0.1 = 10cm, 0.2 = 20cm, 0.5 = 50cm, 0.8 = 80cm
        // Valores enteros para metros:
        //   1, 2, 3, 5, 8, 10, 12, 15
        // Ejemplos:
        //   0.2 = 20cm (muy corto)
        //   0.5 = 50cm (corto)
        //   2 = 2 metros (medio-corto)
        //   10 = 10 metros (largo)
        //   15 = 15+ metros (máximo)
        distanciaMetros: 1,  // Ajusta según tu necesidad
        
        beeper: {
            habilitado: true,
            duracion: 100 // ms
        }
    },
    
    // Configuración del Servidor HTTP/Socket.IO
    servidor: {
        puerto: 3000,
        ipPC: '192.168.99.101'
    },
    
    // Configuración de lectura de tags
    tags: {
        // Umbral para evitar duplicados (milisegundos)
        // Reducido a 200ms para detectar múltiples tags rápidamente
        umbralDuplicados: 200,
        
        // Filtro para validar RSSI
        rssi: {
            max: 200,
            min: 0
        }
    }

        ,

    gpio: {
    habilitado: true,

    // Pin del UR4 (GPIO interno del lector)
    pin: 1,

    // edge = detecta cambio (recomendado RFID)
    // level = estado continuo (no recomendado aquí)
    modo: 'edge',

    // anti rebote en ms
    debounceMs: 300
    }
};

// Cargar configuración desde electron-settings
async function loadConfig() {
    try {
        const savedConfig = await settings.get('antena');
        
        if (savedConfig) {
            // Mezclar configuración guardada con valores por defecto
            return {
                conexion: { ...defaultConfig.conexion, ...savedConfig.conexion },
                lector: {
                    ...defaultConfig.lector,
                    ...savedConfig.lector,
                    beeper: { ...defaultConfig.lector.beeper, ...savedConfig.lector?.beeper }
                },
                servidor: { ...defaultConfig.servidor, ...savedConfig.servidor },
                tags: {
                    ...defaultConfig.tags,
                    ...savedConfig.tags,
                    rssi: { ...defaultConfig.tags.rssi, ...savedConfig.tags?.rssi }
                }
            };
        }
        
        return defaultConfig;
    } catch (error) {
        console.error('Error al cargar configuración de antena:', error);
        return defaultConfig;
    }
}

// Configuración activa
let activeConfig = { ...defaultConfig };

// Cargar configuración al iniciar
loadConfig().then(config => {
    activeConfig = config;
    console.log('Configuración de antena cargada:', activeConfig);
});

// Exportar configuración con getters dinámicos
module.exports = {
    get conexion() { return activeConfig.conexion; },
    get lector() { return activeConfig.lector; },
    get servidor() { return activeConfig.servidor; },
    get tags() { return activeConfig.tags; },
    
    // Método para recargar configuración
    async reload() {
        activeConfig = await loadConfig();
        return activeConfig;
    },
    
    // Obtener configuración por defecto
    getDefaults() {
        return defaultConfig;
    }
};
