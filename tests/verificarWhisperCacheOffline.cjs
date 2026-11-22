// Diagnóstico opcional: requiere que el modelo ya exista en la caché local (userData o respaldo).
// Verifica la política automática y bloquea cualquier fetch real; un tono no demuestra habla real.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ServicioVozLocal } = require('../dist/servicios/ServicioVozLocal.js');

function resolverRutaCache() {
  const explicita = process.argv[2] || process.env.MA2_RUTA_CACHE_VOZ;
  if (explicita && explicita.trim().length > 0) {
    return path.resolve(explicita.trim());
  }

  const baseAppData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  const rutaUserData = path.join(baseAppData, 'agente-luces-ma2', 'cache-modelos-voz');
  if (fs.existsSync(rutaUserData)) {
    return rutaUserData;
  }

  return path.resolve(__dirname, '..', '.cache-modelos-voz');
}

async function verificar() {
  const rutaCache = resolverRutaCache();
  assert.ok(fs.existsSync(rutaCache), `Falta la caché local del modelo en "${rutaCache}".`);
  const transformadores = await import('@huggingface/transformers');
  const fetchAnterior = transformadores.env.fetch;
  const remotoAnterior = transformadores.env.allowRemoteModels;
  let consultasRemotas = 0;
  // Partir con remoto permitido comprueba que el servicio lo prohíbe por sí mismo
  // cuando descubre la caché completa. La trampa impide una solicitud real si falla.
  transformadores.env.allowRemoteModels = true;
  transformadores.env.fetch = async () => {
    consultasRemotas += 1;
    throw new Error('Solicitud remota bloqueada durante diagnóstico offline');
  };

  try {
    const tono = Float32Array.from({ length: 8000 }, (_, i) =>
      0.15 * Math.sin(2 * Math.PI * 440 * i / 16000)
    );
    const resultado = await new ServicioVozLocal(rutaCache).transcribirAudioPCM(tono);
    assert.equal(resultado.estadoModelo, 'LISTO', resultado.mensaje);
    assert.equal(consultasRemotas, 0, 'No debe haber consultas HTTP con caché completa.');
    console.log(`WHISPER_LOCAL_LISTO duración=${resultado.duracionMs}ms texto=${JSON.stringify(resultado.texto)} consultasRemotas=${consultasRemotas}`);
  } finally {
    transformadores.env.fetch = fetchAnterior;
    transformadores.env.allowRemoteModels = remotoAnterior;
  }
}

verificar().catch((error) => { console.error(error); process.exitCode = 1; });
