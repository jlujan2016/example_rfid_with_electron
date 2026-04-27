/**
 * Protocol Builder para UHF UR4 Reader
 * 
 * Utilidades para construir y parsear tramas del protocolo
 */

/**
 * Calcula el checksum de una trama
 * Checksum = Length_High XOR Length_Low XOR Command XOR Data
 * @param {number} command - Código del comando
 * @param {Buffer} data - Datos del comando
 * @param {number} length - Longitud total de la trama
 * @returns {number} Checksum calculado
 */
function calculateChecksum(command, data, length) {
  // Iniciar con Length High y Length Low
  let checksum = ((length >> 8) & 0xFF) ^ (length & 0xFF);
  
  // XOR con el comando
  checksum ^= command;
  
  // XOR con cada byte de datos
  if (data && data.length > 0) {
    for (let i = 0; i < data.length; i++) {
      checksum ^= data[i];
    }
  }
  
  return checksum & 0xFF;
}

/**
 * Construye una trama completa del protocolo
 * @param {number} command - Código del comando
 * @param {Buffer|Array} data - Datos del comando (opcional)
 * @returns {Buffer} Trama completa lista para enviar
 */
function buildCommand(command, data = []) {
  const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  
  // Calcular longitud total: Header(2) + Length(2) + Cmd(1) + Data(N) + CS(1) + Tail(2)
  const length = 8 + dataBuffer.length;
  
  // Calcular checksum (incluye Length, Command y Data)
  const checksum = calculateChecksum(command, dataBuffer, length);
  
  // Construir trama
  const frame = Buffer.alloc(length);
  let offset = 0;
  
  // Header
  frame[offset++] = 0xA5;
  frame[offset++] = 0x5A;
  
  // Length (Big-Endian)
  frame[offset++] = (length >> 8) & 0xFF;
  frame[offset++] = length & 0xFF;
  
  // Command
  frame[offset++] = command;
  
  // Data
  if (dataBuffer.length > 0) {
    dataBuffer.copy(frame, offset);
    offset += dataBuffer.length;
  }
  
  // Checksum
  frame[offset++] = checksum;
  
  // Tail
  frame[offset++] = 0x0D;
  frame[offset++] = 0x0A;
  
  return frame;
}

/**
 * Parser de tramas del protocolo
 */
class FrameParser {
  constructor() {
    this.buffer = Buffer.alloc(0);
  }
  
  /**
   * Agrega datos recibidos y parsea tramas completas
   * @param {Buffer} data - Datos recibidos
   * @returns {Array} Array de tramas parseadas
   */
  addData(data) {
    this.buffer = Buffer.concat([this.buffer, data]);
    return this.parseFrames();
  }
  
  /**
   * Parsea todas las tramas completas disponibles en el buffer
   * @returns {Array} Array de tramas parseadas
   */
  parseFrames() {
    const frames = [];
    
    while (this.buffer.length >= 7) {
      // Buscar header
      const headerIndex = this.findHeader();
      if (headerIndex === -1) {
        this.buffer = Buffer.alloc(0);
        break;
      }
      
      // Descartar bytes antes del header
      if (headerIndex > 0) {
        this.buffer = this.buffer.slice(headerIndex);
      }
      
      // Verificar si tenemos suficientes bytes para leer la longitud
      if (this.buffer.length < 4) break;
      
      // Leer longitud
      const length = (this.buffer[2] << 8) | this.buffer[3];
      
      // Verificar si tenemos la trama completa
      if (this.buffer.length < length) break;
      
      // Extraer trama
      const frame = this.buffer.slice(0, length);
      this.buffer = this.buffer.slice(length);
      
      // Validar trama
      if (this.validateFrame(frame)) {
        frames.push(this.parseFrame(frame));
      }
    }
    
    return frames;
  }
  
  /**
   * Busca el header en el buffer
   * @returns {number} Índice del header o -1 si no se encuentra
   */
  findHeader() {
    for (let i = 0; i < this.buffer.length - 1; i++) {
      if (this.buffer[i] === 0xA5 && this.buffer[i + 1] === 0x5A) {
        return i;
      }
    }
    return -1;
  }
  
  /**
   * Valida una trama completa
   * @param {Buffer} frame - Trama a validar
   * @returns {boolean} True si la trama es válida
   */
  validateFrame(frame) {
    if (frame.length < 7) {
      return false;
    }
    if (frame[frame.length - 2] !== 0x0D) {
      return false;
    }
    if (frame[frame.length - 1] !== 0x0A) {
      return false;
    }
    
    // Validar checksum
    const receivedCS = frame[frame.length - 3];
    const length = (frame[2] << 8) | frame[3];
    const command = frame[4];
    const dataLen = frame.length - 8; // Header(2) + Length(2) + Cmd(1) + CS(1) + Tail(2) = 8
    const data = frame.slice(5, 5 + dataLen);
    
    const calculatedCS = calculateChecksum(command, data, length);
    
    return receivedCS === calculatedCS;
  }
  
  /**
   * Parsea una trama validada
   * @param {Buffer} frame - Trama a parsear
   * @returns {Object} Objeto con los datos parseados
   */
  parseFrame(frame) {
    const command = frame[4];
    const dataLen = frame.length - 8; // Header(2) + Length(2) + Cmd(1) + CS(1) + Tail(2) = 8
    const data = frame.slice(5, 5 + dataLen);
    
    return {
      command,
      data,
      raw: frame
    };
  }
}

/**
 * Helpers para comandos específicos
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
   * @param {boolean} enable - true para activar beep
   * @param {number} duration - Duración en ms (opcional)
   */
  beep(enable = true, duration = 100) {
    const data = Buffer.from([enable ? 0x01 : 0x00]);
    return buildCommand(0xE4, Buffer.concat([Buffer.from([0x0B]), data]));
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
    
    if (!readBankCode && readBankCode !== 0x00) {
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
  }
};

/**
 * Parsers para respuestas específicas
 */

const Parsers = {
  /**
   * Parsea respuesta de Get Version
   * @param {Buffer} data - Datos de la respuesta
   * @returns {string} Versión del firmware
   */
  parseVersion(data) {
    if (data.length < 2) return null;
    if (data[0] !== 0x01 || data[1] !== 0x00) return null;
    
    if (data.length >= 5) {
      const major = data[2];
      const minor = data[3];
      const patch = data[4];
      return `${major}.${minor}.${patch}`;
    }
    
    return data.slice(2).toString('ascii').trim();
  },
  
  /**
   * Parsea respuesta de Get Power
   * @param {Buffer} data - Datos de la respuesta
   * @returns {number} Potencia en dBm o null
   */
  parsePower(data) {
    if (data.length < 3) return null;
    if (data[0] !== 0x01 || data[1] !== 0x00) return null;
    return data[2];
  },
  
  /**
   * Parsea respuesta de Get Temperature
   * @param {Buffer} data - Datos de la respuesta
   * @returns {number} Temperatura en °C o null
   */
  parseTemperature(data) {
    if (data.length < 3) return null;
    if (data[0] !== 0x01) return null;
    const temp = data[2];
    // Convertir de unsigned a signed
    return temp > 127 ? temp - 256 : temp;
  },
  
  /**
   * Parsea datos de inventory (tag detectado)
   * @param {Buffer} data - Datos de la respuesta (comando 0xE1)
   * @returns {Array} Array de tags detectados
   */
  parseInventoryData(data) {
    const tags = [];
    
    if (data.length < 3) return tags;
    
    const index = (data[0] << 8) | data[1];
    const tagCount = data[2];
    let offset = 3;
    
    for (let i = 0; i < tagCount && offset < data.length; i++) {
      if (offset + 1 >= data.length) break;
      
      const epcLen = data[offset++];
      if (offset + epcLen > data.length) break;
      
      const pc = data.slice(offset, offset + 2);
      const epc = data.slice(offset + 2, offset + epcLen);
      offset += epcLen;
      
      // RSSI y antena (opcional, si está presente)
      let rssi = null;
      let antenna = null;
      
      if (offset + 2 <= data.length) {
        const rssiRaw = (data[offset] << 8) | data[offset + 1];
        rssi = -((65535 - rssiRaw) / 10).toFixed(2);
        offset += 2;
      }
      
      if (offset + 1 <= data.length) {
        antenna = data[offset++];
      }
      
      tags.push({
        index,
        pc: pc.toString('hex').toUpperCase(),
        epc: epc.toString('hex').toUpperCase(),
        rssi,
        antenna
      });
    }
    
    return tags;
  },
  
  /**
   * Verifica si una respuesta es exitosa
   * @param {Buffer} data - Datos de la respuesta
   * @returns {boolean} True si la operación fue exitosa
   */
  isSuccess(data) {
    return data.length >= 2 && data[0] === 0x01 && data[1] === 0x00;
  },
  
  /**
   * Parsea tag desde respuesta 0x83 (Continuous Inventory UR4)
   * Formato: [PC(2)] [EPC(variable)] [RSSI(2)] [ANT(1)]
   * @param {Buffer} frameData - Datos de la trama (sin headers)
   * @returns {object|null} Objeto tag o null si error
   */
  parseTagFromUR4Response(frameData) {
    if (!frameData || frameData.length < 5) return null;
    
    try {
      const pcByte0 = frameData[0];
      const pc = frameData.slice(0, 2).toString('hex').toUpperCase();
      
      // Calcular longitud del EPC desde PC
      const epcLengthWords = (pcByte0 >> 3) & 0x1F;
      const epcLength = epcLengthWords * 2;
      
      let epc, rssiBytes, antenna;
      
      if (epcLength > 0 && frameData.length >= 2 + epcLength + 3) {
        epc = frameData.slice(2, 2 + epcLength).toString('hex').toUpperCase();
        rssiBytes = frameData.slice(2 + epcLength, 2 + epcLength + 2);
        antenna = frameData[2 + epcLength + 2];
      } else {
        // Fallback: últimos 3 bytes son RSSI(2) + ANT(1)
        const epcEnd = frameData.length - 3;
        epc = frameData.slice(2, epcEnd).toString('hex').toUpperCase();
        rssiBytes = frameData.slice(epcEnd, epcEnd + 2);
        antenna = frameData[frameData.length - 1];
      }
      
      // Calcular RSSI
      const rssiValue = (rssiBytes[0] << 8) | rssiBytes[1];
      const rssiDbm = (65535 - rssiValue) / 10.0;
      const rssi = rssiDbm < 200 && rssiDbm > 0 ? `-${rssiDbm.toFixed(2)}` : 'N/A';
      
      return {
        epc,
        pc,
        rssi,
        antenna,
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      console.error('[ERROR] parseTagFromUR4Response:', err.message);
      return null;
    }
  },
  
  /**
   * Verifica si un tag es duplicado reciente
   * @param {string} epc - EPC del tag
   * @param {Map} cache - Cache de tags (Map con key=EPC, value=timestamp)
   * @param {number} threshold - Umbral en milisegundos
   * @returns {boolean} True si es duplicado
   */
  isDuplicate(epc, cache, threshold = 3000) {
    const now = Date.now();
    const lastTime = cache.get(epc);
    
    if (lastTime && (now - lastTime) < threshold) {
      return true;
    }
    
    cache.set(epc, now);
    return false;
  },
  
  /**
   * Parsea temperatura del módulo
   * @param {Buffer} data - Datos de la respuesta
   * @returns {object} Objeto con temperatura y PLL lock status
   */
  parseTemperature(data) {
    if (data.length < 3) return null;
    
    const temp = data[0];
    const pllLock = data[1];
    
    return {
      temperature: temp,
      pllLockStatus: pllLock === 0x00 ? 'Locked' : 'Unlocked'
    };
  }
};

module.exports = {
  buildCommand,
  calculateChecksum,
  FrameParser,
  Commands,
  Parsers
};
