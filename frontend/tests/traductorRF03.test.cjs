const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

// Carga funciones puras en memoria usando transpiler TypeScript de Node.
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
  validarRangoGrupos,
} = require('../src/seguridadComandos.ts');

console.log('Iniciando batería de pruebas automatizadas RF-03:');

// ============================================================================
// 1. Rechazar órdenes ambiguas con varios grupos o colores
// ============================================================================
{
  // Múltiples grupos del catálogo
  const r1 = TraductorLuces.interpretarOrden('frontales y laterales al 50%');
  assert.equal(r1.exito, false, 'Debe rechazar múltiples grupos con nombre');
  assert.match(r1.mensajeError, /múltiples grupos/i);

  const r2 = TraductorLuces.interpretarOrden('encender wash y moviles');
  assert.equal(r2.exito, false);
  assert.match(r2.mensajeError, /múltiples grupos/i);

  // Múltiples grupos numéricos
  const r3 = TraductorLuces.interpretarOrden('grupo 1 y grupo 2 al 50%');
  assert.equal(r3.exito, false);
  assert.match(r3.mensajeError, /múltiples grupos/i);

  // Grupo por nombre y grupo numérico distinto
  const r4 = TraductorLuces.interpretarOrden('frontales y grupo 2 al 50%');
  assert.equal(r4.exito, false);
  assert.match(r4.mensajeError, /múltiples grupos/i);

  // Rango y grupo nombrado
  const r5 = TraductorLuces.interpretarOrden('grupos 1 al 3 y laterales al 50%');
  assert.equal(r5.exito, false);
  assert.match(r5.mensajeError, /múltiples grupos/i);

  // Múltiples colores
  const c1 = TraductorLuces.interpretarOrden('frontales en rojo y verde');
  assert.equal(c1.exito, false, 'Debe rechazar múltiples colores');
  assert.match(c1.mensajeError, /múltiples colores/i);

  const c2 = TraductorLuces.interpretarOrden('poner wash en azul o amarillo');
  assert.equal(c2.exito, false);
  assert.match(c2.mensajeError, /múltiples colores/i);

  const c3 = TraductorLuces.interpretarOrden('contraluz cian y magenta');
  assert.equal(c3.exito, false);
  assert.match(c3.mensajeError, /múltiples colores/i);

  // Caso no ambiguo: un solo color con sinónimos compuestos válidos
  const cValido = TraductorLuces.interpretarOrden('frontales en rojo carmesi');
  assert.equal(cValido.exito, true, 'Rojo carmesí es un único color del catálogo');
  assert.equal(cValido.comandoPayload?.valor, '4.2');

  console.log('  ✓ 1. Rechazo de ambigüedad (múltiples grupos o colores): correcto');
}

// ============================================================================
// 2. Rechazar acciones contradictorias: encender y apagar a la vez
// ============================================================================
{
  const a1 = TraductorLuces.interpretarOrden('encender y apagar frontales');
  assert.equal(a1.exito, false);
  assert.match(a1.mensajeError, /contradictoria/i);

  const a2 = TraductorLuces.interpretarOrden('apaga y prende laterales');
  assert.equal(a2.exito, false);
  assert.match(a2.mensajeError, /contradictoria/i);

  const a3 = TraductorLuces.interpretarOrden('frontales on off');
  assert.equal(a3.exito, false);
  assert.match(a3.mensajeError, /contradictoria/i);

  const a4 = TraductorLuces.interpretarOrden('apagar frontales al 100%');
  assert.equal(a4.exito, false);
  assert.match(a4.mensajeError, /contradictoria/i);

  const a5 = TraductorLuces.interpretarOrden('apagar frontales al 50%');
  assert.equal(a5.exito, false);
  assert.match(a5.mensajeError, /contradictoria/i);

  // Apagar al 0% es coherente y no contradictorio
  const aCoherente = TraductorLuces.interpretarOrden('apagar frontales al 0%');
  assert.equal(aCoherente.exito, true);
  assert.equal(aCoherente.comandoPayload?.valor, '0');

  console.log('  ✓ 2. Rechazo de acciones contradictorias (encender/apagar): correcto');
}

// ============================================================================
// 3. Rechazar intensidades fuera de 0-100 y números malformados
// ============================================================================
{
  const n1 = TraductorLuces.interpretarOrden('frontales al 150%');
  assert.equal(n1.exito, false);
  assert.match(n1.mensajeError, /0 y 100%/i);

  const n2 = TraductorLuces.interpretarOrden('frontales al -10%');
  assert.equal(n2.exito, false);
  assert.match(n2.mensajeError, /0 y 100%/i);

  const n3 = TraductorLuces.interpretarOrden('frontales al 101%');
  assert.equal(n3.exito, false);
  assert.match(n3.mensajeError, /0 y 100%/i);

  const n4 = TraductorLuces.interpretarOrden('frontales al 50.2.1%');
  assert.equal(n4.exito, false);
  assert.match(n4.mensajeError, /malformado/i);

  const n5 = TraductorLuces.interpretarOrden('frontales al 50..%');
  assert.equal(n5.exito, false);
  assert.match(n5.mensajeError, /malformado/i);

  const n6 = TraductorLuces.interpretarOrden('subir frontales al 200%');
  assert.equal(n6.exito, false);
  assert.match(n6.mensajeError, /0 y 100%/i);

  // Valores válidos dentro de límites
  const nValido0 = TraductorLuces.interpretarOrden('frontales al 0%');
  assert.equal(nValido0.exito, true);
  assert.equal(nValido0.comandoPayload?.valor, '0');

  const nValido100 = TraductorLuces.interpretarOrden('frontales al 100%');
  assert.equal(nValido100.exito, true);
  assert.equal(nValido100.comandoPayload?.valor, '100');

  const nValidoDec = TraductorLuces.interpretarOrden('frontales al 33.5%');
  assert.equal(nValidoDec.exito, true);
  assert.equal(nValidoDec.comandoPayload?.valor, '33.5');

  console.log('  ✓ 3. Rechazo de intensidades fuera de 0-100 y números malformados: correcto');
}

// ============================================================================
// 4. No asignar automáticamente 50% cuando falta una intensidad en órdenes como "sube frontales"
// ============================================================================
{
  const s1 = TraductorLuces.interpretarOrden('sube frontales');
  assert.equal(s1.exito, false, 'No debe asignar 50% arbitrariamente a "sube frontales"');
  assert.match(s1.mensajeError, /especifica/i);

  const s2 = TraductorLuces.interpretarOrden('subir frontales');
  assert.equal(s2.exito, false);
  assert.match(s2.mensajeError, /especifica/i);

  const s3 = TraductorLuces.interpretarOrden('baja frontales');
  assert.equal(s3.exito, false);
  assert.match(s3.mensajeError, /especifica/i);

  const s4 = TraductorLuces.interpretarOrden('ajusta laterales');
  assert.equal(s4.exito, false);
  assert.match(s4.mensajeError, /especifica/i);

  const s5 = TraductorLuces.interpretarOrden('atenuar contraluz');
  assert.equal(s5.exito, false);
  assert.match(s5.mensajeError, /especifica/i);

  const s6 = TraductorLuces.interpretarOrden('dimmer wash');
  assert.equal(s6.exito, false);
  assert.match(s6.mensajeError, /especifica/i);

  // Con intensidad explícita o significado semántico sí debe procesarse
  const sValido1 = TraductorLuces.interpretarOrden('sube frontales al 80%');
  assert.equal(sValido1.exito, true);
  assert.equal(sValido1.comandoPayload?.valor, '80');

  const sValido2 = TraductorLuces.interpretarOrden('baja frontales al 20%');
  assert.equal(sValido2.exito, true);
  assert.equal(sValido2.comandoPayload?.valor, '20');

  const sValidoMitad = TraductorLuces.interpretarOrden('frontales a la mitad');
  assert.equal(sValidoMitad.exito, true);
  assert.equal(sValidoMitad.comandoPayload?.valor, '50');

  console.log('  ✓ 4. No asignación automática de 50% en órdenes relativas sin nivel: correcto');
}

// ============================================================================
// 5. Limitar grupos y rangos según el catálogo de prueba configurado
// ============================================================================
{
  // Grupos individuales numéricos inexistentes en el catálogo (1 al 6)
  const g1 = TraductorLuces.interpretarOrden('grupo 7 al 50%');
  assert.equal(g1.exito, false, 'Grupo 7 debe ser rechazado por no existir en catálogo');
  assert.match(g1.mensajeError, /no existe en el catálogo/i);

  const g2 = TraductorLuces.interpretarOrden('grupo 99 en rojo');
  assert.equal(g2.exito, false);
  assert.match(g2.mensajeError, /no existe en el catálogo/i);

  // Bloqueo de seguridad para grupos individuales > 6 en payloads directos
  const bSeg = bloqueoDeSeguridad({ accion: 'ajustar', grupo: '7', valor: '50', tipo: 'intensidad' });
  assert.match(bSeg, /catálogo configurado/i);

  // Grupos numéricos válidos en el catálogo
  const gValido1 = TraductorLuces.interpretarOrden('grupo 1 al 50%');
  assert.equal(gValido1.exito, true);
  assert.equal(gValido1.comandoPayload?.grupo, '1');

  const gValido6 = TraductorLuces.interpretarOrden('grupo 6 al 100%');
  assert.equal(gValido6.exito, true);
  assert.equal(gValido6.comandoPayload?.grupo, '6');

  // Rangos limitados al catálogo
  assert.equal(validarRangoGrupos(1, 6), null);
  assert.match(validarRangoGrupos(7, 8), /excede el catálogo configurado/i);
  assert.match(validarRangoGrupos(1, 10), /más de 6 grupos/i);

  console.log('  ✓ 5. Limitación de grupos y rangos al catálogo configurado: correcto');
}

// ============================================================================
// 6. Mantener compatibilidad con el contrato IPC
// ============================================================================
{
  const pIntensidad = TraductorLuces.interpretarOrden('Frontales al 50%');
  assert.deepEqual(pIntensidad.comandoPayload, {
    accion: 'ajustar',
    grupo: '1',
    valor: '50',
    tipo: 'intensidad',
  });
  assert.equal(pIntensidad.sintaxisMA2, 'Group 1 At 50');

  const pColor = TraductorLuces.interpretarOrden('Contraluz en rojo');
  assert.deepEqual(pColor.comandoPayload, {
    accion: 'color',
    grupo: '2',
    valor: '4.2',
    tipo: 'color',
  });
  assert.equal(pColor.sintaxisMA2, 'Group 2 At Preset 4.2');

  console.log('  ✓ 6. Compatibilidad con el contrato IPC y sintaxis MA2: correcto');
}

console.log('\nTodos los casos de prueba de RF-03 pasaron exitosamente.');
