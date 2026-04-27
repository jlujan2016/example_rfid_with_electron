# Estructura de Handlers del Backend

Esta carpeta contiene los handlers organizados para la aplicación Electron.

## Estructura

```
src/
├── handlers/
│   ├── index.js           # Punto de entrada, registra todos los handlers
│   ├── api-handlers.js    # Handlers para comunicación con API externa
│   └── file-handlers.js   # Handlers para operaciones de archivos
└── config/
    └── app.config.js      # Configuración centralizada de la app
```

## Archivos

### `index.js`
Punto de entrada que registra todos los handlers IPC con Electron.
- Función `registerHandlers()`: Registra todos los handlers
- Función `unregisterHandlers()`: Remueve handlers (útil para hot reload)

### `api-handlers.js`
Contiene handlers para comunicación con el backend externo.

**Handlers disponibles:**
- `handleEnviarCategorias(event, data)`: Envía categorías al backend

**Funciones auxiliares:**
- `makeRequest(endpoint, method, data)`: Función genérica para HTTP/HTTPS
- `setApiBaseUrl(newUrl)`: Actualiza la URL base del API
- `getApiConfig()`: Obtiene la configuración actual

### `file-handlers.js`
Contiene handlers para operaciones con archivos.

**Handlers disponibles:**
- `handleSaveImage(event, dataUrl, filename)`: Guarda imágenes en disco
- `handleGetRopas(event)`: Lee datos desde archivo JSON

## Configuración

Edita `src/config/app.config.js` para cambiar:
- URL del backend
- Timeout de peticiones
- Carpeta de descargas
- Configuración de ventana

También puedes usar variables de entorno:
```bash
API_URL=https://api.produccion.com npm run start
```

## Uso en setup.js

```javascript
const { registerHandlers } = require('./src/handlers');

app.whenReady().then(() => {
  registerHandlers();
  createWindow();
});
```

## Agregar nuevos handlers

1. Crea la función handler en el archivo apropiado:
```javascript
// En api-handlers.js o file-handlers.js
async function handleNuevoMetodo(event, params) {
  // Tu código aquí
  return { success: true, data: result };
}

// Exporta la función
module.exports = {
  // ... otros handlers
  handleNuevoMetodo
};
```

2. Registra el handler en `index.js`:
```javascript
function registerHandlers() {
  // ... otros handlers
  ipcMain.handle('nuevo-metodo', apiHandlers.handleNuevoMetodo);
}
```

3. Expón el handler en `preload.js`:
```javascript
contextBridge.exposeInMainWorld('api', {
  // ... otros métodos
  nuevoMetodo: (params) => ipcRenderer.invoke('nuevo-metodo', params)
});
```

4. Usa desde el frontend:
```javascript
window.api.nuevoMetodo(params)
  .then(response => console.log(response))
  .catch(error => console.error(error));
```

## Ventajas de esta organización

✅ **Separación de responsabilidades**: Cada archivo tiene un propósito específico
✅ **Fácil mantenimiento**: Código organizado y fácil de encontrar
✅ **Escalabilidad**: Fácil agregar nuevos handlers
✅ **Configuración centralizada**: Un solo lugar para cambiar settings
✅ **Reutilización**: Funciones auxiliares compartidas
✅ **Testing**: Más fácil de testear módulos independientes
