/**
 * Catálogo de comandos RFID UHF UR4 Reader
 * Comandos organizados por categoría con nombres en español
 */

const { buildCommand } = require('./frame-builder');

/**
 * Códigos de comandos organizados por categoría
 */
const comandos = {
    // === COMANDOS DE SISTEMA ===
    'obtener_version': 0x87,
    'reiniciar_lector': 0x64,
    'obtener_temperatura': 0xA8,
    'configurar_modo_trabajo': 0x60,
    'obtener_modo_trabajo': 0x62,
    
    // === COMANDOS DE INVENTARIO ===
    'iniciar_inventario': 0x89,
    'detener_inventario': 0x8A,
    'iniciar_inventario_ur4': 0x82,  // Modo continuo UR4 SDK
    'detener_inventario_ur4': 0x8C,  // Detener modo continuo UR4
    
    // === RESPUESTAS DE INVENTARIO ===
    'respuesta_inventario_continuo': 0x83,  // Respuesta de Start Inventory UR4
    'respuesta_inventario_simple': 0x91,    // Respuesta de Single Inventory
    'respuesta_inventario_datos': 0xE1,     // Inventory Data (modo alternativo)
    
    // === COMANDOS DE POTENCIA ===
    'configurar_potencia': 0x93,
    'obtener_potencia': 0x94,
    
    // === COMANDOS DE FILTROS ===
    'configurar_filtro': 0x8C,
    
    // === COMANDOS DE LECTURA/ESCRITURA ===
    'leer_etiqueta': 0x86,
    'escribir_etiqueta': 0x85,
    
    // === COMANDOS DE BEEPER ===
    'beeper': 0xE4,
    
    // === COMANDOS DE SESIÓN Y ALCANCE ===
    'configurar_sesion': 0x88,
    'obtener_sesion': 0x8B,
    'configurar_link_profile': 0x9B,
    'obtener_link_profile': 0x9C,
    
    // === CÓDIGOS DE ESTADO ===
    'exito': 0x01,
    'error': 0x00
};

/**
 * Nombres de bancos de memoria de tags
 */
const bancos = {
    'RESERVADO': 0x00,
    'EPC': 0x01,
    'TID': 0x02,
    'USUARIO': 0x03
};

/**
 * Modos de trabajo del lector
 */
const modosTrabajo = {
    'COMANDO': 0x00,      // Command Mode - requiere comandos explícitos
    'RESPUESTA': 0x01,    // Answer Mode - responde automáticamente
    'GATILLO': 0x02       // Trigger Mode - activado por trigger externo
};

/**
 * Obtiene el nombre de un comando por su código
 * @param {number} codigo - Código del comando (ej: 0x83)
 * @returns {string|null} Nombre del comando o null si no existe
 */
function obtenerNombreComando(codigo) {
    for (const [nombre, valor] of Object.entries(comandos)) {
        if (valor === codigo) {
            return nombre;
        }
    }
    return null;
}

/**
 * Obtiene el código de un comando por su nombre
 * @param {string} nombre - Nombre del comando (ej: 'iniciar_inventario')
 * @returns {number|null} Código del comando o null si no existe
 */
function obtenerCodigoComando(nombre) {
    return comandos[nombre] || null;
}

/**
 * Constructores de comandos para el lector UR4
 * Estos métodos construyen las tramas completas listas para enviar
 */
const Commands = {
    /**
     * Construye comando Get Version
     */
    getVersion() {
        return buildCommand(0x87, []);
    },
    
    /**
     * Construye comando Start Inventory
     */
    startInventory() {
        return buildCommand(0x89, []);
    },
    
    /**
     * Construye comando Stop Inventory
     */
    stopInventory() {
        return buildCommand(0x8A, []);
    },
    
    /**
     * Construye comando Set Power
     * @param {number} power - Potencia en dBm (5-30)
     */
    setPower(power) {
        if (power < 5 || power > 30) {
            throw new Error('Power must be between 5 and 30 dBm');
        }
        return buildCommand(0x93, Buffer.from([power]));
    },
    
    /**
     * Construye comando Get Power
     */
    getPower() {
        return buildCommand(0x94, []);
    },
    
    /**
     * Construye comando Set Filter
     * @param {string} bank - 'EPC', 'TID' o 'USER'
     * @param {number} ptr - Posición inicial en bits
     * @param {number} cnt - Longitud en bits (0 = sin filtro)
     * @param {string} filterData - Datos del filtro en hexadecimal (ej: 'E200')
     */
    setFilter(bank, ptr, cnt, filterData = '') {
        const bankMap = { EPC: 0x01, TID: 0x02, USER: 0x03 };
        const bankCode = bankMap[bank.toUpperCase()];
        
        if (!bankCode) {
            throw new Error('Bank must be EPC, TID or USER');
        }
        
        const filterBytes = cnt > 0 ? Buffer.from(filterData, 'hex') : Buffer.alloc(0);
        
        const data = Buffer.concat([
            Buffer.from([bankCode]),
            Buffer.from([(ptr >> 8) & 0xFF, ptr & 0xFF]),
            Buffer.from([(cnt >> 8) & 0xFF, cnt & 0xFF]),
            filterBytes
        ]);
        
        return buildCommand(0x8C, data);
    },
    
    /**
     * Construye comando Beep
     * @param {boolean} enable - true para activar, false para desactivar
     * @param {number} duration - Duración en ms (opcional, solo si enable=true)
     */
    beep(enable, duration = 100) {
        if (enable) {
            const durationUnits = Math.floor(duration / 10); // Convertir ms a unidades de 10ms
            const data = Buffer.from([0x03, 0x01, durationUnits]);
            return buildCommand(0xE4, data);
        } else {
            const data = Buffer.from([0x03, 0x00]);
            return buildCommand(0xE4, data);
        }
    },
    
    /**
     * Construye comando Get Temperature
     */
    getTemperature() {
        return buildCommand(0xA8, []);
    },
    
    /**
     * Construye comando Read Tag Data
     * @param {string} accessPwd - Password en hex (8 caracteres, ej: '00000000')
     * @param {Object} filter - Filtro {bank, ptr, cnt, data}
     * @param {string} readBank - Banco a leer: 'RESERVED', 'EPC', 'TID', 'USER'
     * @param {number} readPtr - Posición inicial en words
     * @param {number} readCnt - Cantidad de words a leer
     */
    readTag(accessPwd, filter, readBank, readPtr, readCnt) {
        const bankMap = { RESERVED: 0x00, EPC: 0x01, TID: 0x02, USER: 0x03 };
        const readBankCode = bankMap[readBank.toUpperCase()];
        
        if (readBankCode === undefined) {
            throw new Error('Invalid read bank');
        }
        
        const pwdBytes = Buffer.from(accessPwd, 'hex');
        if (pwdBytes.length !== 4) {
            throw new Error('Access password must be 8 hex characters (4 bytes)');
        }
        
        // Filtro
        const filterBankCode = filter && filter.cnt > 0 ? bankMap[filter.bank.toUpperCase()] : 0x01;
        const filterPtr = filter && filter.cnt > 0 ? filter.ptr : 0;
        const filterCnt = filter && filter.cnt > 0 ? filter.cnt : 0;
        const filterBytes = filter && filter.cnt > 0 ? Buffer.from(filter.data, 'hex') : Buffer.alloc(0);
        
        const data = Buffer.concat([
            pwdBytes,
            Buffer.from([filterBankCode]),
            Buffer.from([(filterPtr >> 8) & 0xFF, filterPtr & 0xFF]),
            Buffer.from([(filterCnt >> 8) & 0xFF, filterCnt & 0xFF]),
            filterBytes,
            Buffer.from([readBankCode]),
            Buffer.from([(readPtr >> 8) & 0xFF, readPtr & 0xFF]),
            Buffer.from([(readCnt >> 8) & 0xFF, readCnt & 0xFF])
        ]);
        
        return buildCommand(0x86, data);
    },
    
    /**
     * Construye comando Write Tag Data
     * @param {string} accessPwd - Password en hex (8 caracteres)
     * @param {Object} filter - Filtro {bank, ptr, cnt, data}
     * @param {string} writeBank - Banco a escribir: 'RESERVED', 'EPC', 'TID', 'USER'
     * @param {number} writePtr - Posición inicial en words
     * @param {string} writeData - Datos a escribir en hex
     */
    writeTag(accessPwd, filter, writeBank, writePtr, writeData) {
        const bankMap = { RESERVED: 0x00, EPC: 0x01, TID: 0x02, USER: 0x03 };
        const writeBankCode = bankMap[writeBank.toUpperCase()];
        
        if (writeBankCode === undefined) {
            throw new Error('Invalid write bank');
        }
        
        const pwdBytes = Buffer.from(accessPwd, 'hex');
        if (pwdBytes.length !== 4) {
            throw new Error('Access password must be 8 hex characters (4 bytes)');
        }
        
        const writeBytes = Buffer.from(writeData, 'hex');
        const writeCnt = writeBytes.length / 2; // Words
        
        // Filtro
        const filterBankCode = filter && filter.cnt > 0 ? bankMap[filter.bank.toUpperCase()] : 0x01;
        const filterPtr = filter && filter.cnt > 0 ? filter.ptr : 0;
        const filterCnt = filter && filter.cnt > 0 ? filter.cnt : 0;
        const filterBytes = filter && filter.cnt > 0 ? Buffer.from(filter.data, 'hex') : Buffer.alloc(0);
        
        const data = Buffer.concat([
            pwdBytes,
            Buffer.from([filterBankCode]),
            Buffer.from([(filterPtr >> 8) & 0xFF, filterPtr & 0xFF]),
            Buffer.from([(filterCnt >> 8) & 0xFF, filterCnt & 0xFF]),
            filterBytes,
            Buffer.from([writeBankCode]),
            Buffer.from([(writePtr >> 8) & 0xFF, writePtr & 0xFF]),
            Buffer.from([(writeCnt >> 8) & 0xFF, writeCnt & 0xFF]),
            writeBytes
        ]);
        
        return buildCommand(0x85, data);
    },
    
    /**
     * Construye comando Reset Reader
     */
    reset() {
        return buildCommand(0x64, []);
    },
    
    /**
     * Construye comando Set Work Mode
     * @param {number} mode - 0x00=Command Mode, 0x01=Answer Mode, 0x02=Trigger Mode
     */
    setWorkMode(mode) {
        if (mode < 0 || mode > 2) {
            throw new Error('Mode must be 0 (Command), 1 (Answer) or 2 (Trigger)');
        }
        return buildCommand(0x60, Buffer.from([mode]));
    },
    
    /**
     * Construye comando Get Work Mode
     */
    getWorkMode() {
        return buildCommand(0x62, []);
    },
    
    /**
     * Construye comando Start Inventory (versión SDK Java/UR4)
     * Comando 0x82 con parámetros [0x00, 0x00]
     */
    startInventoryUR4() {
        return buildCommand(0x82, Buffer.from([0x00, 0x00]));
    },
    
    /**
     * Construye comando Stop Inventory (versión SDK Java/UR4)
     * Comando 0x8C
     */
    stopInventoryUR4() {
        return buildCommand(0x8C, []);
    },
    
    /**
     * Construye comando Set Region (frecuencia)
     * @param {number} region - Código de región (0x01=US, 0x02=EU, 0x04=CN, etc.)
     */
    setRegion(region) {
        return buildCommand(0x63, Buffer.from([region]));
    },
    
    /**
     * Construye comando Get Region
     */
    getRegion() {
        return buildCommand(0x65, []);
    },
    
    /**
     * Construye comando Set Session (controla algoritmo anti-colisión y alcance)
     * @param {number} session - Sesión (0=S0, 1=S1, 2=S2, 3=S3)
     * @param {number} qValue - Q Value para anti-colisión (0-15, recomendado: 4-8)
     */
    setSession(session, qValue = 4) {
        if (session < 0 || session > 3) {
            throw new Error('Session must be between 0 and 3');
        }
        if (qValue < 0 || qValue > 15) {
            throw new Error('Q Value must be between 0 and 15');
        }
        // Formato: [Session(1)] [Target(1)] [Q(1)]
        // Target: 0=A, 1=B (generalmente 0)
        return buildCommand(0x88, Buffer.from([session, 0x00, qValue]));
    },
    
    /**
     * Construye comando Get Session
     */
    getSession() {
        return buildCommand(0x8B, []);
    },
    
    /**
     * Construye comando Set Link Profile
     * Controla el perfil de enlace RF (afecta sensibilidad y velocidad)
     * @param {number} profile - Perfil (0=Dense Reader, 1=Default, 2=Max Throughput, 3=Hybrid)
     */
    setLinkProfile(profile) {
        if (profile < 0 || profile > 3) {
            throw new Error('Link Profile must be between 0 and 3');
        }
        return buildCommand(0x9B, Buffer.from([profile]));
    },
    
    /**
     * Construye comando Get Link Profile
     */
    getLinkProfile() {
        return buildCommand(0x9C, []);
    }
};

module.exports = {
    comandos,
    bancos,
    modosTrabajo,
    obtenerNombreComando,
    obtenerCodigoComando,
    Commands
};
