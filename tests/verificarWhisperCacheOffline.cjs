// Diagnóstico opcional: requiere que el modelo ya exista en .cache-modelos-voz.
// Deshabilita cualquier descarga remota; un tono no demuestra reconocimiento de voz real.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ServicioVozLocal } = require('../dist/servicios/ServicioVozLocal.js');

async function verificar() {
  const rutaCache = path.resolve(__dirname, '..', '.cache-modelos-voz');
  assert.ok(fs.existsSync(rutaCache), 'Falta la caché local del modelo.');
  const transformadores = await import('@huggingface/transformers');
  transformadores.env.cacheDir = rutaCache;
  transformadores.env.allowLocalModels = true;
  transformadores.env.allowRemoteModels = false;
  transformadores.env.useFSCache = true;

  const tono = Float32Array.from({ length: 8000 }, (_, i) =>
    0.15 * Math.sin(2 * Math.PI * 440 * i / 16000)
  );
  const resultado = await new ServicioVozLocal(rutaCache).transcribirAudioPCM(tono);
  assert.equal(resultado.estadoModelo, 'LISTO', resultado.mensaje);
  console.log(`WHISPER_LOCAL_LISTO duración=${resultado.duracionMs}ms texto=${JSON.stringify(resultado.texto)}`);
}

verificar().catch((error) => { console.error(error); process.exitCode = 1; });
