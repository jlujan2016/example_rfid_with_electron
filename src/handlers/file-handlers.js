/**
 * Handlers para operaciones de archivos
 */

const { app, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const config = require('../config/app.config');

function sanitizeFileName(name) {
  return String(name || 'archivo.xlsx')
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim();
}

function resolveDownloadUrl(inputUrl, baseUrl) {
  try {
    return new URL(inputUrl).toString();
  } catch (error) {
    return new URL(inputUrl, baseUrl).toString();
  }
}

function normalizeReportPath(inputPath) {
  if (!inputPath) return '';
  return String(inputPath).replace(/^\/+/, '');
}

function buildDownloadCandidates(args) {
  const candidates = [];
  const pushUnique = (url) => {
    if (!url || candidates.includes(url)) return;
    candidates.push(url);
  };

  const resolvedFromApi = resolveDownloadUrl(args.url, config.api.baseUrl);
  pushUnique(resolvedFromApi);

  const apiOrigin = new URL(config.api.baseUrl).origin;
  const reportPath = normalizeReportPath(args.path);

  if (reportPath) {
    pushUnique(`${apiOrigin}/storage/${reportPath}`);
    pushUnique(`${apiOrigin}/public/storage/${reportPath}`);
  }

  try {
    const parsed = new URL(resolvedFromApi);
    if (parsed.pathname.includes('/storage/')) {
      pushUnique(`${parsed.origin}/public${parsed.pathname}${parsed.search || ''}`);
    }
    if (parsed.pathname.includes('/public/storage/')) {
      pushUnique(`${parsed.origin}${parsed.pathname.replace('/public/storage/', '/storage/')}${parsed.search || ''}`);
    }
  } catch (error) {
    // Ignorar parsing secundario.
  }

  return candidates;
}

function downloadFile(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? https : http;

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'Accept': '*/*',
        'X-AUTHORIZATION': config.api.token,
      },
      timeout: 20000,
    };

    const request = client.request(options, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        if (maxRedirects <= 0) {
          response.resume();
          reject(new Error('Demasiadas redirecciones al descargar el archivo'));
          return;
        }

        const redirectedUrl = resolveDownloadUrl(response.headers.location, url);
        resolve(downloadFile(redirectedUrl, maxRedirects - 1));
        response.resume();
        return;
      }

      if (response.statusCode !== 200) {
        const responseChunks = [];
        response.on('data', (chunk) => responseChunks.push(chunk));
        response.on('end', () => {
          const error = new Error(`No se pudo descargar el archivo (HTTP ${response.statusCode})`);
          error.statusCode = response.statusCode;
          error.url = url;
          error.responseBody = Buffer.concat(responseChunks).toString('utf8').slice(0, 350);
          reject(error);
        });
        response.resume();
        return;
      }

      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    });

    request.on('error', reject);
    request.setTimeout(20000, () => {
      request.destroy(new Error('Tiempo de espera agotado al descargar el archivo'));
    });

    request.end();
  });
}

/**
 * Handler para guardar imágenes
 */
async function handleSaveImage(event, dataUrl, filename) {
  try {
    const downloadsPath = app.getPath('downloads');
    const scotiaDir = path.join(downloadsPath, config.files.downloadFolder);

    if (!fs.existsSync(scotiaDir)) {
      fs.mkdirSync(scotiaDir, { recursive: true });
    }

    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    const filePath = path.join(scotiaDir, filename);

    fs.writeFileSync(filePath, base64Data, 'base64');
    console.log('Imagen guardada exitosamente en:', filePath);
    
    return { success: true, path: filePath };
  } catch (err) {
    console.error('Error al guardar imagen:', err);
    dialog.showErrorBox('Error al guardar', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Handler para descargar un archivo remoto y guardarlo en Descargas
 */
async function handleDownloadFile(event, args) {
  try {
    if (!args || !args.url) {
      return { success: false, error: 'Falta URL de descarga' };
    }

    const downloadsPath = app.getPath('downloads');
    const appDir = path.join(downloadsPath, config.files.downloadFolder);

    if (!fs.existsSync(appDir)) {
      fs.mkdirSync(appDir, { recursive: true });
    }

    const fileName = sanitizeFileName(args.name || 'avance.xlsx');
    const filePath = path.join(appDir, fileName);
    const candidateUrls = buildDownloadCandidates(args);

    let fileBuffer = null;
    let lastError = null;

    for (const candidateUrl of candidateUrls) {
      try {
        fileBuffer = await downloadFile(candidateUrl);
        break;
      } catch (error) {
        lastError = error;
        console.warn('Intento de descarga fallido:', {
          url: candidateUrl,
          statusCode: error.statusCode,
          message: error.message
        });
      }
    }

    if (!fileBuffer) {
      const errorMessage = lastError?.message || 'No se pudo descargar el archivo';
      return {
        success: false,
        error: errorMessage,
        detail: {
          statusCode: lastError?.statusCode,
          url: lastError?.url,
          responseBody: lastError?.responseBody
        }
      };
    }

    fs.writeFileSync(filePath, fileBuffer);

    return { success: true, path: filePath, name: fileName };
  } catch (err) {
    console.error('Error al descargar archivo:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Handler para obtener ropas desde JSON
 * (Actualmente comentado en el código original)
 */
async function handleGetRopas(event) {
  const jsonPath = path.join(__dirname, '..', '..', 'public', 'json', 'ropas.json');
  try {
    const data = fs.readFileSync(jsonPath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading ropas.json:', err);
    
    // Mostrar alerta del sistema operativo
    dialog.showErrorBox(
      'Error al Cargar Ropas',
      `No se pudo cargar el archivo de ropas:\n\n${err.message}`
    );
    
    return [];
  }
}

module.exports = {
  handleSaveImage,
  handleGetRopas,
  handleDownloadFile
};
