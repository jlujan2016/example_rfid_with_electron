/**
 * Frame Builder - Construcción de tramas del protocolo UHF UR4
 * 
 * Módulo de bajo nivel para construir tramas del protocolo.
 * No tiene dependencias de otros módulos del proyecto.
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

module.exports = {
  buildCommand,
  calculateChecksum
};
