/**
 * Utilidades para el lector RFID UHF UR4
 * Funciones helper y cálculos relacionados con el protocolo
 */

/**
 * Calcula la configuración óptima según la distancia deseada en metros
 * @param {number} metros - Distancia deseada en metros (0.1-15+). Valores decimales para cm (ej: 0.5 = 50cm)
 * @returns {object} Configuración óptima {potencia, session, qValue, linkProfile, distanciaReal}
 */
function obtenerConfiguracionDistancia(metros) {
    // Validar rango mínimo (10 cm)
    if (metros < 0.1) metros = 0.1;
    
    // Configuraciones base según rangos de distancia
    let config = {};
    
    if (metros < 0.5) {
        // 10-49 cm: Muy corto alcance, potencia mínima absoluta
        config = {
            potencia: 5,  // Potencia mínima constante para máximo control
            session: 0,
            qValue: 0,    // Q mínimo para lectura más rápida y corta
            linkProfile: 0
        };
    } else if (metros < 1) {
        // 50-99 cm: Corto alcance
        config = {
            potencia: 5 + Math.floor((metros - 0.5) * 4),  // 5-7 dBm
            session: 0,
            qValue: 2,
            linkProfile: 0
        };
    } else if (metros <= 2) {
        // 1-2 metros: Corto alcance, respuesta rápida
        config = {
            potencia: 15 + Math.floor((metros - 1) * 3),  // 15-18 dBm
            session: 0,
            qValue: 3,
            linkProfile: 0
        };
    } else if (metros <= 4) {
        // 3-4 metros: Medio-corto
        config = {
            potencia: 18 + Math.floor((metros - 2) * 2),  // 18-22 dBm
            session: 0,
            qValue: 4,
            linkProfile: 1
        };
    } else if (metros <= 6) {
        // 5-6 metros: Medio
        config = {
            potencia: 22 + Math.floor((metros - 4) * 1.5),  // 22-25 dBm
            session: 1,
            qValue: 4,
            linkProfile: 1
        };
    } else if (metros <= 8) {
        // 7-8 metros: Medio-largo
        config = {
            potencia: 25 + Math.floor((metros - 6) * 1.5),  // 25-28 dBm
            session: 1,
            qValue: 5,
            linkProfile: 1
        };
    } else if (metros <= 10) {
        // 9-10 metros: Largo alcance
        config = {
            potencia: 28 + Math.floor((metros - 8)),  // 28-30 dBm
            session: 2,
            qValue: 6,
            linkProfile: 3
        };
    } else {
        // 11+ metros: Máximo alcance posible
        config = {
            potencia: 30,  // Máxima potencia
            session: 2,    // S2 para persistencia
            qValue: 7,     // Q alto para múltiples tags
            linkProfile: 3 // Hybrid para máximo alcance
        };
    }
    
    // Limitar potencia máxima a 30 dBm (límite regulatorio)
    if (config.potencia > 30) config.potencia = 30;
    
    config.distanciaReal = metros;
    
    // Formatear descripción con cm o m según corresponda
    if (metros < 1) {
        const cm = Math.round(metros * 100);
        config.descripcion = `${cm}cm (potencia: ${config.potencia} dBm)`;
    } else {
        config.descripcion = metros > 10 
            ? `${metros}m (MÁXIMO - potencia: ${config.potencia} dBm)`
            : `${metros}m (potencia: ${config.potencia} dBm)`;
    }
    
    return config;
}

/**
 * Estima la distancia de lectura basada en la configuración del lector
 * @param {number} potencia - Potencia en dBm (5-30)
 * @param {number} session - Sesión configurada (0=S0, 1=S1, 2=S2, 3=S3)
 * @param {number} linkProfile - Link Profile configurado (0-3)
 * @returns {string} Rango estimado de distancia en metros
 */
function estimarDistancia(potencia, session = 1, linkProfile = 1) {
    // Cálculo aproximado basado en:
    // - Potencia: cada 3 dBm duplica la distancia aproximadamente
    // - Sesión: S0=corto alcance, S1=medio, S2/S3=largo alcance
    // - Link Profile: afecta la sensibilidad del receptor
    
    let distanciaBase = 0;
    
    // Calcular distancia base por potencia (referencia: 20dBm ≈ 3m)
    if (potencia >= 30) distanciaBase = 10;
    else if (potencia >= 27) distanciaBase = 7;
    else if (potencia >= 24) distanciaBase = 5;
    else if (potencia >= 20) distanciaBase = 3;
    else if (potencia >= 15) distanciaBase = 2;
    else distanciaBase = 1;
    
    // Factor de ajuste por sesión
    // S0: inventario rápido, menor alcance (-30%)
    // S1: balanceado (referencia)
    // S2: persistencia media (+20%)
    // S3: persistencia alta (+30%)
    const factorSesion = [0.7, 1.0, 1.2, 1.3][session] || 1.0;
    
    // Factor de ajuste por link profile
    // 0 Dense Reader: optimizado para múltiples lectores (-10%)
    // 1 Default: balanceado (referencia)
    // 2 Max Throughput: velocidad sobre alcance (-5%)
    // 3 Hybrid: optimizado para alcance (+10%)
    const factorProfile = [0.9, 1.0, 0.95, 1.1][linkProfile] || 1.0;
    
    // Calcular distancia final con todos los factores
    const distanciaFinal = distanciaBase * factorSesion * factorProfile;
    
    // Retornar rango (80%-100% de la distancia calculada)
    const distanciaMin = (distanciaFinal * 0.8).toFixed(1);
    const distanciaMax = distanciaFinal.toFixed(1);
    
    return `${distanciaMin}-${distanciaMax}`;
}

/**
 * Calcula el RSSI esperado a una distancia dada
 * @param {number} potencia - Potencia de transmisión en dBm
 * @param {number} distancia - Distancia en metros
 * @returns {number} RSSI estimado en dBm
 */
function calcularRSSIEsperado(potencia, distancia) {
    // Fórmula de propagación en espacio libre (Friis)
    // RSSI = Ptx - 20*log10(d) - 20*log10(f) + 27.55
    // Para UHF RFID (920 MHz aproximadamente)
    const frecuenciaMHz = 920;
    const pathLoss = 20 * Math.log10(distancia) + 20 * Math.log10(frecuenciaMHz) - 27.55;
    const rssi = potencia - pathLoss;
    
    return Math.round(rssi);
}

/**
 * Obtiene una recomendación de configuración según el escenario de uso
 * @param {string} escenario - 'corto'|'medio'|'largo'
 * @returns {Object} Configuración recomendada
 */
function obtenerConfiguracionRecomendada(escenario) {
    const configuraciones = {
        corto: {
            nombre: 'Corto alcance (1-3m)',
            descripcion: 'Lectura rápida, pocos tags, ambiente controlado',
            potencia: 20,
            sesion: { session: 0, qValue: 3 },
            linkProfile: 0,
            distanciaEstimada: '0.8-2.5'
        },
        medio: {
            nombre: 'Medio alcance (4-6m)',
            descripcion: 'Balanceado, uso general',
            potencia: 27,
            sesion: { session: 1, qValue: 4 },
            linkProfile: 1,
            distanciaEstimada: '3.5-7.0'
        },
        largo: {
            nombre: 'Largo alcance (8-12m)',
            descripcion: 'Máxima distancia, lecturas más lentas',
            potencia: 30,
            sesion: { session: 2, qValue: 7 },
            linkProfile: 3,
            distanciaEstimada: '7.0-13.0'
        },
        almacen: {
            nombre: 'Almacén (alta densidad)',
            descripcion: 'Múltiples tags simultáneos',
            potencia: 27,
            sesion: { session: 1, qValue: 8 },
            linkProfile: 0,
            distanciaEstimada: '3.0-6.0'
        },
        puerta: {
            nombre: 'Control de acceso/puerta',
            descripcion: 'Lectura rápida en punto específico',
            potencia: 24,
            sesion: { session: 0, qValue: 4 },
            linkProfile: 2,
            distanciaEstimada: '2.0-5.0'
        }
    };
    
    return configuraciones[escenario] || configuraciones.medio;
}

/**
 * Valida que los parámetros de configuración estén en rangos válidos
 * @param {Object} config - Objeto de configuración del lector
 * @returns {Object} { valido: boolean, errores: string[] }
 */
function validarConfiguracion(config) {
    const errores = [];
    
    // Validar potencia
    if (config.potencia < 5 || config.potencia > 30) {
        errores.push('Potencia debe estar entre 5 y 30 dBm');
    }
    
    // Validar sesión
    if (config.sesion) {
        if (config.sesion.session < 0 || config.sesion.session > 3) {
            errores.push('Session debe estar entre 0 y 3');
        }
        if (config.sesion.qValue < 0 || config.sesion.qValue > 15) {
            errores.push('Q Value debe estar entre 0 y 15');
        }
    }
    
    // Validar link profile
    if (config.linkProfile !== undefined) {
        if (config.linkProfile < 0 || config.linkProfile > 3) {
            errores.push('Link Profile debe estar entre 0 y 3');
        }
    }
    
    return {
        valido: errores.length === 0,
        errores
    };
}

/**
 * Convierte código de región a nombre descriptivo
 * @param {number} codigo - Código de región
 * @returns {string} Nombre de la región
 */
function obtenerNombreRegion(codigo) {
    const regiones = {
        0x01: 'Estados Unidos (902-928 MHz)',
        0x02: 'Europa (865-868 MHz)',
        0x03: 'Japón (916-921 MHz)',
        0x04: 'China (920-925 MHz)',
        0x05: 'Corea del Sur (917-923 MHz)',
        0x06: 'Brasil (902-907 MHz)',
        0x07: 'Australia (920-926 MHz)',
        0x08: 'India (865-867 MHz)'
    };
    
    return regiones[codigo] || `Desconocida (0x${codigo.toString(16).toUpperCase().padStart(2, '0')})`;
}

/**
 * Formatea el RSSI para mostrar
 * @param {string|number} rssi - Valor RSSI
 * @returns {string} RSSI formateado con unidad
 */
function formatearRSSI(rssi) {
    if (rssi === 'N/A' || rssi === null || rssi === undefined) {
        return 'N/A';
    }
    
    const valor = typeof rssi === 'string' ? rssi : rssi.toString();
    
    // Si ya tiene signo negativo
    if (valor.startsWith('-')) {
        return `${valor} dBm`;
    }
    
    // Si es un número positivo, agregar signo negativo
    return `-${valor} dBm`;
}

module.exports = {
    obtenerConfiguracionDistancia,
    estimarDistancia,
    calcularRSSIEsperado,
    obtenerConfiguracionRecomendada,
    validarConfiguracion,
    obtenerNombreRegion,
    formatearRSSI
};
