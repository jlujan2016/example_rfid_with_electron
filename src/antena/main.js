// main.js - Lector RFID UHF en modo auto (inventory continuo) por red TCP/IP

const net = require('net');
const http = require('http');
const socketIo = require('socket.io');

// Importar módulos refactorizados
const config = require('./config');
const { FrameParser, Parsers } = require('./nodejs-uhf-commands/protocol-builder');
const { Commands } = require('./nodejs-uhf-commands/commands');
const { obtenerConfiguracionDistancia } = require('./nodejs-uhf-commands/utils');

// Obtener configuración según la distancia en metros
const configDistancia = obtenerConfiguracionDistancia(config.lector.distanciaMetros);

// --- Servidor HTTP/Socket.IO ---
const app = http.createServer();
const io = socketIo(app);

app.listen(config.servidor.puerto, () => {
    console.log(`Servidor Node.js escuchando en http://localhost:${config.servidor.puerto}`);
    console.log(`PC configurado en: 192.168.99.101`);
    console.log(`Intentando conectar al lector RFID en ${config.lector.ip}:${config.lector.puerto}...`);
});

// --- Conexión TCP/IP al lector ---
const readerClient = new net.Socket();
const parser = new FrameParser();

// Cache para control de duplicados
const tagCache = new Map();
// Contador de lecturas por tag
const tagCounter = new Map();

readerClient.connect(config.lector.puerto, config.lector.ip, () => {
    console.log(`✓ Conectado al lector RFID en ${config.lector.ip}:${config.lector.puerto}\n`);
    
    console.log('📡 Configurando lector...\n');
    console.log(`   Distancia configurada: ${configDistancia.distanciaReal} metros`);
    console.log(`   ${configDistancia.descripcion}\n`);
    
    // 1. Configurar potencia
    setTimeout(() => {
        console.log(`1. Configurando potencia a ${configDistancia.potencia} dBm...`);
        const setPowerCmd = Commands.setPower(configDistancia.potencia);
        console.log('   Trama:', setPowerCmd.toString('hex').toUpperCase());
        readerClient.write(setPowerCmd);
    }, 500);
    
    // 2. Activar beeper
    setTimeout(() => {
        console.log('\n2. Activando beeper...');
        const beepCmd = Commands.beep(config.lector.beeper.habilitado, config.lector.beeper.duracion);
        console.log('   Trama:', beepCmd.toString('hex').toUpperCase());
        readerClient.write(beepCmd);
    }, 1000);
    
    // 3. Desactivar filtros (para leer todos los tags)
    setTimeout(() => {
        console.log('\n3. Desactivando filtros EPC...');
        const clearFilterCmd = Commands.setFilter('EPC', 0, 0, '');
        console.log('   Trama:', clearFilterCmd.toString('hex').toUpperCase());
        readerClient.write(clearFilterCmd);
    }, 1500);
    
    // 4. Iniciar inventory continuo con comando UR4 SDK (0x82)
    setTimeout(() => {
        console.log('\n4. Iniciando lectura continua (Start Inventory UR4)...');
        const startInventoryCmd = Commands.startInventoryUR4();
        console.log('   Trama:', startInventoryCmd.toString('hex').toUpperCase());
        readerClient.write(startInventoryCmd);
        console.log('\n✓ Configuración completa - el lector enviará tags automáticamente...');
        console.log('━'.repeat(60) + '\n');
    }, 2000);
});

readerClient.on('data', (data) => {
    const frames = parser.addData(data);
    
    frames.forEach(frame => {
        // 0x83 = Respuesta de Continuous Inventory (comando UR4 SDK)
        if (frame.command === 0x83) {
            const tag = Parsers.parseTagFromUR4Response(frame.data);
            
            if (tag && !Parsers.isDuplicate(tag.epc, tagCache, config.tags.umbralDuplicados)) {
                // Incrementar contador
                const count = (tagCounter.get(tag.epc) || 0) + 1;
                tagCounter.set(tag.epc, count);
                
                console.log(`\n┌─ TAG DETECTADO ────────────────────────`);
                console.log(`│ EPC    : ${tag.epc}`);
                console.log(`│ PC     : ${tag.pc}`);
                console.log(`│ RSSI   : ${tag.rssi} dBm`);
                console.log(`│ Antena : ${tag.antenna}`);
                console.log(`│ Lecturas: ${count}`);
                console.log(`│ Tiempo : ${new Date().toLocaleTimeString()}`);
                console.log('└────────────────────────────────────────\n');
                
                // Emitir por WebSocket
                io.emit('rfid-tag', { ...tag, count });
            }
        } else {
            // DEBUG: Solo mostrar comandos que NO sean 0x83 (para evitar spam)
            console.log(`[DEBUG] Comando: 0x${frame.command.toString(16).toUpperCase().padStart(2, '0')} | Length: ${frame.data.length} | Data: ${frame.data.toString('hex').toUpperCase()}`);
        }
    });
});

readerClient.on('close', () => {
    console.log('\n✗ Conexión con el lector RFID cerrada.');
});

readerClient.on('error', (err) => {
    console.error('\n✗ Error de conexión con el lector RFID:', err.message);
    console.error('Verifica que:');
    console.error('  - La antena esté encendida');
    console.error(`  - La IP de la antena sea correcta: ${config.lector.ip}`);
    console.error(`  - El puerto sea correcto: ${config.lector.puerto}`);
    console.error('  - Tu PC esté en la misma red: 192.168.99.x');
});

io.on('connection', (socket) => {
    console.log('✓ Cliente web conectado mediante WebSocket.');
    
    socket.on('disconnect', () => {
        console.log('✗ Cliente web desconectado.');
    });
});

// Manejo de cierre graceful
process.on('SIGINT', () => {
    console.log('\n\nCerrando aplicación...');
    
    // Detener inventory antes de cerrar
    const stopInventoryCmd = Commands.stopInventoryUR4(); // 0x8C
    readerClient.write(stopInventoryCmd, () => {
        console.log('Inventory detenido.');
        readerClient.end();
        process.exit(0);
    });
});
