// Diagnóstico RNF-06: flujo real de texto hasta recepción TCP en loopback.
// No se incluye en npm test: no hay aserciones de tiempo dependientes de la carga del equipo.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const raiz = path.resolve(__dirname, '..');
const ts = require(require.resolve('typescript', { paths: [path.join(raiz, 'frontend')] }));
assert.equal(typeof ts.transpileModule, 'function', 'Instala las dependencias de frontend para ejecutar el diagnóstico.');
const fuenteFrontend = path.join(raiz, 'frontend', 'src') + path.sep;
const cargarTypeScriptOriginal = require.extensions['.ts'];
require.extensions['.ts'] = (modulo, archivo) => {
  if (!archivo.startsWith(fuenteFrontend)) {
    if (cargarTypeScriptOriginal) return cargarTypeScriptOriginal(modulo, archivo);
    throw new Error(`Módulo TypeScript fuera del frontend: ${archivo}`);
  }
  const codigo = fs.readFileSync(archivo, 'utf8');
  const compilado = ts.transpileModule(codigo, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  modulo._compile(compilado, archivo);
};

const { TraductorLuces } = require('../frontend/src/diccionario/TraductorLuces.ts');
const { bloqueoDeSeguridadCompuesto } = require('../frontend/src/seguridadComandos.ts');
const { esComandoLucesValido } = require('../dist/interfaces/ComandoLuces.js');
const { ConstructorComandosMA2 } = require('../dist/servicios/ConstructorComandosMA2.js');
const { ClienteTelnetMA2 } = require('../dist/red/ClienteTelnetMA2.js');

const CALENTAMIENTO_POR_CASO = 10;
const MUESTRAS_POR_CASO = 50;
const CASOS = [
  { texto: 'Frontales al 50%', esperado: 'Group 1 At 50' },
  { texto: 'Contraluz en azul', esperado: 'Group 2 At Preset 4.7' },
  { texto: 'siguiente escena', esperado: 'Go Executor 1' },
  { texto: 'ir a escena 3', esperado: 'Goto Cue 3 Executor 1' },
];

function crearServidorSimulado() {
  const sockets = new Set();
  const pendientes = [];
  let comandosRecibidos = 0;
  let loginsRecibidos = 0;
  const servidor = net.createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.write('login:\r\n');
    let buffer = '';
    socket.on('data', (datos) => {
      buffer += datos.toString('utf8');
      let salto;
      while ((salto = buffer.indexOf('\n')) !== -1) {
        const linea = buffer.slice(0, salto).trim();
        buffer = buffer.slice(salto + 1);
        if (linea.startsWith('login ')) {
          loginsRecibidos += 1;
          socket.write('logged in as user qa\r\n');
          continue;
        }
        comandosRecibidos += 1;
        const pendiente = pendientes.shift();
        if (pendiente) pendiente({ linea, instante: performance.now() });
        else socket.destroy(new Error(`Comando inesperado: ${linea}`));
      }
    });
  });

  return {
    async iniciar() {
      await new Promise((resolver, rechazar) => {
        servidor.once('error', rechazar);
        servidor.listen(0, '127.0.0.1', resolver);
      });
      return servidor.address().port;
    },
    recibir() {
      return new Promise((resolver, rechazar) => {
        let resolverPendiente;
        const temporizador = setTimeout(() => {
          const indice = pendientes.indexOf(resolverPendiente);
          if (indice !== -1) pendientes.splice(indice, 1);
          rechazar(new Error('Tiempo agotado esperando la línea Telnet en loopback.'));
        }, 3000);
        resolverPendiente = (resultado) => {
          clearTimeout(temporizador);
          resolver(resultado);
        };
        pendientes.push(resolverPendiente);
      });
    },
    get comandosRecibidos() { return comandosRecibidos; },
    get loginsRecibidos() { return loginsRecibidos; },
    async cerrar() {
      for (const socket of sockets) socket.destroy();
      await new Promise((resolver) => servidor.close(resolver));
    },
  };
}

async function esperarAutenticacion(cliente) {
  const limite = performance.now() + 3000;
  while (cliente.obtenerEstado() !== 'AUTENTICADO') {
    if (performance.now() > limite) throw new Error('No se autenticó la sesión Telnet simulada.');
    await new Promise((resolver) => setTimeout(resolver, 5));
  }
}

async function medirCaso(caso, cliente, constructorComandos, servidor) {
  // Registrar la espera antes de iniciar el cronómetro evita perder una recepción rápida.
  const recepcion = servidor.recibir();
  const inicio = performance.now();
  const interpretacion = TraductorLuces.interpretarOrden(caso.texto);
  const finTraduccion = performance.now();
  if (!interpretacion.exito || interpretacion.comandosPayload.length !== 1) {
    throw new Error(`Traducción inválida para ${caso.texto}: ${interpretacion.mensajeError}`);
  }

  const bloqueo = bloqueoDeSeguridadCompuesto(
    interpretacion.comandosPayload,
    interpretacion.textoOriginal
  );
  const finValidacionFrontend = performance.now();
  if (bloqueo !== null) throw new Error(`Validación frontend: ${bloqueo}`);

  const payload = interpretacion.comandosPayload[0];
  const payloadValido = esComandoLucesValido(payload);
  const finValidacionBackend = performance.now();
  if (!payloadValido) throw new Error(`Payload rechazado por backend: ${caso.texto}`);

  const comando = constructorComandos.construirComando(payload);
  const finConstruccion = performance.now();
  const envio = cliente.enviarComando(comando);
  const [enviado, recibido] = await Promise.all([envio, recepcion]);
  assert.equal(enviado, true, `Fallo de escritura Telnet para ${caso.texto}`);
  assert.equal(comando.trim(), caso.esperado, `Comando construido para ${caso.texto}`);
  assert.equal(recibido.linea, caso.esperado, `Comando recibido para ${caso.texto}`);

  const traduccion = finTraduccion - inicio;
  const validacionFrontend = finValidacionFrontend - finTraduccion;
  const validacionBackend = finValidacionBackend - finValidacionFrontend;
  const construccion = finConstruccion - finValidacionBackend;
  const procesamiento = finConstruccion - inicio;
  const telnetLoopback = recibido.instante - finConstruccion;
  const total = recibido.instante - inicio;
  assert.ok([traduccion, validacionFrontend, validacionBackend, construccion, procesamiento, telnetLoopback, total]
    .every((valor) => Number.isFinite(valor) && valor >= 0), 'Tiempos no válidos.');
  return { traduccion, validacionFrontend, validacionBackend, construccion, procesamiento, telnetLoopback, total };
}

function percentilOrdenado(ordenados, fraccion) {
  return ordenados[Math.max(0, Math.ceil(ordenados.length * fraccion) - 1)];
}

function estadisticas(valores) {
  assert.ok(valores.length > 0);
  const ordenados = [...valores].sort((a, b) => a - b);
  const mitad = Math.floor(ordenados.length / 2);
  const mediana = ordenados.length % 2 === 0
    ? (ordenados[mitad - 1] + ordenados[mitad]) / 2
    : ordenados[mitad];
  const q1 = percentilOrdenado(ordenados, 0.25);
  const q3 = percentilOrdenado(ordenados, 0.75);
  const limiteAtipico = q3 + 1.5 * (q3 - q1);
  return {
    n: ordenados.length,
    min: ordenados[0],
    promedio: valores.reduce((suma, valor) => suma + valor, 0) / valores.length,
    mediana,
    p95: percentilOrdenado(ordenados, 0.95),
    max: ordenados.at(-1),
    atipicos: valores.filter((valor) => valor > limiteAtipico).length,
    limiteAtipico,
  };
}

function mostrarEstadisticas(nombre, valores) {
  const s = estadisticas(valores);
  const fmt = (valor) => valor.toFixed(3);
  console.log(`${nombre.padEnd(23)} n=${s.n} min=${fmt(s.min)} promedio=${fmt(s.promedio)} ` +
    `mediana=${fmt(s.mediana)} p95=${fmt(s.p95)} max=${fmt(s.max)} ms ` +
    `atípicos=${s.atipicos} (umbral>${fmt(s.limiteAtipico)} ms)`);
  return s;
}

async function principal() {
  TraductorLuces.restablecerCatalogoPorDefecto();
  const servidor = crearServidorSimulado();
  const puerto = await servidor.iniciar();
  const constructorComandos = new ConstructorComandosMA2();
  const cliente = new ClienteTelnetMA2(constructorComandos, {
    host: '127.0.0.1', puerto, usuario: 'qa', contrasena: 'solo-loopback',
  });
  const muestras = [];
  const porCaso = new Map(CASOS.map((caso) => [caso.texto, []]));
  try {
    cliente.conectar();
    await esperarAutenticacion(cliente);
    for (let vuelta = 0; vuelta < CALENTAMIENTO_POR_CASO + MUESTRAS_POR_CASO; vuelta += 1) {
      for (const caso of CASOS) {
        const muestra = await medirCaso(caso, cliente, constructorComandos, servidor);
        if (vuelta >= CALENTAMIENTO_POR_CASO) {
          muestras.push(muestra);
          porCaso.get(caso.texto).push(muestra.total);
        }
      }
    }
    assert.equal(servidor.loginsRecibidos, 1, 'La autenticación no debe repetirse durante la medición.');
    assert.equal(
      servidor.comandosRecibidos,
      CASOS.length * (CALENTAMIENTO_POR_CASO + MUESTRAS_POR_CASO),
      'El servidor debe recibir exactamente los comandos de calentamiento y medición.'
    );

    console.log(`ENTORNO fecha=${new Date().toISOString()} node=${process.version} ` +
      `sistema=${process.platform}/${process.arch} cpu=${JSON.stringify(os.cpus()[0]?.model ?? 'desconocida')} ` +
      `nucleos_logicos=${os.cpus().length} destino=127.0.0.1:${puerto} conexion=autenticada`);
    console.log(`METODO calentamiento=${CALENTAMIENTO_POR_CASO} por caso; ` +
      `mediciones=${MUESTRAS_POR_CASO} por caso; total=${muestras.length}; ` +
      'secuencial; p95=nearest-rank; atípicos=Tukey 1.5 IQR; ninguna muestra excluida.');
    const etapas = [
      ['Traducción', 'traduccion'],
      ['Validación frontend', 'validacionFrontend'],
      ['Validación backend', 'validacionBackend'],
      ['Construcción MA2', 'construccion'],
      ['A Procesamiento', 'procesamiento'],
      ['B Telnet loopback', 'telnetLoopback'],
      ['C Total local', 'total'],
    ];
    const resultados = new Map();
    for (const [nombre, clave] of etapas) {
      resultados.set(clave, mostrarEstadisticas(nombre, muestras.map((muestra) => muestra[clave])));
    }
    for (const caso of CASOS) mostrarEstadisticas(`Caso ${caso.texto}`, porCaso.get(caso.texto));
    const p95 = resultados.get('total').p95;
    console.log(`META_LOCAL p95_total=${p95.toFixed(3)} ms; objetivo=<100 ms; ` +
      `resultado=${p95 < 100 ? 'CUMPLE' : 'NO_CUMPLE'}; ` +
      'grandMA2/IPC/Electron excluidos.');
  } finally {
    cliente.desconectar();
    await servidor.cerrar();
  }
}

principal().catch((error) => { console.error(error); process.exitCode = 1; });
