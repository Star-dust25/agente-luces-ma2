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

  // Rangos invertidos o fuera de catálogo rechazados directamente por el traductor
  const rInvertido = TraductorLuces.interpretarOrden('grupos 6 al 2 al 50%');
  assert.equal(rInvertido.exito, false, 'Debe rechazar rangos invertidos directamente');
  assert.match(rInvertido.mensajeError, /no es válido|menor o igual/i);

  const rExcedido = TraductorLuces.interpretarOrden('grupos 1 al 1000000 al 50%');
  assert.equal(rExcedido.exito, false, 'Debe rechazar rangos fuera del catálogo');
  assert.match(rExcedido.mensajeError, /catálogo configurado/i);

  // Rangos limitados al catálogo
  assert.equal(validarRangoGrupos(1, 6), null);
  assert.match(validarRangoGrupos(7, 8), /excede el catálogo configurado/i);
  assert.match(validarRangoGrupos(1, 10), /más de 6 grupos/i);

  console.log('  ✓ 5. Limitación de grupos y rangos al catálogo configurado: correcto');
}

// ============================================================================
// 6. Mantener compatibilidad con el contrato IPC y cobertura total RF-05 (9 colores)
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

  const casosColoresRF05 = [
    { orden: 'Frontales en blanco', preset: '4.1', grupo: '1' },
    { orden: 'Contraluz en rojo', preset: '4.2', grupo: '2' },
    { orden: 'Wash en ámbar', preset: '4.3', grupo: '4' },
    { orden: 'Laterales en amarillo', preset: '4.4', grupo: '3' },
    { orden: 'Móviles en verde', preset: '4.5', grupo: '5' },
    { orden: 'Público en cian', preset: '4.6', grupo: '6' },
    { orden: 'Frontales en azul', preset: '4.7', grupo: '1' },
    { orden: 'Contraluz en magenta', preset: '4.8', grupo: '2' },
    { orden: 'Wash en púrpura', preset: '4.9', grupo: '4' },
  ];

  for (const caso of casosColoresRF05) {
    const resColor = TraductorLuces.interpretarOrden(caso.orden);
    assert.equal(resColor.exito, true, `Debe traducir color RF-05: ${caso.orden}`);
    assert.deepEqual(resColor.comandoPayload, {
      accion: 'color',
      grupo: caso.grupo,
      valor: caso.preset,
      tipo: 'color',
    });
    assert.equal(resColor.sintaxisMA2, `Group ${caso.grupo} At Preset ${caso.preset}`);
  }

  console.log('  ✓ 6. Compatibilidad IPC y los 9 colores de RF-05 (4.1 a 4.9): correcto');
}

// ============================================================================
// 7. Órdenes compuestas (Intensidad + Color y Multi-cláusula con "y" / ",")
// ============================================================================
{
  // A. Intensidad + Color sobre el mismo grupo en una sola frase
  const ic1 = TraductorLuces.interpretarOrden('frontales al 70% en azul');
  assert.equal(ic1.exito, true);
  assert.deepEqual(ic1.comandosPayload, [
    { accion: 'ajustar', grupo: '1', valor: '70', tipo: 'intensidad' },
    { accion: 'color', grupo: '1', valor: '4.7', tipo: 'color' },
  ]);
  assert.deepEqual(ic1.sintaxisListaMA2, ['Group 1 At 70', 'Group 1 At Preset 4.7']);

  const ic2 = TraductorLuces.interpretarOrden('pon frontales en rojo al 80%');
  assert.equal(ic2.exito, true);
  assert.deepEqual(ic2.comandosPayload, [
    { accion: 'ajustar', grupo: '1', valor: '80', tipo: 'intensidad' },
    { accion: 'color', grupo: '1', valor: '4.2', tipo: 'color' },
  ]);

  const ic3 = TraductorLuces.interpretarOrden('encender contras en blanco');
  assert.equal(ic3.exito, true);
  assert.deepEqual(ic3.comandosPayload, [
    { accion: 'encender', grupo: '2', valor: '100', tipo: 'intensidad' },
    { accion: 'color', grupo: '2', valor: '4.1', tipo: 'color' },
  ]);

  // B. Multi-cláusula separada por " y " y ","
  const mc1 = TraductorLuces.interpretarOrden('frontales al 100% y contras apagadas');
  assert.equal(mc1.exito, true);
  assert.deepEqual(mc1.comandosPayload, [
    { accion: 'ajustar', grupo: '1', valor: '100', tipo: 'intensidad' },
    { accion: 'apagar', grupo: '2', valor: '0', tipo: 'intensidad' },
  ]);

  const mc2 = TraductorLuces.interpretarOrden('frontales al 50%, contras en rojo');
  assert.equal(mc2.exito, true);
  assert.deepEqual(mc2.comandosPayload, [
    { accion: 'ajustar', grupo: '1', valor: '50', tipo: 'intensidad' },
    { accion: 'color', grupo: '2', valor: '4.2', tipo: 'color' },
  ]);

  // C. Rechazo atómico (todo o nada) cuando una cláusula falla o contiene inyección
  const rechazo1 = TraductorLuces.interpretarOrden('frontales al 50% y contras al 150%');
  assert.equal(rechazo1.exito, false);
  assert.equal(rechazo1.comandosPayload.length, 0);
  assert.match(rechazo1.mensajeError, /0 y 100%/i);

  const rechazoInyeccion = TraductorLuces.interpretarOrden('frontales al 50%; shutdown');
  assert.equal(rechazoInyeccion.exito, false);
  assert.equal(rechazoInyeccion.comandosPayload.length, 0);
  assert.match(rechazoInyeccion.mensajeError, /seguridad/i);

  console.log('  ✓ 7. Órdenes compuestas y rechazo atómico (todo o nada): correcto');
}

console.log('\nTodos los casos de prueba de RF-03 pasaron exitosamente.');
