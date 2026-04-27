# Lector RFID UHF UR4 - Aplicación Node.js

Aplicación para lectura continua de tags RFID UHF usando el lector UR4 Fixed Reader mediante protocolo TCP/IP.

## 🚀 Inicio Rápido

### Instalación
```bash
npm install
```

### Configuración
Edita [config.js](config.js) para ajustar:
- **distanciaMetros**: Distancia de lectura (0.1-15+ metros)
  - `0.1` = 10cm, `0.5` = 50cm, `2` = 2 metros, `10` = 10 metros
- **umbralDuplicados**: Tiempo en ms para filtrar tags duplicados (200ms recomendado)

### Ejecución
```bash
npm start
```

## 📁 Estructura del Proyecto

```
antena-test-v1.0/
├── main.js                          # Aplicación principal
├── config.js                        # Configuración global
├── package.json                     # Dependencias del proyecto
└── nodejs-uhf-commands/
    ├── frame-builder.js             # Construcción de tramas (bajo nivel)
    ├── protocol-builder.js          # Parser de tramas y procesamiento de tags
    ├── commands.js                  # Comandos del lector + catálogo
    └── utils.js                     # Utilidad: cálculo de configuración por distancia
```

## 🎯 Arquitectura

### **main.js** - Capa de Aplicación
- Conexión TCP/IP con el lector (192.168.99.202:8889)
- Servidor HTTP/WebSocket (puerto 3000)
- Secuencia de configuración del lector
- Control de flujo y eventos
- Display de información en consola

### **config.js** - Configuración Centralizada
```javascript
module.exports = {
    lector: {
        ip: '192.168.99.202',
        puerto: 8889,
        distanciaMetros: 2,  // 0.1-15+ (valores decimales para cm)
        beeper: { habilitado: true, duracion: 100 }
    },
    tags: {
        umbralDuplicados: 200,  // ms para filtrar duplicados
        rssi: { max: 200, min: 0 }
    }
};
```

### **nodejs-uhf-commands/** - Módulo Core
Contiene toda la lógica del protocolo UHF RFID:

- **frame-builder.js**: Construcción de tramas binarias
  - `buildCommand(command, data)` - Construye trama con header A55A
  - `calculateChecksum(cmd, data, length)` - Calcula checksum

- **protocol-builder.js**: Parser y procesamiento
  - `FrameParser` - Parser de tramas entrantes
  - `Parsers.parseTagFromUR4Response()` - Extrae datos del tag
  - `Parsers.isDuplicate()` - Control de duplicados

- **commands.js**: Catálogo de comandos
  - `Commands.startInventoryUR4()` - Inventario continuo (0x82)
  - `Commands.setPower(dbm)` - Configurar potencia
  - `Commands.setSession(session, qValue)` - Configurar sesión
  - Array `comandos` con nombres en español

- **utils.js**: Cálculos, conversiones y validaciones
  - `obtenerConfiguracionDistancia(metros)` - Calcula configuración óptima según distancia
  - `estimarDistancia(potencia, session, linkProfile)` - Estima rango de alcance
  - `calcularRSSIEsperado(potencia, distancia)` - Calcula RSSI esperado
  - `obtenerConfiguracionRecomendada(escenario)` - Perfiles predefinidos
  - `validarConfiguracion(config)` - Valida parámetros
  - `formatearRSSI(rssi)` - Formatea valores RSSI
  - `obtenerNombreRegion(codigo)` - Convierte código de región

## ⚙️ Configuración de Distancia

El sistema ajusta automáticamente la potencia y parámetros según la distancia deseada.

**Soporte para centímetros:** Usa valores decimales (0.1 = 10cm, 0.5 = 50cm, 0.8 = 80cm)

| Distancia | Potencia | Session | Q Value | Link Profile | Uso |
|-----------|----------|---------|---------|--------------|-----|
| 10-49 cm  | 5 dBm    | S0      | 0       | 0            | Muy corto alcance |
| 50-99 cm  | 5-7 dBm  | S0      | 2       | 0            | Corto alcance |
| 1-2 m     | 15-18 dBm| S0      | 3       | 0            | Rápido |
| 3-4 m     | 18-22 dBm| S0      | 4       | 1            | Medio-corto |
| 5-6 m     | 22-25 dBm| S1      | 4       | 1            | Medio |
| 7-8 m     | 25-28 dBm| S1      | 5       | 1            | Medio-largo |
| 9-10 m    | 28-30 dBm| S2      | 6       | 3            | Largo |
| 11+ m     | 30 dBm   | S2      | 7       | 3            | **MÁXIMO** |

### Ejemplos de Uso

```javascript
// config.js
distanciaMetros: 0.1   // 10cm - Potencia mínima (5 dBm)
distanciaMetros: 0.5   // 50cm - Muy corto alcance
distanciaMetros: 2     // 2 metros - Lectura rápida
distanciaMetros: 5     // 5 metros - Balanceado
distanciaMetros: 10    // 10 metros - Largo alcance
distanciaMetros: 15    // 15+ metros - Máxima potencia (30 dBm)
```

## 🔧 Protocolo UR4

### Formato de Trama
```
[A5 5A] [LEN] [CMD] [DATA...] [CHK] [0D 0A]
```

- **Header**: A5 5A (fijo)
- **Length**: 1 byte (comando + datos)
- **Command**: 1 byte (código de operación)
- **Data**: N bytes (parámetros del comando)
- **Checksum**: 1 byte (suma de LEN, CMD, DATA)
- **Tail**: 0D 0A (fijo)

### Comandos Principales

| Comando | Hex  | Descripción |
|---------|------|-------------|
| Start Inventory UR4 | 0x82 | Inventario continuo |
| Response Inventory | 0x83 | Respuesta con tag detectado |
| Set Power | 0xB7 | Configurar potencia (5-30 dBm) |
| Set Session | 0xB8 | Configurar sesión (S0-S3) |
| Set Beeper | 0xBF | Activar/desactivar beeper |
| Set Link Profile | 0xC0 | Configurar perfil de enlace |

Ver [COMMANDS.md](nodejs-uhf-commands/COMMANDS.md) para catálogo completo.

## 📡 WebSocket API

La aplicación expone un servidor WebSocket en `http://localhost:3000` que emite:

### Evento: `tag-detected`
Se emite cada vez que se detecta un tag único:
```javascript
{
  epc: "E2801170210022380153B1D8",
  rssi: "-75.3",
  antenna: 1,
  timestamp: "2024-12-15T10:30:45.123Z",
  count: 5  // Número de veces que se ha leído este tag
}
```

### Cliente de Ejemplo
```javascript
const socket = io('http://localhost:3000');

socket.on('tag-detected', (data) => {
  console.log('Tag detectado:', data.epc);
  console.log('RSSI:', data.rssi);
  console.log('Lecturas:', data.count);
});
```

## 🏷️ Formato de Tag

Los tags RFID EPC Gen2 tienen la siguiente estructura:

```
[PC(2)] [EPC(variable)] [RSSI(2)] [ANT(1)]
```

- **PC** (2 bytes): Protocol Control - indica longitud del EPC
- **EPC** (6-30 bytes): Electronic Product Code - identificador único
- **RSSI** (2 bytes): Received Signal Strength Indicator
- **ANT** (1 byte): Número de antena que detectó el tag

### Cálculo de Longitud EPC
```javascript
const pcValue = (frame[0] << 8) | frame[1];
const epcLength = ((pcValue >> 11) & 0x1F) * 2;  // En bytes
```

### Cálculo de RSSI
```javascript
const rssiValue = (frame[epcStart + epcLength] << 8) | frame[epcStart + epcLength + 1];
const rssi = ((65535 - rssiValue) / 10).toFixed(1);  // En dBm
```

## 🔍 Control de Duplicados

El sistema filtra tags duplicados usando un cache temporal:

```javascript
// config.js
tags: {
    umbralDuplicados: 200  // milisegundos
}
```

- **200ms recomendado**: Detecta múltiples tags sin spam
- **Mayor**: Menos lecturas, menos duplicados
- **Menor**: Más lecturas, más actualizaciones

## 📊 Contador de Tags

Cada tag mantiene un contador de lecturas que se muestra en consola:

```
📌 Tag detectado: 0053
   EPC completo: E2801170210022380153B1D8
   RSSI: -75.3 dBm
   Antena: 1
   ✓ Lecturas: 12 veces
```

## ⚠️ Limitaciones de Distancia Corta

Para distancias **< 50cm**, las antenas UHF RFID tienen limitaciones físicas:

- **Campo cercano**: Comportamiento impredecible a < 30cm
- **Potencia mínima**: 5 dBm es el límite regulatorio (configuración automática)
- **Sensibilidad del tag**: Requiere energía mínima para activarse
- **Q Value mínimo**: Se configura automáticamente en 0 para < 50cm

**Configuración aplicada automáticamente para < 50cm:**
```javascript
// 10-49 cm
potencia: 5 dBm     // Mínimo absoluto
session: 0          // S0 (inventario rápido)
qValue: 0           // Mínimo (sin anti-colisión)
linkProfile: 0      // Dense Reader Mode
```

**Solución recomendada** para lecturas < 50cm:
- Usar **blindaje físico** (metal) para limitar radiación
- Considerar **tecnología NFC o HF RFID** (13.56 MHz)
- Rango práctico óptimo UHF: **1-10 metros**
- **Nota**: Con `distanciaMetros: 0.1` el sistema aplica la configuración mínima, pero el alcance real puede ser mayor (1-2m) debido a limitaciones físicas de la antena UHF

## � Lectura de Configuración del Lector

La aplicación incluye funcionalidad para leer la configuración actual del lector mediante el comando `Get Power (0x94)`.

### Comportamiento

**Cuando funciona correctamente:**
```javascript
// El lector responde con su potencia configurada (1-30 dBm)
✓ Potencia obtenida del lector: 18 dBm
  Distancia estimada: 2 metros
```

**Cuando el lector no soporta el comando:**
```javascript
// El lector puede responder con valores inválidos (ej: 0xF1 = 241 dBm)
⚠️ Potencia fuera de rango: 241 dBm (0xF1)
   → Este comando podría no ser soportado por tu modelo de lector
✓ Usando configuración del archivo config.js
```

### Causas de valores inválidos

Según el análisis del SDK original (C# y Java):

1. **Lector no configurado previamente**: El lector devuelve un valor por defecto inválido (0xF1, 0xFF, etc.) cuando nunca se ha ejecutado `setPower()` después de un reset o encendido.

2. **Modelo de lector**: Algunos modelos no implementan completamente el comando `GetPower` estándar.

3. **Firmware desactualizado**: Versiones antiguas del firmware pueden tener implementaciones incompletas.

### Solución implementada

El sistema usa un **fallback inteligente**:

```javascript
// 1. Intenta leer del lector
const power = await getReaderConfig();

// 2. Si el valor es inválido, usa config.js
if (power < 1 || power > 30) {
    const { obtenerConfiguracionDistancia } = require('./utils');
    const config = obtenerConfiguracionDistancia(distanciaMetros);
    power = config.potencia;  // Valor calculado correcto
}
```

**Ventajas de este enfoque:**
- ✅ Funciona incluso si el lector no soporta `GetPower`
- ✅ Usa valores precalculados basados en la distancia deseada
- ✅ No requiere configuración manual repetida
- ✅ Mantiene coherencia con `config.js`

### Recomendación

Si tu lector siempre devuelve valores inválidos:
1. **No es un problema**: La configuración de `config.js` es la fuente de verdad
2. **El botón "Obtener configuración"** seguirá funcionando, mostrando los valores actuales de `config.js`
3. **Los valores se aplicarán correctamente** mediante `setPower()` al iniciar la aplicación

## �🔧 Funciones Auxiliares (utils.js)

Además de `obtenerConfiguracionDistancia()`, el módulo `utils.js` proporciona funciones adicionales para casos avanzados:

### Estimación de Distancia
```javascript
const { estimarDistancia } = require('./nodejs-uhf-commands/utils');

// Estimar rango de alcance según configuración actual
const rango = estimarDistancia(30, 1, 1);  // potencia: 30dBm, session: S1, linkProfile: 1
console.log(rango);  // "6.0-7.5" metros
```

### Configuraciones Predefinidas por Escenario
```javascript
const { obtenerConfiguracionRecomendada } = require('./nodejs-uhf-commands/utils');

// Obtener configuración optimizada para escenario específico
const configLargo = obtenerConfiguracionRecomendada('largo');
console.log(configLargo);
/* {
  nombre: 'Largo alcance (8-12m)',
  potencia: 30,
  sesion: { session: 2, qValue: 7 },
  linkProfile: 3,
  distanciaEstimada: '7.0-13.0'
} */

// Escenarios disponibles:
// - 'corto': 1-3m, lectura rápida
// - 'medio': 4-6m, balanceado
// - 'largo': 8-12m, máxima distancia
// - 'almacen': Alta densidad de tags
// - 'puerta': Control de acceso
```

### Validación de Configuración
```javascript
const { validarConfiguracion } = require('./nodejs-uhf-commands/utils');

const config = {
  potencia: 35,  // Inválido (> 30)
  sesion: { session: 0, qValue: 20 }  // qValue inválido (> 15)
};

const validacion = validarConfiguracion(config);
if (!validacion.valido) {
  console.error('Errores:', validacion.errores);
  // ["Potencia debe estar entre 5 y 30 dBm", "Q Value debe estar entre 0 y 15"]
}
```

### Cálculo de RSSI Esperado
```javascript
const { calcularRSSIEsperado } = require('./nodejs-uhf-commands/utils');

// Calcular RSSI esperado a una distancia dada
const rssi = calcularRSSIEsperado(30, 5);  // 30 dBm a 5 metros
console.log(rssi);  // ~-65 dBm (aproximado según Friis)
```

### Formateo y Conversiones
```javascript
const { formatearRSSI, obtenerNombreRegion } = require('./nodejs-uhf-commands/utils');

// Formatear RSSI para display
console.log(formatearRSSI(75.3));     // "-75.3 dBm"
console.log(formatearRSSI(-80));      // "-80 dBm"
console.log(formatearRSSI('N/A'));    // "N/A"

// Convertir código de región a nombre
console.log(obtenerNombreRegion(0x01));  // "Estados Unidos (902-928 MHz)"
console.log(obtenerNombreRegion(0x02));  // "Europa (865-868 MHz)"
console.log(obtenerNombreRegion(0x04));  // "China (920-925 MHz)"
```

## 📖 Especificación del Protocolo

### Formato Detallado de Trama

```
┌──────┬────────┬─────────┬───────┬──────────┬──────┐
│HEADER│ LENGTH │ COMMAND │  DATA │ CHECKSUM │ TAIL │
├──────┼────────┼─────────┼───────┼──────────┼──────┤
│ A5 5A│ HH LL  │   CMD   │  ...  │    CS    │ 0D 0A│
│2 bytes│2 bytes │ 1 byte  │N bytes│  1 byte  │2 bytes│
└──────┴────────┴─────────┴───────┴──────────┴──────┘
```

### Componentes

1. **HEADER** (2 bytes): `A5 5A` (fijo)
2. **LENGTH** (2 bytes): Longitud total (Big-Endian)
3. **COMMAND** (1 byte): Código de operación
4. **DATA** (N bytes): Parámetros (variable)
5. **CHECKSUM** (1 byte): XOR de CMD y DATA
6. **TAIL** (2 bytes): `0D 0A` (CR+LF)

### Cálculo de Checksum

```javascript
function calculateChecksum(command, data) {
  let checksum = command;
  for (let i = 0; i < data.length; i++) {
    checksum ^= data[i];
  }
  return checksum & 0xFF;
}
```

### Ejemplos de Tramas

**Get Version:**
```
A5 5A 00 09 87 EC 0D 0A
```

**Set Power (30 dBm):**
```
A5 5A 00 0C B7 00 1E BB 0D 0A
```

**Start Inventory UR4:**
```
A5 5A 00 09 82 E8 0D 0A
```

## 📋 Catálogo de Comandos

### Comandos de Inventario

| Comando | Hex | Descripción | Parámetros |
|---------|-----|-------------|------------|
| Start Inventory UR4 | 0x82 | Iniciar lectura continua | Ninguno |
| Stop Inventory UR4 | 0x8C | Detener lectura continua | Ninguno |
| Response Inventory | 0x83 | Respuesta con tag (automática) | [PC][EPC][RSSI][ANT] |
| Single Inventory | 0x90 | Lectura única | Ninguno |

### Comandos de Configuración

| Comando | Hex | Descripción | Parámetros |
|---------|-----|-------------|------------|
| Set Power | 0xB7 | Potencia (5-30 dBm) | [POWER_H][POWER_L] (en 0.1 dBm) |
| Set Session | 0xB8 | Sesión y Q Value | [SESSION][QVALUE] |
| Set Link Profile | 0xC0 | Perfil de enlace (0-3) | [PROFILE] |
| Set Region | 0xB6 | Región de frecuencia | [REGION] |
| Set Beeper | 0xBF | Activar beeper | [ENABLE][DURATION_MS] |

### Comandos de Lectura/Escritura

| Comando | Hex | Descripción | Parámetros |
|---------|-----|-------------|------------|
| Read Tag Data | 0x86 | Leer memoria del tag | [PWD(4)][BANK][PTR(2)][CNT(2)] |
| Write Tag Data | 0x86 | Escribir en tag | [PWD(4)][BANK][PTR(2)][DATA] |
| Lock Tag | 0x8A | Bloquear áreas del tag | [PWD(4)][LOCK_MASK] |
| Kill Tag | 0x8B | Desactivar tag | [KILL_PWD(4)] |

### Comandos de Dispositivo

| Comando | Hex | Descripción | Parámetros |
|---------|-----|-------------|------------|
| Get Version | 0x87 | Versión firmware | Ninguno |
| Get Temperature | 0xE4 | Temperatura interna | [SUB_CMD=0x01] |
| Reset Device | 0xE5 | Reiniciar lector | Ninguno |
| Get Network Info | 0xC4 | Info de red (IP, MAC) | Ninguno |
| Set Network | 0xC3 | Configurar red | [IP(4)][MASK(4)][GW(4)] |

### Bancos de Memoria del Tag

| Banco | Código | Descripción | Contenido |
|-------|--------|-------------|-----------|
| RESERVED | 0x00 | Memoria reservada | Kill/Access PWD |
| EPC | 0x01 | Electronic Product Code | EPC, PC, CRC |
| TID | 0x02 | Tag Identifier | Fabricante, modelo |
| USER | 0x03 | Memoria de usuario | Datos personalizados |

### Ejemplo: Leer EPC Completo

```javascript
const { Commands } = require('./nodejs-uhf-commands/commands');

// Leer 6 words del banco EPC
const accessPwd = [0x00, 0x00, 0x00, 0x00];  // Sin password
const bank = 0x01;      // Banco EPC
const startPtr = 0x02;  // Desde word 2 (después de CRC y PC)
const wordCount = 0x06; // 6 words = 12 bytes

const data = [
  ...accessPwd,
  bank,
  (startPtr >> 8) & 0xFF, startPtr & 0xFF,
  (wordCount >> 8) & 0xFF, wordCount & 0xFF
];

const cmd = buildCommand(0x86, data);
readerClient.write(cmd);
```

### Respuestas de Error

| Código | Descripción |
|--------|-------------|
| 0x00 | Éxito |
| 0x01 | Error general |
| 0x02 | Parámetro inválido |
| 0x03 | Tag no encontrado |
| 0x04 | Acceso denegado (password incorrecto) |
| 0x05 | Memoria bloqueada |
| 0x06 | Checksum inválido |

## 🛠️ Desarrollo

### Dependencias
```json
{
  "net": "^1.0.2",
  "http": "^0.0.1-security",
  "socket.io": "^4.8.1"
}
```

### Estructura Modular

El código está organizado para:
- ✅ **Reutilización**: Módulos independientes y testeables
- ✅ **Mantenibilidad**: Separación clara de responsabilidades
- ✅ **Escalabilidad**: Fácil agregar nuevos comandos o funcionalidades

### Agregar Nuevos Comandos

1. Agregar entrada en `commands.js`:
```javascript
const comandos = {
    mi_nuevo_comando: 0xXX
};
```

2. Crear función builder:
```javascript
Commands.miNuevoComando = function(parametros) {
    return buildCommand(comandos.mi_nuevo_comando, [parametros]);
};
```

3. Usar en `main.js`:
```javascript
const cmd = Commands.miNuevoComando(params);
readerClient.write(cmd);
```

## 📝 Licencia

Proyecto desarrollado para lectura de tags RFID UHF usando lector UR4.
# Protocolo de Comunicación UHF UR4

Este documento describe el formato de trama y la estructura del protocolo de comunicación del lector UHF UR4.

## Formato de Trama

Todas las tramas siguen esta estructura:

```
┌──────┬────────┬─────────┬───────┬──────────┬──────┐
│HEADER│ LENGTH │ COMMAND │  DATA │ CHECKSUM │ TAIL │
├──────┼────────┼─────────┼───────┼──────────┼──────┤
│ A5 5A│ HH LL  │   CMD   │  ...  │    CS    │ 0D 0A│
│2 bytes│2 bytes │ 1 byte  │N bytes│  1 byte  │2 bytes│
└──────┴────────┴─────────┴───────┴──────────┴──────┘
```

### Componentes de la Trama

#### 1. HEADER (2 bytes)
- Valor fijo: `A5 5A`
- Identifica el inicio de una trama válida

#### 2. LENGTH (2 bytes)
- Formato: Big-Endian
- Valor: Longitud total del paquete (desde Header hasta Tail inclusive)
- Ejemplo: `00 0A` = 10 bytes en total

#### 3. COMMAND (1 byte)
- Código del comando a ejecutar
- Rangos típicos:
  - `0x80-0x8F`: Comandos de lectura/escritura de tags
  - `0x90-0x9F`: Comandos de configuración
  - `0xA0-0xAF`: Comandos extendidos
  - `0xE4`: Comandos de dispositivo (beep, batería)

#### 4. DATA (N bytes)
- Parámetros del comando
- Longitud variable según el comando
- Puede estar vacío para algunos comandos

#### 5. CHECKSUM (1 byte)
- Cálculo: XOR de todos los bytes desde COMMAND hasta el último byte de DATA
- **NO incluye**: HEADER, LENGTH, ni TAIL
- Fórmula: `CS = CMD ^ DATA[0] ^ DATA[1] ^ ... ^ DATA[N-1]`

#### 6. TAIL (2 bytes)
- Valor fijo: `0D 0A` (CR + LF)
- Indica el fin de la trama

## Ejemplos de Tramas

### Ejemplo 1: Get Version (Sin datos)

```
Comando: Obtener versión del firmware

Trama:
A5 5A 00 09 87 EC 0D 0A

Desglose:
├─ A5 5A       : Header
├─ 00 09       : Length (9 bytes total)
├─ 87          : Command (Get Version)
├─ (vacío)     : Data (sin parámetros)
├─ EC          : Checksum (0x87 ^ 0x00 ^ 0x09 = 0xEC)
└─ 0D 0A       : Tail
```

### Ejemplo 2: Set Beep ON (Con datos)

```
Comando: Activar beep del lector

Trama:
A5 5A 00 0A E4 03 01 EC 0D 0A

Desglose:
├─ A5 5A       : Header
├─ 00 0A       : Length (10 bytes total)
├─ E4          : Command (Device Control)
├─ 03 01       : Data (Subcomando: 03=Beep, Valor: 01=ON)
├─ EC          : Checksum (0xE4 ^ 0x03 ^ 0x01 = 0xE6) // NOTA: Verificar en implementación real
└─ 0D 0A       : Tail
```

### Ejemplo 3: Start Inventory

```
Comando: Iniciar lectura continua de tags

Trama:
A5 5A 00 09 89 E2 0D 0A

Desglose:
├─ A5 5A       : Header
├─ 00 09       : Length
├─ 89          : Command (Start Inventory)
├─ (vacío)     : Data
├─ E2          : Checksum
└─ 0D 0A       : Tail
```

## Formato de Respuesta

Las respuestas del lector tienen el mismo formato de trama:

```
Respuesta Exitosa:
A5 5A [LENGTH] [CMD_RESP] 01 00 [DATA] [CS] 0D 0A
                           └─┬─┘
                         Status: 01=Success

Respuesta con Error:
A5 5A [LENGTH] [CMD_RESP] 01 [ERROR_CODE] [DATA] [CS] 0D 0A
                              └────┬─────┘
                             Código de error
```

### Códigos de Comando de Respuesta

| Comando Enviado | Respuesta Esperada | Descripción |
|-----------------|-------------------|-------------|
| `0x87` | `0x88` | Get Version Response |
| `0x89` | `0xE1` | Inventory Data (tag detectado) |
| `0x8A` | `0x8B` | Stop Inventory Response |
| `0x86` (Read) | `0x87` | Read Data Response |
| `0x86` (Write) | `0x87` | Write Data Response |
| `0x8C` | `0x8D` | Set Filter Response |

### Códigos de Error Comunes

| Código | Descripción |
|--------|-------------|
| `0x00` | Sin error (éxito) |
| `0x01` | Tag no encontrado |
| `0x02` | Error de lectura |
| `0x03` | Error de escritura |
| `0x04` | Parámetros inválidos |
| `0x05` | Acceso denegado (password incorrecto) |
| `0x10` | Tag bloqueado (lock) |
| `0x15` | Comando no soportado |

## Cálculo del Checksum

### Algoritmo en JavaScript

```javascript
function calculateChecksum(command, data) {
  let checksum = command;
  
  if (data && data.length > 0) {
    for (let i = 0; i < data.length; i++) {
      checksum ^= data[i];
    }
  }
  
  return checksum & 0xFF;
}

// Ejemplo de uso
const cmd = 0xE4;
const data = Buffer.from([0x03, 0x01]);
const cs = calculateChecksum(cmd, data);
console.log(`Checksum: 0x${cs.toString(16).toUpperCase()}`);
```

### Algoritmo en Python

```python
def calculate_checksum(command, data):
    checksum = command
    
    if data:
        for byte in data:
            checksum ^= byte
    
    return checksum & 0xFF

# Ejemplo de uso
cmd = 0xE4
data = bytes([0x03, 0x01])
cs = calculate_checksum(cmd, data)
print(f"Checksum: 0x{cs:02X}")
```

## Constructor de Tramas

### Función Completa en Node.js

```javascript
function buildCommand(command, data = []) {
  const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  
  // Calcular longitud total
  const length = 7 + dataBuffer.length; // Header(2) + Length(2) + Cmd(1) + Data(N) + CS(1) + Tail(2)
  
  // Calcular checksum
  let checksum = command;
  for (let i = 0; i < dataBuffer.length; i++) {
    checksum ^= dataBuffer[i];
  }
  checksum &= 0xFF;
  
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

// Ejemplo de uso
const versionCmd = buildCommand(0x87, []);
console.log('Comando Get Version:', versionCmd.toString('hex').toUpperCase());
// Salida: A55A000987EC0D0A
```

## Parser de Respuestas

```javascript
class FrameParser {
  constructor() {
    this.buffer = Buffer.alloc(0);
  }
  
  addData(data) {
    this.buffer = Buffer.concat([this.buffer, data]);
    return this.parseFrames();
  }
  
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
  
  findHeader() {
    for (let i = 0; i < this.buffer.length - 1; i++) {
      if (this.buffer[i] === 0xA5 && this.buffer[i + 1] === 0x5A) {
        return i;
      }
    }
    return -1;
  }
  
  validateFrame(frame) {
    if (frame.length < 7) return false;
    if (frame[frame.length - 2] !== 0x0D) return false;
    if (frame[frame.length - 1] !== 0x0A) return false;
    
    // Validar checksum
    const receivedCS = frame[frame.length - 3];
    const command = frame[4];
    const dataLen = frame.length - 7;
    const data = frame.slice(5, 5 + dataLen);
    
    let calculatedCS = command;
    for (let i = 0; i < data.length; i++) {
      calculatedCS ^= data[i];
    }
    calculatedCS &= 0xFF;
    
    return receivedCS === calculatedCS;
  }
  
  parseFrame(frame) {
    const command = frame[4];
    const dataLen = frame.length - 7;
    const data = frame.slice(5, 5 + dataLen);
    
    return {
      command,
      data,
      raw: frame
    };
  }
}

// Ejemplo de uso
const parser = new FrameParser();

port.on('data', (chunk) => {
  const frames = parser.addData(chunk);
  frames.forEach(frame => {
    console.log('Comando recibido:', frame.command.toString(16));
    console.log('Datos:', frame.data.toString('hex'));
  });
});
```

## Timeouts y Reintentos

### Tiempos de Espera Recomendados

| Comando | Timeout (ms) | Descripción |
|---------|--------------|-------------|
| Get Version | 500 | Respuesta rápida |
| Start/Stop Inventory | 200 | Comando de control |
| Read Tag | 1000 | Depende de la distancia del tag |
| Write Tag | 2000 | Operación de escritura |
| Set Filter | 300 | Configuración |
| Set Power | 300 | Configuración |

### Estrategia de Reintentos

```javascript
async function sendCommandWithRetry(port, command, data, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await sendCommand(port, command, data, 1000);
      return response;
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      await sleep(100 * (attempt + 1)); // Backoff exponencial
    }
  }
}
```

## Consideraciones Especiales

### 1. Buffer Overflow
- El lector tiene un buffer limitado (~2KB)
- Enviar comandos demasiado rápido puede causar pérdida de datos
- Esperar mínimo 50ms entre comandos

### 2. Inventory Mode
- Durante inventory, el lector envía datos continuamente
- El formato de respuesta es diferente (comando `0xE1`)
- Detener inventory antes de enviar otros comandos

### 3. Thread Safety
- En aplicaciones multi-hilo, sincronizar el acceso al puerto serial
- No enviar comandos simultáneos

### 4. Encodings
- Todos los valores son Big-Endian
- Las cadenas de texto (como EPC) están en formato hexadecimal ASCII

---

**Próximo**: Ver [COMMANDS.md](COMMANDS.md) para el catálogo completo de comandos disponibles.


---


# Catálogo de Comandos UHF UR4

Listado completo de comandos extraídos del ReaderAPI con formato, parámetros y respuestas.

## Índice

- [Comandos de Tag (Lectura/Escritura)](#comandos-de-tag)
- [Comandos de Inventario](#comandos-de-inventario)
- [Comandos de Configuración](#comandos-de-configuración)
- [Comandos de Potencia y Antena](#comandos-de-potencia-y-antena)
- [Comandos de Dispositivo](#comandos-de-dispositivo)
- [Comandos de Firmware](#comandos-de-firmware)
- [Comandos GPIO](#comandos-gpio)
- [Comandos de Red](#comandos-de-red)

---

## Comandos de Tag

### 0x86 - Read Tag Data

Lee datos de un tag específico.

**Comando:**
```
A5 5A [LEN] 86 [ACCESS_PWD(4)] [FILTER_BANK] [FILTER_PTR(2)] [FILTER_CNT(2)] [FILTER_DATA(N)]
                [DATA_BANK] [DATA_PTR(2)] [DATA_CNT(2)] [CS] 0D 0A
```

**Parámetros:**
- `ACCESS_PWD`: 4 bytes - Password de acceso (00000000 para tags sin protección)
- `FILTER_BANK`: 1 byte - Área de filtro (01=EPC, 02=TID, 03=USER)
- `FILTER_PTR`: 2 bytes - Posición inicial del filtro (en bits)
- `FILTER_CNT`: 2 bytes - Longitud del filtro (en bits, 0=sin filtro)
- `FILTER_DATA`: N bytes - Datos del filtro
- `DATA_BANK`: 1 byte - Área a leer (00=Reserved, 01=EPC, 02=TID, 03=USER)
- `DATA_PTR`: 2 bytes - Posición inicial de lectura (en words de 16 bits)
- `DATA_CNT`: 2 bytes - Cantidad de words a leer

**Respuesta Exitosa:**
```
A5 5A [LEN] 87 01 00 [DATA] [CS] 0D 0A
```
- `01 00`: Status OK
- `DATA`: Datos leídos

**Ejemplo (Leer 6 words del EPC sin filtro):**
```javascript
const accessPwd = Buffer.from([0x00, 0x00, 0x00, 0x00]);
const filterBank = 0x01;   // EPC
const filterPtr = 0x0000;  // Posición 0
const filterCnt = 0x0000;  // Sin filtro
const dataBank = 0x01;     // Leer de EPC
const dataPtr = 0x0002;    // Desde word 2
const dataCnt = 0x0006;    // 6 words

const data = Buffer.concat([
  accessPwd,
  Buffer.from([filterBank]),
  Buffer.from([(filterPtr >> 8) & 0xFF, filterPtr & 0xFF]),
  Buffer.from([(filterCnt >> 8) & 0xFF, filterCnt & 0xFF]),
  Buffer.from([dataBank]),
  Buffer.from([(dataPtr >> 8) & 0xFF, dataPtr & 0xFF]),
  Buffer.from([(dataCnt >> 8) & 0xFF, dataCnt & 0xFF])
]);

const cmd = buildCommand(0x86, data);
```

---

### 0x86 - Write Tag Data

Escribe datos en un tag específico.

**Comando:**
```
A5 5A [LEN] 86 [ACCESS_PWD(4)] [FILTER_BANK] [FILTER_PTR(2)] [FILTER_CNT(2)] [FILTER_DATA(N)]
                [DATA_BANK] [DATA_PTR(2)] [DATA_CNT(2)] [WRITE_DATA(N)] [CS] 0D 0A
```

**Parámetros:** (Similar a Read, más:)
- `WRITE_DATA`: N bytes - Datos a escribir (2 bytes por word)

**Respuesta Exitosa:**
```
A5 5A [LEN] 87 01 00 [CS] 0D 0A
```

**Ejemplo (Escribir "ABCD" en el EPC):**
```javascript
const writeData = Buffer.from([0xAB, 0xCD]); // 1 word = 2 bytes

const data = Buffer.concat([
  accessPwd,
  Buffer.from([filterBank]),
  Buffer.from([(filterPtr >> 8) & 0xFF, filterPtr & 0xFF]),
  Buffer.from([(filterCnt >> 8) & 0xFF, filterCnt & 0xFF]),
  Buffer.from([dataBank]),
  Buffer.from([(dataPtr >> 8) & 0xFF, dataPtr & 0xFF]),
  Buffer.from([0x00, 0x01]), // 1 word
  writeData
]);

const cmd = buildCommand(0x86, data);
```

---

### 0x84 - Lock Memory

Bloquea áreas de memoria del tag.

**Comando:**
```
A5 5A [LEN] 84 [ACCESS_PWD(4)] [LOCK_CODE(3)] [CS] 0D 0A
```

**Parámetros:**
- `ACCESS_PWD`: 4 bytes - Password de acceso
- `LOCK_CODE`: 3 bytes - Código de bloqueo generado

**Lock Banks:**
- `0x01`: Kill Password
- `0x02`: Access Password
- `0x04`: EPC Memory
- `0x08`: TID Memory
- `0x10`: User Memory

**Lock Modes:**
- `0x00`: Open (desbloquear, lectura/escritura libre)
- `0x01`: Lock (bloquear, no se puede escribir)
- `0x02`: Permanent Open (permanente abierto)
- `0x03`: Permanent Lock (permanente bloqueado, irreversible)

**Ejemplo Helper para generar Lock Code:**
```javascript
function generateLockCode(banks, lockMode) {
  // banks: array de bank IDs [0x01, 0x02, 0x04...]
  // lockMode: 0x00-0x03
  
  let code = 0;
  banks.forEach(bank => {
    code |= (bank << (lockMode * 2));
  });
  
  return Buffer.from([
    (code >> 16) & 0xFF,
    (code >> 8) & 0xFF,
    code & 0xFF
  ]);
}

// Bloquear permanentemente EPC y USER
const lockCode = generateLockCode([0x04, 0x10], 0x03);
```

---

### 0x85 - Kill Tag

Destruye permanentemente un tag (irreversible).

**Comando:**
```
A5 5A [LEN] 85 [KILL_PWD(4)] [CS] 0D 0A
```

**Parámetros:**
- `KILL_PWD`: 4 bytes - Kill Password (debe estar configurado previamente en el tag)

**Respuesta:**
```
A5 5A [LEN] 86 01 00 [CS] 0D 0A
```

**⚠️ ADVERTENCIA:** Esta operación es IRREVERSIBLE. El tag quedará permanentemente inutilizable.

```javascript
const killPwd = Buffer.from([0x12, 0x34, 0x56, 0x78]);
const cmd = buildCommand(0x85, killPwd);
```

---

## Comandos de Inventario

### 0x89 - Start Inventory

Inicia la lectura continua de tags.

**Comando:**
```
A5 5A 00 09 89 E2 0D 0A
```

**Sin parámetros.**

**Respuesta:** El lector no envía confirmación inmediata, sino que comienza a enviar tramas `0xE1` con los tags detectados.

**Formato de datos de tag (0xE1):**
```
A5 5A [LEN] E1 [INDEX(2)] [TAG_COUNT] [TAG_DATA...] [CS] 0D 0A
```

- `INDEX`: 2 bytes - Índice de lectura
- `TAG_COUNT`: 1 byte - Cantidad de tags en esta trama
- `TAG_DATA`: Para cada tag:
  - `PC(2)`: Protocol Control
  - `EPC(N)`: EPC del tag
  - `TID(12)`: TID (si está configurado EPC+TID mode)
  - `USER(N)`: User data (si está configurado)
  - `RSSI(2)`: Indicador de señal
  - `ANT(1)`: Número de antena

**Ejemplo:**
```javascript
const cmd = buildCommand(0x89, []);
port.write(cmd);

port.on('data', (data) => {
  const parser = new FrameParser();
  const frames = parser.addData(data);
  
  frames.forEach(frame => {
    if (frame.command === 0xE1) {
      const tags = parseInventoryData(frame.data);
      tags.forEach(tag => {
        console.log('EPC:', tag.epc);
        console.log('RSSI:', tag.rssi, 'dBm');
        console.log('Antena:', tag.antenna);
      });
    }
  });
});
```

---

### 0x8A - Stop Inventory

Detiene la lectura continua de tags.

**Comando:**
```
A5 5A 00 09 8A E1 0D 0A
```

**Sin parámetros.**

**Respuesta:**
```
A5 5A 00 0A 8B 01 00 [CS] 0D 0A
```

```javascript
const cmd = buildCommand(0x8A, []);
```

---

### 0x8C - Set Filter

Configura filtro para lectura selectiva de tags.

**Comando:**
```
A5 5A [LEN] 8C [BANK] [PTR(2)] [CNT(2)] [FILTER_DATA(N)] [CS] 0D 0A
```

**Parámetros:**
- `BANK`: 1 byte - Área de memoria (01=EPC, 02=TID, 03=USER)
- `PTR`: 2 bytes - Posición inicial (en bits)
- `CNT`: 2 bytes - Longitud del filtro (en bits, 0=quitar filtro)
- `FILTER_DATA`: N bytes - Datos del filtro

**Respuesta:**
```
A5 5A 00 0A 8D 01 00 [CS] 0D 0A
```

**Ejemplo (Filtrar tags que empiecen con "E200"):**
```javascript
// Filtrar EPC que empiece con E200 (16 bits)
const bank = 0x01;        // EPC
const ptr = 0x0020;       // Después del PC (32 bits)
const cnt = 0x0010;       // 16 bits
const filterData = Buffer.from([0xE2, 0x00]);

const data = Buffer.concat([
  Buffer.from([bank]),
  Buffer.from([(ptr >> 8) & 0xFF, ptr & 0xFF]),
  Buffer.from([(cnt >> 8) & 0xFF, cnt & 0xFF]),
  filterData
]);

const cmd = buildCommand(0x8C, data);
```

**Ejemplo (Quitar filtro):**
```javascript
const data = Buffer.from([
  0x01,  // EPC
  0x00, 0x00,  // PTR = 0
  0x00, 0x00   // CNT = 0 (sin filtro)
]);

const cmd = buildCommand(0x8C, data);
```

---

### 0x90 - Inventory Single Tag

Lee un solo tag (no modo continuo).

**Comando:**
```
A5 5A 00 09 90 E9 0D 0A
```

**Respuesta:**
```
A5 5A [LEN] 91 01 00 [PC(2)] [EPC(N)] [RSSI(2)] [ANT(1)] [CS] 0D 0A
```

```javascript
const cmd = buildCommand(0x90, []);
```

---

## Comandos de Configuración

### 0x93 - Set Power

Configura la potencia de transmisión de la antena.

**Comando:**
```
A5 5A 00 0A 93 [POWER] [CS] 0D 0A
```

**Parámetros:**
- `POWER`: 1 byte - Potencia en dBm (rango: 5-30, típicamente 5-26)

**Respuesta:**
```
A5 5A 00 0A 94 01 00 [CS] 0D 0A
```

**Ejemplo (Configurar 20 dBm):**
```javascript
const power = 20; // dBm
const cmd = buildCommand(0x93, Buffer.from([power]));
```

**Nota:** La potencia máxima permitida depende de la región:
- **FCC (USA)**: Hasta 30 dBm
- **ETSI (Europa)**: Hasta 27 dBm  
- **China**: Hasta 26 dBm

---

### 0x94 - Get Power

Obtiene la potencia actual de la antena.

**Comando:**
```
A5 5A 00 09 94 ED 0D 0A
```

**Respuesta:**
```
A5 5A 00 0B 95 01 [STATUS] [POWER] [CS] 0D 0A
```

**Parsing:**
```javascript
const cmd = buildCommand(0x94, []);

// Al recibir respuesta (comando 0x95)
if (frame.command === 0x95 && frame.data.length >= 2) {
    const status = frame.data[0];  // 0x00 o 0x01
    const power = frame.data[1];   // Potencia en dBm (1-30)
    
    // Validar rango válido
    if (power >= 1 && power <= 30) {
        console.log(`Potencia actual: ${power} dBm`);
    }
}
```

**⚠️ Nota importante:** Algunos modelos de lectores devuelven valores inválidos (ej: 0xF1 = 241 dBm) cuando:
- El lector no ha sido configurado previamente con `setPower()`
- El modelo no soporta completamente este comando
- El lector necesita reiniciarse después de la configuración inicial

**Solución recomendada:** Si recibes un valor fuera del rango 1-30 dBm, usa la configuración almacenada en `config.js` como fallback:

```javascript
const { obtenerConfiguracionDistancia } = require('./utils');
const config = obtenerConfiguracionDistancia(distanciaMetros);
const potenciaFallback = config.potencia;  // Valor calculado correcto
```

**Comando alternativo (más robusto):** Algunos SDK usan un comando que devuelve información detallada por cada antena (read power + write power), pero su código de comando no está documentado en el protocolo estándar.

---

### 0x95 - Set Frequency Mode

Configura la región de frecuencias.

**Comando:**
```
A5 5A 00 0A 95 [REGION] [CS] 0D 0A
```

**Regiones:**
- `0x01`: FCC (USA, 902-928 MHz, 50 canales)
- `0x02`: ETSI (Europa, 865-868 MHz, 4 canales)
- `0x04`: China (920-925 MHz, 20 canales)
- `0x08`: Taiwan
- `0x16`: Korea
- `0x32`: Japan
- `0x33`: Japan 2
- `0x34`: Indonesia
- `0x36`: Australia
- `0x37`: Brazil

**Respuesta:**
```
A5 5A 00 0A 96 01 00 [CS] 0D 0A
```

```javascript
const region = 0x01; // FCC
const cmd = buildCommand(0x95, Buffer.from([region]));
```

---

### 0x96 - Get Frequency Mode

Obtiene la región configurada.

**Comando:**
```
A5 5A 00 09 96 EF 0D 0A
```

**Respuesta:**
```
A5 5A 00 0B 97 01 00 [REGION] [CS] 0D 0A
```

---

### 0x98 - Set Protocol

Configura el protocolo RFID.

**Comando:**
```
A5 5A 00 0A 98 [PROTOCOL] [CS] 0D 0A
```

**Protocolos:**
- `0x00`: ISO 18000-6B
- `0x01`: EPC Gen2 / ISO 18000-6C

**Respuesta:**
```
A5 5A 00 0A 99 01 00 [CS] 0D 0A
```

```javascript
const protocol = 0x01; // EPC Gen2
const cmd = buildCommand(0x98, Buffer.from([protocol]));
```

---

### 0x9A - Set EPC Mode

Configura el modo de lectura de tags.

**Comandos predefinidos:**

#### Set EPC Only Mode
```
A5 5A 00 09 9A E1 0D 0A
```
Lee solo EPC (más rápido).

#### Set EPC + TID Mode
```
A5 5A 00 09 9B E0 0D 0A
```
Lee EPC y TID (12 bytes).

#### Set EPC + TID + USER Mode
```
A5 5A 00 0D 9C [TID_PTR(2)] [TID_CNT(2)] [USER_PTR(2)] [USER_CNT(2)] [CS] 0D 0A
```

**Ejemplo (EPC + TID + 8 bytes de USER):**
```javascript
const tidPtr = 0x0000;   // Leer TID desde inicio
const tidCnt = 0x0006;   // 6 words = 12 bytes
const userPtr = 0x0000;  // Leer USER desde inicio
const userCnt = 0x0004;  // 4 words = 8 bytes

const data = Buffer.from([
  (tidPtr >> 8) & 0xFF, tidPtr & 0xFF,
  (tidCnt >> 8) & 0xFF, tidCnt & 0xFF,
  (userPtr >> 8) & 0xFF, userPtr & 0xFF,
  (userCnt >> 8) & 0xFF, userCnt & 0xFF
]);

const cmd = buildCommand(0x9C, data);
```

---

### 0xA0 - Set Gen2 Parameters

Configura parámetros avanzados del protocolo Gen2.

**Comando:**
```
A5 5A 00 0E A0 [TARGET] [ACTION] [T] [Q] [SESSION] [CS] 0D 0A
```

**Parámetros:**
- `TARGET`: 0x00=A, 0x01=B
- `ACTION`: 0x00-0x07 (combinación de flags)
- `T`: 0x00=Toggle, 0x01=No Toggle
- `Q`: 0-15 (valor Q para el algoritmo de anti-colisión)
- `SESSION`: 0-3 (sesión del tag)

**Respuesta:**
```
A5 5A 00 0A A1 01 00 [CS] 0D 0A
```

**Valores recomendados:**
- **Q=4**: Para pocos tags (< 10)
- **Q=7**: Para cantidad media (10-50)
- **Q=10**: Para muchos tags (50-100)
- **Q=15**: Para ambientes muy densos (> 100)

```javascript
const target = 0x00;
const action = 0x00;
const t = 0x01;
const q = 7;
const session = 0x00;

const data = Buffer.from([target, action, t, q, session]);
const cmd = buildCommand(0xA0, data);
```

---

## Comandos de Potencia y Antena

### 0x4A - Set Antenna Work Time

Configura el tiempo de trabajo de cada antena (para lectores multi-antena).

**Comando:**
```
A5 5A 00 0C 4A [ANT_ID] [TIME_H] [TIME_L] [CS] 0D 0A
```

**Parámetros:**
- `ANT_ID`: 0x00=Ant1, 0x01=Ant2, 0x02=Ant3, 0x03=Ant4
- `TIME_H`: Byte alto del tiempo (ms)
- `TIME_L`: Byte bajo del tiempo (ms)

**Respuesta:**
```
A5 5A 00 0A 4B 01 00 [CS] 0D 0A
```

```javascript
const antId = 0x00;      // Antena 1
const timeMs = 1000;     // 1 segundo

const data = Buffer.from([
  antId,
  (timeMs >> 8) & 0xFF,
  timeMs & 0xFF
]);

const cmd = buildCommand(0x4A, data);
```

---

### 0x4C - Get Antenna Work Time

Obtiene el tiempo de trabajo configurado.

**Comando:**
```
A5 5A 00 0B 4C [ANT_ID] 00 [CS] 0D 0A
```

**Respuesta:**
```
A5 5A 00 0E 4D 01 [ANT_ID] [TIME_H] [TIME_L] [CS] 0D 0A
```

---

### 0x5D - Set Antenna Power (Multi-antenna)

Configura potencia individual por antena.

**Comando:**
```
A5 5A 00 0B 5D [ANT_ID] [POWER] [CS] 0D 0A
```

```javascript
const antId = 0x00;
const power = 26; // dBm

const data = Buffer.from([antId, power]);
const cmd = buildCommand(0x5D, data);
```

---

## Comandos de Dispositivo

### 0xE4 - Device Commands

Comandos de control del dispositivo (beep, batería, escaneo).

#### Subcomando 01 - Get Battery Level

**Comando:**
```
A5 5A 00 09 E4 01 EC 0D 0A
```

**Respuesta:**
```
A5 5A 00 0B E5 01 [LEVEL] [CS] 0D 0A
```
- `LEVEL`: 0-100 (porcentaje de batería)

---

#### Subcomando 02 - Scan Barcode

**Comando:**
```
A5 5A 00 09 E4 02 EF 0D 0A
```

**Respuesta:**
```
A5 5A [LEN] E5 02 [BARCODE_DATA] [CS] 0D 0A
```

---

#### Subcomando 03 - Beep Control

**Beep ON:**
```
A5 5A 00 0A E4 03 01 EC 0D 0A
```

**Beep OFF:**
```
A5 5A 00 0A E4 03 00 ED 0D 0A
```

**Set Beep Duration:**
```
A5 5A 00 0B E4 03 01 [DURATION] [CS] 0D 0A
```
- `DURATION`: Duración en x10ms (ej: 10 = 100ms)

```javascript
// Beep de 200ms
const duration = 20; // 20 * 10ms = 200ms
const data = Buffer.from([0x03, 0x01, duration]);
const cmd = buildCommand(0xE4, data);
```

---

### 0xA8 - Get Temperature

Obtiene la temperatura del módulo RF.

**Comando:**
```
A5 5A 00 09 A8 F1 0D 0A
```

**Respuesta:**
```
A5 5A 00 0B A9 01 [TEMP] [CS] 0D 0A
```
- `TEMP`: Temperatura en grados Celsius (signed byte, -128 a +127)

```javascript
const cmd = buildCommand(0xA8, []);

// Parser
function parseTemperature(data) {
  const temp = data[2]; // signed byte
  return temp > 127 ? temp - 256 : temp;
}
```

---

## Comandos de Firmware

### 0x87 - Get Version

Obtiene la versión del firmware.

**Comando:**
```
A5 5A 00 09 87 EC 0D 0A
```

**Respuesta:**
```
A5 5A [LEN] 88 01 00 [VERSION_STRING] [CS] 0D 0A
```

```javascript
const cmd = buildCommand(0x87, []);

// Parser
function parseVersion(data) {
  return data.slice(2).toString('ascii');
}
```

---

### 0xAB - Jump to Bootloader

Prepara el dispositivo para actualización de firmware.

**Comando:**
```
A5 5A 00 09 AB F2 0D 0A
```

**Respuesta:**
```
A5 5A 00 0A AC 01 00 [CS] 0D 0A
```

**⚠️ ADVERTENCIA:** Solo usar durante proceso de actualización de firmware oficial.

---

### 0xAC - Start Update

Inicia el proceso de actualización de firmware.

**Comando:**
```
A5 5A 00 09 AC F1 0D 0A
```

---

### 0xAD - Upload Firmware Data

Envía datos del firmware (usado repetidamente).

**Comando:**
```
A5 5A [LEN] AD [FIRMWARE_CHUNK] [CS] 0D 0A
```

**Parámetros:**
- `FIRMWARE_CHUNK`: Hasta 1024 bytes de datos del firmware

---

### 0xAE - Stop Update

Finaliza el proceso de actualización.

**Comando:**
```
A5 5A 00 09 AE F7 0D 0A
```

---

## Comandos GPIO

### 0x50 - Set GPO (General Purpose Output)

Configura las salidas GPIO.

**Comando:**
```
A5 5A 00 0C 50 [GPO_NUM] [STATE] [DURATION] [CS] 0D 0A
```

**Parámetros:**
- `GPO_NUM`: Número de GPO (1-4)
- `STATE`: 0x00=Low, 0x01=High
- `DURATION`: Duración en ms (0=permanente)

**Respuesta:**
```
A5 5A 00 0A 51 01 00 [CS] 0D 0A
```

```javascript
const gpoNum = 1;
const state = 0x01;    // High
const duration = 100;  // 100ms

const data = Buffer.from([gpoNum, state, duration]);
const cmd = buildCommand(0x50, data);
```

---

### 0x52 - Get GPI (General Purpose Input)

Lee el estado de las entradas GPIO.

**Comando:**
```
A5 5A 00 09 52 FB 0D 0A
```

**Respuesta:**
```
A5 5A [LEN] 53 01 [COUNT] [GPI_STATES...] [CS] 0D 0A
```

**Formato de GPI_STATE (por cada GPI):**
- `GPI_NUM`: 1 byte
- `STATE`: 1 byte (0x00=Low, 0x01=High)

```javascript
const cmd = buildCommand(0x52, []);

// Parser
function parseGpiStates(data) {
  const count = data[2];
  const states = [];
  
  for (let i = 0; i < count; i++) {
    states.push({
      gpi: data[3 + i * 2],
      state: data[4 + i * 2] === 0x01
    });
  }
  
  return states;
}
```

---

## Comandos de Red

### 0x5A - Set IP and Port

Configura la IP y puerto del lector (para modo TCP/IP).

**Comando:**
```
A5 5A 00 12 5A [IP1] [IP2] [IP3] [IP4] [PORT_H] [PORT_L] [MASK1] [MASK2] [MASK3] [MASK4] [CS] 0D 0A
```

**Parámetros:**
- `IP1-IP4`: 4 bytes de dirección IP
- `PORT_H, PORT_L`: Puerto (Big-Endian)
- `MASK1-MASK4`: Máscara de red

**Respuesta:**
```
A5 5A 00 0A 5B 01 00 [CS] 0D 0A
```

```javascript
const ip = [192, 168, 1, 100];
const port = 6000;
const mask = [255, 255, 255, 0];

const data = Buffer.from([
  ...ip,
  (port >> 8) & 0xFF,
  port & 0xFF,
  ...mask
]);

const cmd = buildCommand(0x5A, data);
```

---

### 0x5C - Get IP and Port

Obtiene la configuración de red actual.

**Comando:**
```
A5 5A 00 09 5C F5 0D 0A
```

**Respuesta:**
```
A5 5A 00 14 5D 01 [IP1-4] [PORT_H] [PORT_L] [MASK1-4] [CS] 0D 0A
```

---

### 0x60 - Set Work Mode

Configura el modo de trabajo del lector.

**Comando:**
```
A5 5A 00 0A 60 [MODE] [CS] 0D 0A
```

**Modos:**
- `0x00`: Command Mode (responde a comandos)
- `0x01`: Answer Mode (auto-responde cuando detecta tags)
- `0x02`: Trigger Mode (disparo por GPI)

**Respuesta:**
```
A5 5A 00 0A 61 01 00 [CS] 0D 0A
```

```javascript
const mode = 0x00; // Command Mode
const cmd = buildCommand(0x60, Buffer.from([mode]));
```

---

### 0x62 - Get Work Mode

Obtiene el modo de trabajo actual.

**Comando:**
```
A5 5A 00 09 62 FB 0D 0A
```

**Respuesta:**
```
A5 5A 00 0B 63 01 [MODE] [CS] 0D 0A
```

---

### 0x64 - Reset Reader

Reinicia el lector por software.

**Comando:**
```
A5 5A 00 09 64 FD 0D 0A
```

**Sin respuesta** (el lector se reinicia inmediatamente).

```javascript
const cmd = buildCommand(0x64, []);
// Esperar ~3 segundos después del reset
```

---

## Resumen de Comandos por Categoría

### Tags
| CMD | Función |
|-----|---------|
| 0x86 | Read/Write Tag Data |
| 0x84 | Lock Memory |
| 0x85 | Kill Tag |
| 0x90 | Inventory Single Tag |

### Inventario
| CMD | Función |
|-----|---------|
| 0x89 | Start Inventory |
| 0x8A | Stop Inventory |
| 0x8C | Set Filter |

### Configuración
| CMD | Función |
|-----|---------|
| 0x93 | Set Power |
| 0x94 | Get Power |
| 0x95 | Set Frequency Mode |
| 0x96 | Get Frequency Mode |
| 0x98 | Set Protocol |
| 0x9A | Set EPC Mode |
| 0x9B | Set EPC+TID Mode |
| 0x9C | Set EPC+TID+USER Mode |
| 0xA0 | Set Gen2 Parameters |

### Antena
| CMD | Función |
|-----|---------|
| 0x4A | Set Antenna Work Time |
| 0x4C | Get Antenna Work Time |
| 0x5D | Set Antenna Power |

### Dispositivo
| CMD | Función |
|-----|---------|
| 0x87 | Get Version |
| 0xA8 | Get Temperature |
| 0xE4 | Device Commands (Beep/Battery/Barcode) |

### GPIO
| CMD | Función |
|-----|---------|
| 0x50 | Set GPO |
| 0x52 | Get GPI |

### Red
| CMD | Función |
|-----|---------|
| 0x5A | Set IP and Port |
| 0x5C | Get IP and Port |
| 0x60 | Set Work Mode |
| 0x62 | Get Work Mode |
| 0x64 | Reset Reader |

### Firmware
| CMD | Función |
|-----|---------|
| 0xAB | Jump to Bootloader |
| 0xAC | Start Update |
| 0xAD | Upload Firmware Data |
| 0xAE | Stop Update |

---

## Códigos de Error Comunes

| Código | Descripción | Solución |
|--------|-------------|----------|
| 0x00 | Éxito | - |
| 0x01 | Tag no encontrado | Acercar tag o aumentar potencia |
| 0x02 | Error de lectura | Reintentar, verificar interferencias |
| 0x03 | Error de escritura | Verificar password, tag no bloqueado |
| 0x04 | Parámetros inválidos | Revisar formato de datos |
| 0x05 | Acceso denegado | Password incorrecto |
| 0x10 | Tag bloqueado | Tag en modo Lock, no se puede escribir |
| 0x15 | Comando no soportado | Verificar firmware, usar comando correcto |

---

**Ver también:**
- [PROTOCOL.md](PROTOCOL.md) - Detalles del formato de trama
- [example-nodejs.js](example-nodejs.js) - Código de ejemplo
