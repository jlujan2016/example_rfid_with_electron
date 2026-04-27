/**
 * Configuración de la aplicación
 */

const settings = require('electron-settings');

// Función para obtener la configuración de API
async function getApiConfig() {
  try {
    const savedBaseUrl = await settings.get('api.baseUrl');
    const savedToken = await settings.get('api.token');

    return {
      baseUrl: savedBaseUrl || process.env.API_URL || 'http://127.0.0.1:8000',
      token: savedToken || process.env.API_TOKEN || 'abxhaisasidahsda65asd'
    };
  } catch (error) {
    console.error('Error al cargar configuración de API:', error);
    return {
      baseUrl: process.env.API_URL || 'http://127.0.0.1:8000',
      token: process.env.API_TOKEN || 'abxhaisasidahsda65asd'
    };
  }
}

// Cargar configuración de manera sincrónica para la carga inicial
let apiConfig = {
  //baseUrl: process.env.API_URL || 'http://127.0.0.1:8000',
  //token: process.env.API_TOKEN || 'iVdp5K6Pq8HmPE7hHyRodo1Vkoy8pUgwwcCi3TEo7YW0mmwOlzSsZCFGiUJ8zOFZ'
  baseUrl: process.env.API_URL || 'http://127.0.0.1:8000',
  token: process.env.API_TOKEN || 'abxhaisasidahsda65asd'
};

// Cargar configuración guardada de forma asíncrona
const configPromise = getApiConfig().then(config => {
  apiConfig.baseUrl = config.baseUrl;
  apiConfig.token = config.token;
  return apiConfig;
});

module.exports = {
  // Promesa para esperar a que se cargue la configuración
  ready: configPromise,
  // Configuración de la API del backend
  api: {
    // URL base del backend (cámbiala según tu entorno)
    get baseUrl() { return apiConfig.baseUrl; },
    set baseUrl(value) {
      apiConfig.baseUrl = value;
      settings.set('api.baseUrl', value);
    },

    get token() { return apiConfig.token; },
    set token(value) {
      apiConfig.token = value;
      settings.set('api.token', value);
    },

    // Timeout para las peticiones (en milisegundos)
    timeout: 10000,

    // Endpoints disponibles
    endpoints: {
      selects: '/api/selects',
      selectsMateriales: '/api/selects-materiales',
      selects2: '/api/selects2',
      locales: '/api/locales',
      enviarCategorias: '/api/validar-codigos',
      validarRfid: '/api/validar-codigos-impresos',
      validarCodigosArcos: '/api/validar-codigos-arcos',
      homeData: '/api/home-data',
      guardarResultados: '/api/guardar-resultados',
      marcacionesReporte: '/api/reportes/marcaciones',
      // Agrega más endpoints aquí según necesites
    }
  },

  // Configuración de archivos
  files: {
    downloadFolder: 'OnpeAppDownloads',
  },

  // Configuración de la ventana
  window: {
    width: 1366,
    height: 768,
    title: 'ONPE - Antenas App',
  }
};
