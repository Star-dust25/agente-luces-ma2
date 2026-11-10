const net = require('net');
const readline = require('readline');

// Al usar grandMA2 onPC en la misma computadora, la IP es localhost
const MA2_IP = '127.0.0.1'; 
const MA2_PORT = 30000; 

const client = new net.Socket();

// Interfaz para leer lo que escriben en la terminal
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Diccionario de traducción básico (Español cotidiano -> Sintaxis MA2)
const diccionario = {
    "encender frontales": "Group 1 At 100",
    "apagar frontales": "Group 1 At 0",
    "siguiente escena": "Go Executor 1",
    "apagon": "Group 1 thru 10 At 0"
};

client.connect(MA2_PORT, MA2_IP, () => {
    console.log(`\nConectado a grandMA2 onPC por cable virtual (${MA2_IP}:${MA2_PORT})`);
    
    // grandMA2 por Telnet suele requerir hacer login primero
    // El usuario por defecto en onPC suele ser 'administrator' y la contraseña 'admin'
    client.write('login administrator admin\r\n');
    
    iniciarConsola();
});

client.on('error', (err) => {
    console.error('\nError de conexión. Verifica que Telnet esté activado en Global Settings de MA2.', err.message);
    process.exit(1);
});

function iniciarConsola() {
    rl.question('\nEscribe un comando (ej. "encender frontales"): ', (respuesta) => {
        let comandoNormalizado = respuesta.toLowerCase().trim();
        
        // Buscar en el diccionario
        let comandoMA2 = diccionario[comandoNormalizado];

        if (comandoMA2) {
            console.log(`-> Traducido a MA2: ${comandoMA2}`);
            client.write(comandoMA2 + '\r\n');
        } else {
            console.log('-> Comando no reconocido en el diccionario.');
        }
        
        // Volver a preguntar recursivamente
        iniciarConsola();
    });
}