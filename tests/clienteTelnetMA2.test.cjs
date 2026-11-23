const assert = require('node:assert/strict');
const net = require('node:net');
const { ClienteTelnetMA2 } = require('../dist/red/ClienteTelnetMA2.js');
const { ConstructorComandosMA2 } = require('../dist/servicios/ConstructorComandosMA2.js');

async function esperar(predicado, descripcion, limiteMs = 3000) {
  const fin = Date.now() + limiteMs;
  while (!predicado()) {
    if (Date.now() > fin) throw new Error(`Tiempo agotado: ${descripcion}`);
    await new Promise((resolver) => setTimeout(resolver, 10));
  }
}

async function crearConsolaSimulada(autenticar = true) {
  const lineas = [];
  const sockets = new Set();
  let conexiones = 0;
  const servidor = net.createServer((socket) => {
    conexiones += 1;
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    let pendiente = '';
    socket.write('login:\r\n');
    socket.on('data', (datos) => {
      pendiente += datos.toString();
      let indice;
      while ((indice = pendiente.indexOf('\n')) !== -1) {
        const linea = pendiente.slice(0, indice).trim();
        pendiente = pendiente.slice(indice + 1);
        lineas.push(linea);
        if (autenticar && linea.startsWith('login ')) socket.write('logged in as user qa\r\n');
      }
    });
  });
  await new Promise((resolver) => servidor.listen(0, '127.0.0.1', resolver));
  return {
    puerto: servidor.address().port,
    lineas,
    sockets,
    get conexiones() { return conexiones; },
    async cerrar() {
      for (const socket of sockets) socket.destroy();
      await new Promise((resolver) => servidor.close(resolver));
    },
  };
}

async function probar() {
  const consola1 = await crearConsolaSimulada();
  const consola2 = await crearConsolaSimulada();
  const constructor = new ConstructorComandosMA2();
  const cliente = new ClienteTelnetMA2(constructor, {
    host: '127.0.0.1', puerto: consola1.puerto, usuario: 'qa', contrasena: 'prueba',
    retrasoBaseReconexionMs: 25, retrasoMaximoReconexionMs: 50,
  });
  const estados = [];
  cliente.registrarObservadorEstado((estado) => estados.push(estado));
  try {
    cliente.conectar();
    await esperar(() => cliente.obtenerEstado() === 'AUTENTICADO', 'autenticación simulada');
    assert.equal(consola1.lineas[0], 'login qa prueba');

    const comandosCue = [
      { accion: 'anterior', grupo: '7', executor: '7', valor: '', tipo: 'cue' },
      { accion: 'siguiente', grupo: '7', executor: '7', valor: '', tipo: 'cue' },
      { accion: 'ir_cue', grupo: '7', executor: '7', valor: '3', tipo: 'cue' },
      { accion: 'detener', grupo: '7', executor: '7', valor: '', tipo: 'cue' },
    ];
    for (const comando of comandosCue) {
      assert.equal(await cliente.enviarComando(constructor.construirComando(comando)), true);
    }
    await esperar(() => consola1.lineas.length === 5, 'cuatro comandos de escena');
    assert.deepEqual(consola1.lineas.slice(1), [
      'GoBack Executor 7', 'Go Executor 7', 'Goto Cue 3 Executor 7', 'Off Executor 7',
    ]);
    assert.equal(await cliente.enviarComando(''), false);

    cliente.actualizarConfiguracionConexion({ puerto: consola2.puerto, usuario: 'qa2' });
    await esperar(() => cliente.obtenerEstado() === 'AUTENTICADO' && consola2.lineas.length > 0, 'reconexión por cambio de configuración');
    assert.equal(consola2.lineas[0], 'login qa2 prueba');
    assert.equal(await cliente.enviarComando('Go Executor 8'), true);
    await esperar(() => consola2.lineas.includes('Go Executor 8'), 'comando tras reconectar');
    assert.equal(consola1.lineas.length, 5);

    for (const socket of consola2.sockets) socket.destroy();
    await esperar(() => estados.includes('RECONECTANDO'), 'estado de reconexión');
    await esperar(() => consola2.conexiones >= 2 && cliente.obtenerEstado() === 'AUTENTICADO', 'reconexión automática');
    assert.ok(estados.includes('CONECTADO'));
  } finally {
    cliente.desconectar();
    await consola1.cerrar();
    await consola2.cerrar();
  }

  const sinAutenticar = await crearConsolaSimulada(false);
  const nuevoDestino = await crearConsolaSimulada();
  const clienteEnCola = new ClienteTelnetMA2(constructor, {
    host: '127.0.0.1', puerto: sinAutenticar.puerto,
    usuario: 'qa', contrasena: 'prueba',
    retrasoBaseReconexionMs: 50, retrasoMaximoReconexionMs: 50,
  });
  try {
    clienteEnCola.conectar();
    await esperar(() => clienteEnCola.obtenerEstado() === 'CONECTADO', 'socket sin autenticar');
    const pendiente = clienteEnCola.enviarComando('Off Executor 1');
    for (const socket of sinAutenticar.sockets) socket.destroy();
    assert.equal(await pendiente, false);
    assert.equal(sinAutenticar.lineas.includes('Off Executor 1'), false);

    const pendienteCambio = clienteEnCola.enviarComando('Off Executor 2');
    clienteEnCola.actualizarConfiguracionConexion({ puerto: nuevoDestino.puerto });
    assert.equal(await pendienteCambio, false);
    await esperar(() => clienteEnCola.obtenerEstado() === 'AUTENTICADO', 'nuevo destino autenticado');
    assert.equal(nuevoDestino.lineas.includes('Off Executor 2'), false);

    // Un cambio no crítico (sin alterar host, puerto, usuario ni contraseña) no debe vaciar cola ni reconectar estando sin autenticar.
    for (const socket of nuevoDestino.sockets) socket.destroy();
    await esperar(() => clienteEnCola.obtenerEstado() !== 'AUTENTICADO', 'pérdida de sesión controlada');
    const conexionesPrevias = nuevoDestino.conexiones;
    const pendienteNoCritico = clienteEnCola.enviarComando('Go Executor 9');
    clienteEnCola.actualizarConfiguracionConexion({ host: '127.0.0.1', puerto: nuevoDestino.puerto, usuario: 'qa', contrasena: 'prueba' });
    await esperar(() => clienteEnCola.obtenerEstado() === 'AUTENTICADO' && nuevoDestino.lineas.includes('Go Executor 9'), 'cola preservada ante cambio no crítico');
    assert.equal(await pendienteNoCritico, true);
    assert.ok(nuevoDestino.conexiones >= conexionesPrevias);
  } finally {
    clienteEnCola.desconectar();
    await sinAutenticar.cerrar();
    await nuevoDestino.cerrar();
  }
  console.log('Integración Telnet simulada: correcta.');
}

probar().catch((error) => { console.error(error); process.exitCode = 1; });
