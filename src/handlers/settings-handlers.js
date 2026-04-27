/**
 * Handlers para gestión de configuraciones con electron-settings
 */

const settings = require('electron-settings');

// Configurar electron-settings para asegurar escritura inmediata
settings.configure({
  atomicSave: true, // Asegurar escritura atómica
  prettify: true    // Formato legible (opcional)
});

// Mostrar ruta del archivo de configuración al cargar el módulo
console.log('📁 Ruta del archivo de configuración:', settings.file());

/**
 * Handler para guardar configuraciones con doble verificación
 */
async function handleSaveSettings(event, key, value) {
  try {
    console.log(`📝 [INICIO] Guardando configuración: ${key} =`, value);
    
    // Guardar el valor
    await settings.set(key, value);
    console.log(`💾 [ESCRITURA] Comando set() completado para: ${key}`);
    
    // Esperar un momento para asegurar escritura al disco
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Verificar que se guardó correctamente
    const savedValue = await settings.get(key);
    console.log(`🔍 [VERIFICACIÓN] Valor leído después de guardar: ${key} =`, savedValue);
    
    if (savedValue !== value) {
      console.error(`⚠️ [ERROR] Valor guardado no coincide!`, {
        key: key,
        intentado: value,
        guardado: savedValue,
        tipo_intentado: typeof value,
        tipo_guardado: typeof savedValue
      });
      return { success: false, error: 'Valor no coincide después de guardar' };
    }
    
    console.log(`✅ [ÉXITO] Configuración persistida correctamente: ${key} = ${savedValue}`);
    return { success: true, value: savedValue };
  } catch (error) {
    console.error(`❌ [ERROR] Al guardar configuración ${key}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Handler para obtener configuraciones
 */
async function handleGetSettings(event, key) {
  try {
    const value = await settings.get(key);
    console.log(`📖 Configuración obtenida: ${key} =`, value);
    return { success: true, value };
  } catch (error) {
    console.error('❌ Error al obtener configuración:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handler para verificar si existe una configuración
 */
async function handleHasSettings(event, key) {
  try {
    const exists = await settings.has(key);
    console.log(`Verificando configuración: ${key} = ${exists}`);
    return { success: true, exists };
  } catch (error) {
    console.error('Error al verificar configuración:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handler para eliminar una configuración
 */
async function handleUnsetSettings(event, key) {
  try {
    await settings.unset(key);
    console.log(`Configuración eliminada: ${key}`);
    return { success: true };
  } catch (error) {
    console.error('Error al eliminar configuración:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handler para recargar la configuración de la API
 */
async function handleReloadApiConfig(event) {
  try {
    const config = require('../config/app.config');
    
    const savedBaseUrl = await settings.get('api.baseUrl');
    const savedToken = await settings.get('api.token');
    
    if (savedBaseUrl) {
      config.api.baseUrl = savedBaseUrl;
    }
    if (savedToken) {
      config.api.token = savedToken;
    }
    
    console.log('Configuración de API recargada:', {
      baseUrl: config.api.baseUrl,
      token: '***' // No mostrar el token completo
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error al recargar configuración de API:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handler para guardar configuración de antena
 */
async function handleSaveAntennaConfig(event, config) {
  try {
    await settings.set('antena', config);
    console.log('Configuración de antena guardada:', config);
    return { success: true };
  } catch (error) {
    console.error('Error al guardar configuración de antena:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handler para obtener configuración de antena
 */
async function handleGetAntennaConfig(event) {
  try {
    const antennaConfig = require('../antena/config');
    const config = {
      conexion: antennaConfig.conexion,
      lector: antennaConfig.lector,
      servidor: antennaConfig.servidor,
      tags: antennaConfig.tags
    };
    return { success: true, config };
  } catch (error) {
    console.error('Error al obtener configuración de antena:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handler para recargar configuración de antena
 */
async function handleReloadAntennaConfig(event) {
  try {
    const antennaConfig = require('../antena/config');
    await antennaConfig.reload();
    console.log('Configuración de antena recargada');
    return { success: true };
  } catch (error) {
    console.error('Error al recargar configuración de antena:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handler para obtener toda la configuración guardada (debug)
 */
async function handleGetAllSettings(event) {
  try {
    const allSettings = await settings.get();
    console.log('📋 Toda la configuración:', allSettings);
    return { success: true, settings: allSettings };
  } catch (error) {
    console.error('❌ Error al obtener toda la configuración:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  handleSaveSettings,
  handleGetSettings,
  handleHasSettings,
  handleUnsetSettings,
  handleReloadApiConfig,
  handleSaveAntennaConfig,
  handleGetAntennaConfig,
  handleReloadAntennaConfig,
  handleGetAllSettings
};
