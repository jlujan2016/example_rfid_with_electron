/**
 * Handler para obtener solo los materiales de un proceso electoral
 * @param {Electron.IpcMainInvokeEvent} event
 * @param {Object} args
 * @param {string} args.idProcesoElectoral
 */
async function handleGetSelectsMateriales(event, args) {
    try {
        if (!args || !args.idProcesoElectoral) {
            return { success: false, error: 'Falta idProcesoElectoral' };
        }
        // Consumir el endpoint de selects, filtrar materiales por proceso
        const response = await makeRequest(config.api.endpoints.selectsMateriales, 'GET', args);
        if (response.errors && Array.isArray(response.errors)) {
            const errorMessage = response.errors.map(e => e.message).join(', ');
            return { success: false, error: errorMessage };
        }
        if (!response.data || !Array.isArray(response.data.materiales)) {
            return { success: false, error: 'No se encontraron materiales' };
        }
        // Filtrar materiales por idProcesoElectoral si corresponde
        let materiales = response.data.materiales;

        return { success: true, materiales };
    } catch (error) {
        if (error && error.code === 'NOT_AUTHENTICATED') {
            return { success: false, notAuthenticated: true, redirect: 'public/login.html', error: error.message || 'No autenticado' };
        }
        return { success: false, error: error.message };
    }
}
/**
 * Handler para obtener el reporte de marcaciones
 * @param {Electron.IpcMainInvokeEvent} event
 * @param {Object} args
 * @param {string} args.idProcesoElectoral
 */
async function handleGetMarcacionesReporte(event, args) {
    try {
        if (!args || !args.idProcesoElectoral) {
            return { isSuccess: false, message: 'Falta idProcesoElectoral', data: null };
        }
        // Construir query string con todos los filtros disponibles (como string para preservar ceros)
        const params = new URLSearchParams();
        if (args.idProcesoElectoral) params.append('idProcesoElectoral', String(args.idProcesoElectoral));
        if (args.idVariable)          params.append('idVariable',          String(args.idVariable));
        if (args.idOdpe)              params.append('idOdpe',              String(args.idOdpe));

        const endpoint = `${config.api.endpoints.marcacionesReporte}?${params.toString()}`;
        const response = await makeRequest(endpoint, 'GET');
        // Validar respuesta
        if (response && response.isSuccess && response.data && response.data.url) {
            return response;
        } else {
            return { isSuccess: false, message: response?.message || 'No se pudo obtener el archivo', data: null };
        }
    } catch (error) {
        console.error('Error en handleGetMarcacionesReporte:', error);
        if (error && error.code === 'NOT_AUTHENTICATED') {
            return { isSuccess: false, notAuthenticated: true, redirect: 'public/login.html', message: 'No autenticado', data: null };
        }
        return { isSuccess: false, message: 'Error al obtener el reporte', data: null };
    }
}

// ...otros códigos y funciones previas...

module.exports = {
    handleGetSelects,
    handleGetSelects2,
    handleGetHomeData,
    handleEnviarCategorias,
    handleValidarRfid,
    handleValidarRfidArcos,
    handleFindProcesoElectoral,
    handleGetMarcacionesReporte,
    handleGetSelectsMateriales,
    handleGetLocales,
    handleLimpiarDatos,
    getApiConfig,
    makeRequest
};
/**
 * Handlers de API para comunicación con backend externo
 */

const https = require('https');
const http = require('http');
const { dialog } = require('electron');
const config = require('../config/app.config');

/**
 * Configuración de la API - obtiene valores dinámicamente
 */
const API_CONFIG = {
    get baseUrl() { return config.api.baseUrl; },
    get token() { return config.api.token; },
    timeout: config.api.timeout,
};

function buildConnectionHelp(error) {
    if (!error) return '';

    if (error.code === 'ECONNREFUSED') {
        return (
            'Sugerencia: si el API es Laravel y lo levantaste con `php artisan serve`, ' +
            'por defecto escucha solo en 127.0.0.1. En la app usa API baseUrl ' +
            '`http://127.0.0.1:8000` o levanta Laravel con `--host=0.0.0.0 --port=8000`.'
        );
    }

    if (error.code === 'ENOTFOUND') {
        return 'Sugerencia: verifica el host/DNS de la URL base del API.';
    }

    if (error.code === 'ETIMEDOUT') {
        return 'Sugerencia: el servidor no respondió a tiempo; revisa red/firewall.';
    }

    return '';
}

function makeNotAuthenticatedError() {
    const err = new Error('Not authenticated');
    err.code = 'NOT_AUTHENTICATED';
    return err;
}

/**
 * Función auxiliar para hacer peticiones HTTP/HTTPS
 */
async function makeRequest(endpoint, method = 'GET', data = null) {

    return new Promise((resolve, reject) => {
        // Si no hay token válido, no ejecutar la petición y avisar para redirigir al login
        // const token = API_CONFIG.token;
        // const isPlaceholder = typeof token === 'string' && token.startsWith('abx') && token.length < 60;
        // if (!token || isPlaceholder) {
        //     return reject(makeNotAuthenticatedError());
        // }
        // Permitir endpoint absoluto (http(s)://...) o relativo (se concatena con baseUrl)
        const url = /^https?:\/\//i.test(endpoint) ? new URL(endpoint) : new URL(`${API_CONFIG.baseUrl}${endpoint}`);
        const protocol = url.protocol === 'https:' ? https : http;

        const postData = data ? JSON.stringify(data) : null;

        const options = {
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': 'Bearer ' + API_CONFIG.token,
            },
            timeout: API_CONFIG.timeout
        };

        if (postData) {
            options.headers['Content-Length'] = Buffer.byteLength(postData);
        }

        const req = protocol.request(options, (res) => {
            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                try {
                    const parsedData = JSON.parse(responseData);
                    resolve(parsedData);
                } catch (err) {
                    resolve(responseData);
                }
            });
        });

        req.on('error', (error) => {
            console.error(`Error en petición ${method} ${endpoint}:`, error);

            // Propagar el error real para que los handlers puedan leer code/address/port.
            reject(error);
        });

        req.on('timeout', () => {
            req.destroy();
            const timeoutError = new Error('Timeout: La petición excedió el tiempo límite');
            timeoutError.code = 'ETIMEDOUT';
            reject(timeoutError);
        });

        if (postData) {
            req.write(postData);
        }

        req.end();
    });
}

/**
 * Handler para enviar categorías al backend
 */
async function handleEnviarCategorias(event, data) {
    try {
        console.log('Enviando categorías al backend:', data);
        const response = await makeRequest(config.api.endpoints.enviarCategorias, 'POST', data);
        console.log('Respuesta del backend:', response);

        // Validar si hay errores en la respuesta
        if (response.errors && Array.isArray(response.errors)) {
            const errorMessage = response.errors.map(e => e.message).join(', ');

            // Mostrar alerta del sistema operativo
            dialog.showErrorBox(
                'Error al Enviar Categorías',
                `No se pudieron enviar las categorías:\n\n${errorMessage}`
            );

            return {
                success: false,
                error: errorMessage
            };
        }

        return response;
    } catch (error) {
        console.error('Error al enviar categorías:', error);
        if (error && error.code === 'NOT_AUTHENTICATED') {
            return { success: false, notAuthenticated: true, redirect: 'public/login.html', error: error.message || 'No autenticado' };
        }

        const help = buildConnectionHelp(error);

        // Mostrar alerta del sistema operativo
        dialog.showErrorBox(
            'Error de Conexión Enviar Categorías',
            `No se pudo conectar con el servidor al enviar categorías:\n\n${error.message || 'Error desconocido'}${help ? `\n\n${help}` : ''}`
        );

        return {
            success: false,
            error: error.message || 'Error desconocido'
        };
    }
}

async function handleValidarRfid(event, data) {
    try {
        // Forzar todos los campos a string para preservar ceros iniciales (01, 001, etc.)
        const safeData = {};
        for (const [key, value] of Object.entries(data || {})) {
            if (Array.isArray(value)) {
                safeData[key] = value.map(v => (v !== null && v !== undefined ? String(v) : v));
            } else if (value !== null && value !== undefined) {
                safeData[key] = String(value);
            } else {
                safeData[key] = value;
            }
        }
        console.log('Validando RFID al backend:', safeData);
        const response = await makeRequest(config.api.endpoints.validarRfid, 'POST', safeData);
        console.log('Respuesta del backend:', response);

        // Validar si hay errores en la respuesta
        if (response.errors && Array.isArray(response.errors)) {
            const errorMessage = response.errors.map(e => e.message).join(', ');

            // Mostrar alerta del sistema operativo
            dialog.showErrorBox(
                'Error al Validar RFID',
                `No se pudo validar el RFID:\n\n${errorMessage}`
            );

            return {
                success: false,
                error: errorMessage
            };
        }

        return response;
    } catch (error) {
        console.error('Error al validar RFID:', error);
        if (error && error.code === 'NOT_AUTHENTICATED') {
            return { success: false, notAuthenticated: true, redirect: 'public/login.html', error: error.message || 'No autenticado' };
        }

        const help = buildConnectionHelp(error);

        // Mostrar alerta del sistema operativo
        dialog.showErrorBox(
            'Error de Conexión Validar RFID',
            `No se pudo conectar con el servidor al validar RFID:\n\n${error.message || 'Error desconocido'}${help ? `\n\n${help}` : ''}`
        );

        return {
            success: false,
            error: error.message || 'Error desconocido'
        };
    }
}

async function handleValidarRfidArcos(event, data) {
    try {
        console.log('Validando RFID (arcos) al backend:', data);
        const response = await makeRequest(config.api.endpoints.validarCodigosArcos, 'POST', data);
        console.log('Respuesta del backend (arcos):', response);

        if (response.errors && Array.isArray(response.errors)) {
            const errorMessage = response.errors.map(e => e.message).join(', ');

            dialog.showErrorBox(
                'Error al Validar RFID (Arcos)',
                `No se pudo validar el RFID de arcos:\n\n${errorMessage}`
            );

            return {
                success: false,
                error: errorMessage
            };
        }

        return response;
    } catch (error) {
        console.error('Error al validar RFID (arcos):', error);
        if (error && error.code === 'NOT_AUTHENTICATED') {
            return { success: false, notAuthenticated: true, redirect: 'public/login.html', error: error.message || 'No autenticado' };
        }

        const help = buildConnectionHelp(error);

        dialog.showErrorBox(
            'Error de Conexión Validar RFID (Arcos)',
            `No se pudo conectar con el servidor al validar RFID (arcos):\n\n${error.message || 'Error desconocido'}${help ? `\n\n${help}` : ''}`
        );

        return {
            success: false,
            error: error.message || 'Error desconocido'
        };
    }
}


async function handleGetSelects(event) {
    try {
        const response = await makeRequest(config.api.endpoints.selects);

        // Validar si hay errores en la respuesta
        if (response.errors && Array.isArray(response.errors)) {
            const errorMessage = response.errors.map(e => e.message).join(', ');

            // Mostrar alerta del sistema operativo
            dialog.showErrorBox(
                'Error de Autenticación',
                `No se pudo autenticar con el servidor:\n\n${errorMessage}\n\nVerifique sus credenciales y la conexión.`
            );

            return {
                success: false,
                error: errorMessage
            };
        }

        // Validar que response.data existe
        if (!response.data) {
            const errorMsg = 'La respuesta del servidor no contiene datos válidos';

            dialog.showErrorBox(
                'Error del Servidor 1',
                errorMsg
            );

            return {
                success: false,
                error: errorMsg
            };
        }

        // Validar que response.data tiene las propiedades necesarias
        if (!response.data.procesos) {
            const errorMsg = 'Los datos del servidor están incompletos';

            dialog.showErrorBox(
                'Error de Datos',
                errorMsg
            );

            return {
                success: false,
                error: errorMsg
            };
        }

        // response.data ya tiene:
        // { procesos: [...], materiales: [...] }
        return {
            success: true,
            procesos: response.data.procesos,
            materiales: response.data.materiales
        };

    } catch (error) {
        console.error('Error obteniendo selects:', error);
        if (error && error.code === 'NOT_AUTHENTICATED') {
            return { success: false, notAuthenticated: true, redirect: 'public/login.html', error: error.message || 'No autenticado' };
        }

        const help = buildConnectionHelp(error);

        // Mostrar alerta del sistema operativo para errores de conexión
        dialog.showErrorBox(
            'Error de Conexión Selects',
            `No se pudo conectar con el servidor:\n\n${error.message || 'Error desconocido'}\n\nVerifique la URL del API y la conectividad.${help ? `\n\n${help}` : ''}`
        );

        return {
            success: false,
            error: error.message || 'Error desconocido'
        };
    }
}

async function handleGetSelects2(event, params) {
    try {
        let endpoint = config.api.endpoints.selects2;
        if (params && Object.keys(params).length > 0) {
            const queryString = new URLSearchParams(params).toString();
            endpoint = `${endpoint}?${queryString}`;
        }
        const response = await makeRequest(endpoint);

        // Validar si hay errores en la respuesta
        if (response.errors && Array.isArray(response.errors)) {
            const errorMessage = response.errors.map(e => e.message).join(', ');

            // Mostrar alerta del sistema operativo
            dialog.showErrorBox(
                'Error de Autenticación',
                `No se pudo autenticar con el servidor:\n\n${errorMessage}\n\nVerifique sus credenciales y la conexión.`
            );

            return {
                success: false,
                error: errorMessage
            };
        }

        // Validar que response.data existe
        if (!response.data) {
            const errorMsg = 'La respuesta del servidor no contiene datos válidos';

            console.log(response)
            dialog.showErrorBox(
                'Error del Servidor 2',
                errorMsg
            );

            return {
                success: false,
                error: errorMsg
            };
        }

        // Validar que response.data tiene las propiedades necesarias
        if (!response.data.odpe) {
            const errorMsg = 'Los datos del servidor están incompletos';

            dialog.showErrorBox(
                'Error de Datos',
                errorMsg
            );

            return {
                success: false,
                error: errorMsg
            };
        }

        // response.data ya tiene:
        // { procesos: [...], materiales: [...] }
        return {
            success: true,
            odpe: response.data.odpe,
            variables: response.data.variables
        };

    } catch (error) {
        console.error('Error obteniendo selects:', error);
        if (error && error.code === 'NOT_AUTHENTICATED') {
            return { success: false, notAuthenticated: true, redirect: 'public/login.html', error: error.message || 'No autenticado' };
        }

        const help = buildConnectionHelp(error);

        // Mostrar alerta del sistema operativo para errores de conexión
        dialog.showErrorBox(
            'Error de Conexión Selects2',
            `No se pudo conectar con el servidor:\n\n${error.message || 'Error desconocido'}\n\nVerifique la URL del API y la conectividad.${help ? `\n\n${help}` : ''}`
        );

        return {
            success: false,
            error: error.message || 'Error desconocido'
        };
    }
}

/**
 * Handler para obtener locales por ODPE
 * @param {Electron.IpcMainInvokeEvent} event
 * @param {Object} params
 * @param {string} params.idOdpe
 */
async function handleGetLocales(event, params) {
    try {
        let endpoint = config.api.endpoints.locales;
        if (params && Object.keys(params).length > 0) {
            const queryString = new URLSearchParams(params).toString();
            endpoint = `${endpoint}?${queryString}`;
        }

        const response = await makeRequest(endpoint, 'GET');

        if (response.errors && Array.isArray(response.errors)) {
            const errorMessage = response.errors.map(e => e.message).join(', ');
            return { success: false, error: errorMessage };
        }

        if (!response.data) {
            return { success: false, error: 'La respuesta del servidor no contiene datos válidos' };
        }

        // Soportar diferentes formas de respuesta: { locales: [...] } o directamente array
        const locales = Array.isArray(response.data.locales) ? response.data.locales : (Array.isArray(response.data) ? response.data : []);

        return { success: true, locales };

    } catch (error) {
        console.error('Error obteniendo locales:', error);
        if (error && error.code === 'NOT_AUTHENTICATED') {
            return { success: false, notAuthenticated: true, redirect: 'public/login.html', error: error.message || 'No autenticado' };
        }
        const help = buildConnectionHelp(error);
        dialog.showErrorBox(
            'Error de Conexión Locales',
            `No se pudo conectar con el servidor:\n\n${error.message || 'Error desconocido'}\n\nVerifique la URL del API y la conectividad.${help ? `\n\n${help}` : ''}`
        );
        return { success: false, error: error.message || 'Error desconocido' };
    }
}

async function handleGetHomeData(event, params) {
    try {
        let endpoint = config.api.endpoints.homeData;
        if (params && Object.keys(params).length > 0) {
            const queryString = new URLSearchParams(params).toString();
            endpoint = `${endpoint}?${queryString}`;
        }
        const response = await makeRequest(endpoint);

        // Validar si hay errores en la respuesta
        if (response.errors && Array.isArray(response.errors)) {
            const errorMessage = response.errors.map(e => e.message).join(', ');

            // Mostrar alerta del sistema operativo
            dialog.showErrorBox(
                'Error de Autenticación',
                `No se pudo autenticar con el servidor:\n\n${errorMessage}\n\nVerifique sus credenciales y la conexión.`
            );

            return {
                success: false,
                error: errorMessage
            };
        }

        // response.data ya tiene:
        // { procesos: [...], materiales: [...] }
        return response;

    } catch (error) {
        console.error('Error obteniendo home data:', error);
        if (error && error.code === 'NOT_AUTHENTICATED') {
            return { success: false, notAuthenticated: true, redirect: 'public/login.html', error: error.message || 'No autenticado' };
        }

        const help = buildConnectionHelp(error);

        // Mostrar alerta del sistema operativo para errores de conexión
        dialog.showErrorBox(
            'Error de Conexión Home Data',
            `No se pudo conectar con el servidor:\n\n${error.message || 'Error desconocido'}\n\nVerifique la URL del API y la conectividad.${help ? `\n\n${help}` : ''}`
        );

        return {
            success: false,
            error: error.message || 'Error desconocido'
        };
    }
}

async function handleFindProcesoElectoral(event, params) {
    try {
        const response = await makeRequest('/api/proceso-electoral/' + params.id);

        if(!response.data){
            return {
                success: false,
                data: null,
            }
        }

        return {
            success: true,
            data: response.data
        };

    } catch (error) {
        if (error && error.code === 'NOT_AUTHENTICATED') {
            return { success: false, notAuthenticated: true, redirect: 'public/login.html', error: error.message || 'No autenticado' };
        }

        alert(error)
        console.error('Error obteniendo selects:', error);

        const help = buildConnectionHelp(error);

        // Mostrar alerta del sistema operativo para errores de conexión
        dialog.showErrorBox(
            'Error de Conexión Proceso Electoral',
            `No se pudo conectar con el servidor:\n\n${error.message || 'Error desconocido'}\n\nVerifique la URL del API y la conectividad.${help ? `\n\n${help}` : ''}`
        );

         return {
            success: false,
            error: error.message || 'Error desconocido'
        };
    }
}

/**
 * Función para actualizar la configuración de la API
 */
function setApiBaseUrl(newUrl) {
    API_CONFIG.baseUrl = newUrl;
    console.log('URL base de API actualizada:', API_CONFIG.baseUrl);
}

/**
 * Obtener la configuración actual
 */
function getApiConfig() {
    return {
        ...API_CONFIG
    };
}

module.exports = {
    handleGetSelects,
    handleGetSelects2,
    handleGetSelectsMateriales,
    handleGetHomeData,
    handleEnviarCategorias,
    handleValidarRfid,
    handleValidarRfidArcos,
    handleFindProcesoElectoral,
    handleGetMarcacionesReporte,
    handleGetLocales,
    handleLimpiarDatos,
    setApiBaseUrl,
    getApiConfig,
    makeRequest
};
/**
 * Handler para limpiar datos
 * @param {Electron.IpcMainInvokeEvent} event
 * @param {Object} args
 * @param {string} args.idProcesoElectoral
 * @param {string} args.idOdpe
 * @param {string} args.idVariable
 */
async function handleLimpiarDatos(event, args) {
    try {
        if (!args || !args.idProcesoElectoral || !args.idOdpe || !args.idVariable) {
            return { isSuccess: false, message: 'Faltan parámetros', data: null };
        }
        // Consumir el endpoint limpiar-datos
        const endpoint = `/api/limpiar-datos`;
        const response = await makeRequest(endpoint, 'POST', {
            idProcesoElectoral: args.idProcesoElectoral,
            idOdpe: args.idOdpe,
            idVariable: args.idVariable
        });
        // Validar respuesta
        if (response && response.isSuccess) {
            return response;
        } else {
            return { isSuccess: false, message: response?.message || 'No se pudo limpiar los datos', data: null };
        }
    } catch (error) {
        console.error('Error en handleLimpiarDatos:', error);
        if (error && error.code === 'NOT_AUTHENTICATED') {
            return { isSuccess: false, notAuthenticated: true, redirect: 'public/login.html', message: 'No autenticado', data: null };
        }
        return { isSuccess: false, message: 'Error al limpiar datos', data: null };
    }
}
