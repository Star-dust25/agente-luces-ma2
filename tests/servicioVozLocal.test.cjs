const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const {
  ServicioVozLocal,
  calcularNivelRMS,
  normalizarAudioPCM,
  limpiarTextoTranscrito,
  convertirAudioAFloat32,
} = require('../dist/servicios/ServicioVozLocal.js');

console.log('Iniciando pruebas unitarias de ServicioVozLocal (RF-06):');

function generarTonoVoz(longitud = 8000, amplitud = 0.2) {
  const muestras = new Float32Array(longitud);
  for (let i = 0; i < longitud; i += 1) {
    muestras[i] = amplitud * Math.sin((2 * Math.PI * 440 * i) / 16000);
  }
  return muestras;
}

async function ejecutarPruebas() {
  // 1. Utilidades PCM y limpieza de texto
  assert.equal(calcularNivelRMS(new Float32Array(0)), 0);
  const rmsMedio = calcularNivelRMS(new Float32Array([0.5, -0.5, 0.5, -0.5]));
  assert.ok(Math.abs(rmsMedio - 0.5) < 1e-6);

  const normalizadas = normalizarAudioPCM(new Float32Array([0.1, -0.2, 0.05]));
  const pico = Math.max(...Array.from(normalizadas, (v) => Math.abs(v)));
  assert.ok(Math.abs(pico - 0.95) < 1e-5, 'La normalización debe escalar el pico a 0.95');

  assert.equal(
    limpiarTextoTranscrito(' [Música]  Frontales   al 50% (aplausos) '),
    'Frontales al 50%'
  );
  assert.equal(limpiarTextoTranscrito('gracias por ver'), '');
  assert.equal(limpiarTextoTranscrito('musica.'), '');

  assert.ok(convertirAudioAFloat32([0.1, -0.1]) instanceof Float32Array);
  assert.equal(convertirAudioAFloat32('no-valido'), null);

  const dirCache = path.join(os.tmpdir(), 'ma2-voz-cache-test');

  // 2. Rechazo por audio demasiado corto o inválido
  const servicioBasico = new ServicioVozLocal(dirCache, async () => ({ text: 'frontales al 50%' }));
  const resCorto = await servicioBasico.transcribirAudioPCM(new Float32Array(120));
  assert.equal(resCorto.exito, false);
  assert.match(resCorto.mensaje, /demasiado corta/i);

  // 3. Rechazo por silencio en el micrófono
  const resSilencio = await servicioBasico.transcribirAudioPCM(new Float32Array(8000));
  assert.equal(resSilencio.exito, false);
  assert.match(resSilencio.mensaje, /No se detectó voz suficiente/i);

  // 4. Transcripción exitosa en español con doble buffer / ArrayBuffer y normalización
  let opcionesRecibidas = null;
  let muestrasRecibidas = null;
  const servicioExito = new ServicioVozLocal(dirCache, async (audioPCM, opciones) => {
    muestrasRecibidas = audioPCM;
    opcionesRecibidas = opciones;
    return { text: ' [Ruido]  Frontales al 70% en azul ' };
  });

  const tono = generarTonoVoz(8000, 0.15);
  const resOk = await servicioExito.transcribirAudioPCM(tono.buffer);
  assert.equal(resOk.exito, true);
  assert.equal(resOk.texto, 'Frontales al 70% en azul');
  assert.equal(resOk.estadoModelo, 'LISTO');
  assert.deepEqual(opcionesRecibidas, { language: 'spanish', task: 'transcribe' });
  assert.ok(muestrasRecibidas instanceof Float32Array);

  // 5. Manejo seguro ante alucinación de silencio (texto vacío tras limpiar)
  const servicioAlucinacion = new ServicioVozLocal(dirCache, async () => ({ text: '[Música]' }));
  const resVacio = await servicioAlucinacion.transcribirAudioPCM(tono);
  assert.equal(resVacio.exito, false);
  assert.equal(resVacio.texto, '');
  assert.match(resVacio.mensaje, /No se pudo reconocer ninguna palabra/i);

  // 6. Tolerancia a fallos de red/modelo sin lanzar excepciones hacia Electron
  const servicioSinInternet = new ServicioVozLocal(dirCache, async () => {
    throw new Error('ENOTFOUND huggingface.co');
  });
  const resError = await servicioSinInternet.transcribirAudioPCM(tono);
  assert.equal(resError.exito, false);
  assert.equal(resError.estadoModelo, 'ERROR');
  assert.match(resError.mensaje, /caché|internet|texto/i);

  console.log('Todos los casos de ServicioVozLocal (RF-06) pasaron exitosamente.');
}

ejecutarPruebas().catch((error) => {
  console.error(error);
  process.exit(1);
});
