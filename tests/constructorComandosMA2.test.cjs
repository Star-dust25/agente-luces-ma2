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

console.log('Todos los casos del backend (ConstructorComandosMA2 y Type Guards) pasaron exitosamente.');
