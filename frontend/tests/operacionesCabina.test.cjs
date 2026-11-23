const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  module._compile(output, filename);
};

const { CATALOGO_GRUPOS } = require('../src/diccionario/TraductorLuces.ts');
const { bloqueoDeSeguridadCompuesto } = require('../src/seguridadComandos.ts');
const {
  MAX_PASOS_DESHACER,
  alternarSeleccionGrupo,
  capturarInstantaneaAfectados,
  construirComandosColorSeleccion,
  construirComandosIntensidadSeleccion,
  construirComandosRestauracion,
  esSeleccionCompleta,
  formatearResumenSeleccion,
  registrarPasoDeshacer,
} = require('../src/servicios/operacionesCabina.ts');

console.log('Iniciando pruebas unitarias de operaciones de cabina (multi-selección, Todos y Deshacer):');

// 1. Multi-selección con Ctrl/Cmd + clic y validación de selección mínima
let seleccion = ['1'];
seleccion = alternarSeleccionGrupo(seleccion, '4', true);
seleccion = alternarSeleccionGrupo(seleccion, '2', true);
assert.deepEqual(seleccion, ['1', '2', '4']);
assert.deepEqual(formatearResumenSeleccion(seleccion, CATALOGO_GRUPOS), {
  badge: '3 GRUPOS',
  titulo: 'G1, G2, G4',
});

// Quitar un elemento y asegurar que nunca queda vacía
seleccion = alternarSeleccionGrupo(seleccion, '2', true);
assert.deepEqual(seleccion, ['1', '4']);
seleccion = alternarSeleccionGrupo(['1'], '1', true);
assert.deepEqual(seleccion, ['1'], 'Debe conservar al menos un grupo seleccionado');

// Clic normal reemplaza la selección múltiple
seleccion = alternarSeleccionGrupo(['1', '2', '4'], '3', false);
assert.deepEqual(seleccion, ['3']);
assert.deepEqual(formatearResumenSeleccion(seleccion, CATALOGO_GRUPOS), {
  badge: 'G3',
  titulo: 'Laterales',
});

// 2. Selección completa ("Todos") y generación compacta "1 thru 6" compatible con seguridadComandos
const todos = ['1', '2', '3', '4', '5', '6'];
assert.equal(esSeleccionCompleta(todos), true);
assert.deepEqual(formatearResumenSeleccion(todos, CATALOGO_GRUPOS), {
  badge: 'TODOS',
  titulo: 'Todos (G1–G6)',
});

const cmdTodosIntensidad = construirComandosIntensidadSeleccion(todos, 75);
assert.deepEqual(cmdTodosIntensidad, [
  { accion: 'ajustar', grupo: '1 thru 6', valor: '75', tipo: 'intensidad' },
]);
assert.equal(bloqueoDeSeguridadCompuesto(cmdTodosIntensidad), null);

const cmdTodosColor = construirComandosColorSeleccion(todos, '4.7');
assert.deepEqual(cmdTodosColor, [
  { accion: 'color', grupo: '1 thru 6', valor: '4.7', tipo: 'color' },
]);
assert.equal(bloqueoDeSeguridadCompuesto(cmdTodosColor), null);

// Subconjunto multi-grupo genera comandos individuales válidos
const cmdSubconjunto = construirComandosIntensidadSeleccion(['1', '4'], 50);
assert.deepEqual(cmdSubconjunto, [
  { accion: 'ajustar', grupo: '1', valor: '50', tipo: 'intensidad' },
  { accion: 'ajustar', grupo: '4', valor: '50', tipo: 'intensidad' },
]);
assert.equal(bloqueoDeSeguridadCompuesto(cmdSubconjunto), null);

// 3. Captura de snapshots y límite máximo de 20 pasos en la pila Deshacer
const estadoGruposInicial = {
  '1': { id: '1', nombre: 'Frontales', intensidad: 50, colorNombre: 'Azul Cobalto', colorHex: '#3b82f6', colorPreset: '4.7' },
  '2': { id: '2', nombre: 'Contraluz', intensidad: 0, colorNombre: null, colorHex: null, colorPreset: null },
  '3': { id: '3', nombre: 'Laterales', intensidad: 80, colorNombre: null, colorHex: null, colorPreset: null },
  '4': { id: '4', nombre: 'Wash Escenario', intensidad: 100, colorNombre: 'Ámbar Cálido', colorHex: '#f59e0b', colorPreset: '4.3' },
  '5': { id: '5', nombre: 'Cabezas Móviles', intensidad: 0, colorNombre: null, colorHex: null, colorPreset: null },
  '6': { id: '6', nombre: 'Público / Blinders', intensidad: 0, colorNombre: null, colorHex: null, colorPreset: null },
};

const snapshot = capturarInstantaneaAfectados(estadoGruposInicial, [
  { accion: 'apagar', grupo: '1', valor: '0', tipo: 'intensidad' },
  { accion: 'ajustar', grupo: '2', valor: '60', tipo: 'intensidad' },
]);
assert.equal(snapshot.length, 2);
assert.equal(snapshot[0].id, '1');
assert.equal(snapshot[1].id, '2');

const comandosRestauracion = construirComandosRestauracion(snapshot);
assert.deepEqual(comandosRestauracion, [
  { accion: 'ajustar', grupo: '1', valor: '50', tipo: 'intensidad' },
  { accion: 'color', grupo: '1', valor: '4.7', tipo: 'color' },
  { accion: 'apagar', grupo: '2', valor: '0', tipo: 'intensidad' },
]);
assert.equal(bloqueoDeSeguridadCompuesto(comandosRestauracion), null);

// Deshacer debe restaurar el preset de color aunque el grupo estuviera apagado (intensidad 0)
const comandosRestauracionApagadoConColor = construirComandosRestauracion([
  { id: '3', nombre: 'Laterales', intensidad: 0, colorNombre: 'Rojo Carmesí', colorHex: '#ef4444', colorPreset: '4.2' },
]);
assert.deepEqual(comandosRestauracionApagadoConColor, [
  { accion: 'apagar', grupo: '3', valor: '0', tipo: 'intensidad' },
  { accion: 'color', grupo: '3', valor: '4.2', tipo: 'color' },
]);
assert.equal(bloqueoDeSeguridadCompuesto(comandosRestauracionApagadoConColor), null);

// Verificar tope de MAX_PASOS_DESHACER (20)
let pila = [];
for (let i = 1; i <= 25; i += 1) {
  pila = registrarPasoDeshacer(pila, {
    id: `paso-${i}`,
    etiqueta: `Cambio ${i}`,
    estadosPrevios: snapshot,
  });
}
assert.equal(pila.length, MAX_PASOS_DESHACER);
assert.equal(pila[0].id, 'paso-25');
assert.equal(pila[MAX_PASOS_DESHACER - 1].id, 'paso-6');

console.log('Todas las pruebas de operaciones de cabina pasaron exitosamente.');
