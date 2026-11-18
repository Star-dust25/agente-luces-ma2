const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

// Carga solo funciones puras del frontend en memoria; no inicia Electron ni Telnet.
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  module._compile(output, filename);
};

const { TraductorLuces } = require('../src/diccionario/TraductorLuces.ts');
const {
  bloqueoDeSeguridad,
  esComandoSeguro,
  validarRangoGrupos,
  validarValorIntensidad,
  validarPresetColor,
} = require('../src/seguridadComandos.ts');

function bloqueoDeOrden(orden) {
  const resultado = TraductorLuces.interpretarOrden(orden);
  assert.equal(resultado.exito, true, `El traductor debe reconocer: ${orden}`);
  return bloqueoDeSeguridad(resultado.comandoPayload, resultado.textoOriginal);
}

// ---------------------------------------------------------
// Casos originales creados por Codex (1 - 8)
// ---------------------------------------------------------
assert.equal(bloqueoDeOrden('Frontales al 50%'), null);
assert.equal(bloqueoDeOrden('Apagar frontales'), null);
assert.match(bloqueoDeOrden('Apagón general'), /Blackout/);
assert.match(bloqueoDeOrden('Apagar todas'), /Blackout/);
assert.match(bloqueoDeOrden('Grupos 1 al 1000000 al 50%'), /rangos/);
assert.match(bloqueoDeOrden('Grupos 6 al 2 al 50%'), /rango/);
assert.match(
  bloqueoDeSeguridad({ accion: 'apagar', grupo: '01 thru 06', valor: '0', tipo: 'intensidad' }),
  /Blackout/
);
assert.match(
  bloqueoDeSeguridad({ accion: 'ajustar', grupo: '1 thru 1000000', valor: '50', tipo: 'intensidad' }),
  /rangos/
);

// ---------------------------------------------------------
// Nuevos casos de seguridad del frontend
// ---------------------------------------------------------

// 9. Comandos de color válidos (vía NLP y payload directo)
assert.equal(bloqueoDeOrden('Contraluz en rojo'), null);
assert.equal(
  bloqueoDeSeguridad({ accion: 'color', grupo: '2', valor: '4.2', tipo: 'color' }),
  null
);

// 10. Bloqueo de presets de color inválidos o sospechosos
assert.match(
  bloqueoDeSeguridad({ accion: 'color', grupo: '2', valor: 'inyeccion', tipo: 'color' }),
  /preset de color/
);
assert.match(
  bloqueoDeSeguridad({ accion: 'color', grupo: '2', valor: '999', tipo: 'color' }),
  /preset de color/
);

// 11. Bloqueo de intensidades fuera de límites numéricos [0, 100]
assert.match(
  bloqueoDeSeguridad({ accion: 'ajustar', grupo: '1', valor: '150', tipo: 'intensidad' }),
  /intensidad/
);
assert.match(
  bloqueoDeSeguridad({ accion: 'ajustar', grupo: '1', valor: '-10', tipo: 'intensidad' }),
  /intensidad/
);
assert.match(
  bloqueoDeSeguridad({ accion: 'ajustar', grupo: '1', valor: 'invalido', tipo: 'intensidad' }),
  /intensidad/
);

// 12. Detección y bloqueo de inyección de caracteres de control o comandos múltiples (';', '\r', '\n')
assert.match(
  bloqueoDeSeguridad({ accion: 'ajustar', grupo: '1; Off Group 2', valor: '50', tipo: 'intensidad' }),
  /seguridad/
);
assert.match(
  bloqueoDeSeguridad({ accion: 'ajustar', grupo: '1', valor: '50\r\nOff 1', tipo: 'intensidad' }),
  /seguridad/
);
assert.match(
  bloqueoDeSeguridad(
    { accion: 'ajustar', grupo: '1', valor: '50', tipo: 'intensidad' },
    'Frontales 50%; Apagar todo'
  ),
  /seguridad/
);

// 13. Reconocimiento de orden directa de Blackout y variantes
assert.match(bloqueoDeOrden('Blackout'), /Blackout/);
assert.match(
  bloqueoDeSeguridad({ accion: 'apagar', grupo: '1', valor: '0', tipo: 'intensidad' }, 'black out general'),
  /Blackout/
);

// 14. Incompatibilidad entre acción y tipo de parámetro
assert.match(
  bloqueoDeSeguridad({ accion: 'color', grupo: '1', valor: '50', tipo: 'intensidad' }),
  /color no es compatible/
);
assert.match(
  bloqueoDeSeguridad({ accion: 'ajustar', grupo: '1', valor: '4.2', tipo: 'color' }),
  /no es compatible/
);

// 15. Grupos individuales inválidos (0, negativos, texto no numérico)
assert.match(
  bloqueoDeSeguridad({ accion: 'encender', grupo: '0', valor: '100', tipo: 'intensidad' }),
  /no es válido/
);
assert.match(
  bloqueoDeSeguridad({ accion: 'encender', grupo: 'abc', valor: '100', tipo: 'intensidad' }),
  /no es válido/
);

// 16. Comando nulo o inválido
assert.match(bloqueoDeSeguridad(null), /no es válido/);

// 17. Funciones auxiliares de validación directa
assert.equal(validarRangoGrupos(1, 6), null);
assert.match(validarRangoGrupos(1, 7), /más de 6 grupos/);
assert.match(validarRangoGrupos(5, 2), /no es válido/);

assert.equal(validarValorIntensidad('75'), null);
assert.match(validarValorIntensidad('105'), /0 y 100%/);
assert.match(validarValorIntensidad('xyz'), /número válido/);

assert.equal(validarPresetColor('4.1'), null);
assert.match(validarPresetColor('5.1'), /no es válido/);

// 18. Verificación de función booleana esComandoSeguro
assert.equal(
  esComandoSeguro({ accion: 'encender', grupo: '1', valor: '100', tipo: 'intensidad' }),
  true
);
assert.equal(
  esComandoSeguro({ accion: 'apagar', grupo: '1 thru 6', valor: '0', tipo: 'intensidad' }),
  false
);

console.log('Todos los casos de seguridad del frontend (18/18): correctos');
