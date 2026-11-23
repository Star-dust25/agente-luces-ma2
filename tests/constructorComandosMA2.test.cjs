const assert = require('node:assert/strict');
const { ConstructorComandosMA2 } = require('../dist/servicios/ConstructorComandosMA2.js');
const { esComandoLucesValido } = require('../dist/interfaces/ComandoLuces.js');

const constructor = new ConstructorComandosMA2();

console.log('Iniciando pruebas unitarias del backend (ConstructorComandosMA2 y Type Guards):');

// 1. Intensidades (RF-04): encender, ajustar y apagar forzado a 0
assert.equal(
  constructor.construirComando({
    accion: 'encender',
    grupo: '1',
    valor: '50',
    tipo: 'intensidad',
  }),
  'Group 1 At 50\r\n'
);

assert.equal(
  constructor.construirComando({
    accion: 'ajustar',
    grupo: '1 thru 6',
    valor: '75.5',
    tipo: 'intensidad',
  }),
  'Group 1 thru 6 At 75.5\r\n'
);

assert.equal(
  constructor.construirComando({
    accion: 'apagar',
    grupo: '1 thru 6',
    valor: '80',
    tipo: 'intensidad',
  }),
  'Group 1 thru 6 At 0\r\n'
);

// 2. Colores y presets Pool 4 (RF-05)
for (let i = 1; i <= 9; i += 1) {
  assert.equal(
    constructor.construirComando({
      accion: 'color',
      grupo: '2',
      valor: `4.${i}`,
      tipo: 'color',
    }),
    `Group 2 At Preset 4.${i}\r\n`
  );
}

// Normalización cuando el preset llega sin prefijo '4.'
assert.equal(
  constructor.construirComando({
    accion: 'color',
    grupo: '4',
    valor: '3',
    tipo: 'color',
  }),
  'Group 4 At Preset 4.3\r\n'
);

// 3. Construcción segura de comando de Login
assert.equal(
  constructor.construirComandoLogin('administrator', 'admin'),
  'login administrator admin\r\n'
);

// 4. Rechazo de inyecciones y valores fuera de rango
assert.throws(
  () =>
    constructor.construirComando({
      accion: 'encender',
      grupo: '1\r\nOff Executor 1',
      valor: '50',
      tipo: 'intensidad',
    }),
  /no es válido/
);

assert.throws(
  () =>
    constructor.construirComando({
      accion: 'ajustar',
      grupo: '1',
      valor: '120',
      tipo: 'intensidad',
    }),
  /fuera del rango permitido/
);

assert.throws(
  () =>
    constructor.construirComando({
      accion: 'color',
      grupo: '1',
      valor: '5.1',
      tipo: 'color',
    }),
  /preset de color/i
);

assert.throws(
  () => constructor.construirComandoLogin('admin\r\n', '1234'),
  /formato inválido/
);

assert.throws(
  () => constructor.construirComandoLogin('admin\r\nOff 1', '1234'),
  /formato inválido/
);

// 5. Type Guard esComandoLucesValido
assert.equal(
  esComandoLucesValido({ accion: 'encender', grupo: '1', valor: '50', tipo: 'intensidad' }),
  true
);
assert.equal(
  esComandoLucesValido({ accion: 'color', grupo: '2', valor: '4.2', tipo: 'color' }),
  true
);
assert.equal(
  esComandoLucesValido({ accion: 'encender', grupo: '1; Off 2', valor: '50', tipo: 'intensidad' }),
  false
);
assert.equal(
  esComandoLucesValido({ accion: 'encender', grupo: '1', valor: '150', tipo: 'intensidad' }),
  false
);
assert.equal(esComandoLucesValido(null), false);

// 6. Control de Cues / Escenas (RF-07) y validación estricta de executor/cue
assert.equal(
  constructor.construirComando({
    accion: 'siguiente',
    grupo: '1',
    executor: '1',
    valor: '',
    tipo: 'cue',
  }),
  'Go Executor 1\r\n'
);
assert.equal(
  constructor.construirComando({
    accion: 'anterior',
    grupo: '2',
    executor: '2',
    valor: '',
    tipo: 'cue',
  }),
  'GoBack Executor 2\r\n'
);
assert.equal(
  constructor.construirComando({
    accion: 'ir_cue',
    grupo: '3',
    executor: '3',
    valor: '2.5',
    tipo: 'cue',
  }),
  'Goto Cue 2.5 Executor 3\r\n'
);
assert.equal(
  constructor.construirComando({
    accion: 'detener',
    grupo: '4',
    executor: '4',
    valor: '',
    tipo: 'cue',
  }),
  'Off Executor 4\r\n'
);

assert.throws(
  () =>
    constructor.construirComando({
      accion: 'ir_cue',
      grupo: '1',
      executor: '1',
      valor: '0',
      tipo: 'cue',
    }),
  /número de cue/i
);
assert.throws(
  () =>
    constructor.construirComando({
      accion: 'siguiente',
      grupo: '1; Off 2',
      executor: '1; Off 2',
      valor: '',
      tipo: 'cue',
    }),
  /no es válido/i
);
assert.throws(
  () =>
    constructor.construirComando({
      accion: 'siguiente',
      grupo: '1\r\nOff 2',
      executor: '1\r\nOff 2',
      valor: '',
      tipo: 'cue',
    }),
  /caracteres de control/i
);

assert.equal(
  esComandoLucesValido({
    accion: 'ir_cue',
    grupo: '1',
    executor: '1',
    valor: '3.25',
    tipo: 'cue',
  }),
  true
);
assert.equal(
  esComandoLucesValido({
    accion: 'ir_cue',
    grupo: '1',
    executor: '1',
    valor: '0',
    tipo: 'cue',
  }),
  false
);
assert.equal(
  esComandoLucesValido({
    accion: 'siguiente',
    grupo: '1000',
    executor: '1000',
    valor: '',
    tipo: 'cue',
  }),
  false
);

console.log('Todos los casos del backend (ConstructorComandosMA2 y Type Guards) pasaron exitosamente.');
