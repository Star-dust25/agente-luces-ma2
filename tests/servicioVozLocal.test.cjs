const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const Module = require('node:module');
const os = require('node:os');
const path = require('node:path');
const {
  ServicioVozLocal,
  calcularNivelRMS,
  normalizarAudioPCM,
  limpiarTextoTranscrito,
  convertirAudioAFloat32,
  archivosCacheVozLegibles,
} = require('../dist/servicios/ServicioVozLocal.js');

console.log('Iniciando pruebas unitarias de ServicioVozLocal (RF-06):');

function generarTonoVoz(longitud = 8000, amplitud = 0.2) {
  const muestras = new Float32Array(longitud);
  for (let i = 0; i < longitud; i += 1) {
    muestras[i] = amplitud * Math.sin((2 * Math.PI * 440 * i) / 16000);
  }
  return muestras;
}

async function conTransformersSimulado(modulo, accion) {
  const cargarOriginal = Module._load;
  Module._load = function (solicitud) {
    if (solicitud === '@huggingface/transformers') return modulo;
    return cargarOriginal.apply(this, arguments);
  };
  try {
    return await accion();
  } finally {
    Module._load = cargarOriginal;
  }
}

function crearTransformersSimulado(estado, remotoEsperado, fallar = false) {
  const env = {
    cacheDir: 'cache-anterior', allowLocalModels: false,
    allowRemoteModels: true, useFSCache: false,
  };
  const llamadas = { registro: 0, pipeline: 0, inferencia: 0 };
  return {
    env, llamadas,
    ModelRegistry: {
      async is_pipeline_cached_files(tarea, modelo, opciones) {
        llamadas.registro += 1;
        assert.equal(tarea, 'automatic-speech-recognition');
        assert.equal(modelo, 'Xenova/whisper-tiny');
        assert.equal(opciones.dtype, 'q8');
        assert.equal(env.allowRemoteModels, false, 'La inspección no debe consultar la red');
        return estado;
      },
    },
    async pipeline(tarea, modelo, opciones) {
      llamadas.pipeline += 1;
      assert.equal(tarea, 'automatic-speech-recognition');
      assert.equal(modelo, 'Xenova/whisper-tiny');
      assert.equal(opciones.dtype, 'q8');
      assert.equal(env.allowRemoteModels, remotoEsperado);
      assert.equal(opciones.local_files_only, !remotoEsperado);
      if (fallar) throw new Error(remotoEsperado ? 'ENOTFOUND huggingface.co' : 'local_files_only=true');
      opciones.progress_callback({ status: 'ready' });
      return async (_audio, opcionesASR) => {
        llamadas.inferencia += 1;
        assert.deepEqual(opcionesASR, { language: 'spanish', task: 'transcribe' });
        return { text: 'Frontales al 50%' };
      };
    },
  };
}

async function probarCacheYModoOffline(tono) {
  const temporal = await fs.mkdtemp(path.join(os.tmpdir(), 'ma2-voz-cache-'));
  const modelo = path.join(temporal, 'Xenova', 'whisper-tiny');
  try {
    await fs.mkdir(modelo, { recursive: true });
    await fs.writeFile(path.join(modelo, 'config.json'), JSON.stringify({ model_type: 'whisper', is_encoder_decoder: true }));
    await fs.writeFile(path.join(modelo, 'tokenizer_config.json'), '{}');
    await fs.writeFile(path.join(modelo, 'preprocessor_config.json'), '{}');

    // El registro real de la versión instalada determina los recursos q8 del fixture.
    const real = require('@huggingface/transformers');
    const anterior = {
      cacheDir: real.env.cacheDir,
      allowRemoteModels: real.env.allowRemoteModels,
      allowLocalModels: real.env.allowLocalModels,
      useFSCache: real.env.useFSCache,
      fetch: real.env.fetch,
    };
    let consultasRemotas = 0;
    let archivos;
    try {
      real.env.cacheDir = temporal;
      real.env.allowRemoteModels = false;
      real.env.allowLocalModels = true;
      real.env.useFSCache = true;
      real.env.fetch = async () => { consultasRemotas += 1; throw new Error('Red prohibida en fixture'); };
      const estado = await real.ModelRegistry.is_pipeline_cached_files(
        'automatic-speech-recognition', 'Xenova/whisper-tiny', { cache_dir: temporal, dtype: 'q8' }
      );
      archivos = estado.files.map(({ file }) => file);
      assert.equal(estado.allCached, false);
      assert.ok(archivos.some((archivo) => archivo.endsWith('.onnx')));
      assert.ok(archivos.includes('tokenizer.json'));
      assert.ok(archivos.includes('preprocessor_config.json'));
      assert.equal(consultasRemotas, 0);
    } finally {
      Object.assign(real.env, anterior);
    }

    for (const archivo of archivos) {
      const destino = path.join(modelo, ...archivo.split('/'));
      await fs.mkdir(path.dirname(destino), { recursive: true });
      if (archivo.endsWith('.onnx')) await fs.writeFile(destino, Buffer.from([8, 1]));
      else if (!(await fs.stat(destino).then(() => true, () => false))) await fs.writeFile(destino, '{}');
    }
    const estadosCompletos = archivos.map((file) => ({ file, cached: true }));
    assert.equal(await archivosCacheVozLegibles(temporal, estadosCompletos), true);
    assert.equal(await archivosCacheVozLegibles(path.join(temporal, 'inexistente'), estadosCompletos), false);

    const onnx = archivos.find((archivo) => archivo.endsWith('.onnx'));
    const rutaOnnx = path.join(modelo, ...onnx.split('/'));
    await fs.writeFile(rutaOnnx, Buffer.alloc(0));
    assert.equal(await archivosCacheVozLegibles(temporal, estadosCompletos), false, 'ONNX vacío');
    await fs.writeFile(rutaOnnx, Buffer.from([8, 1]));
    await fs.unlink(rutaOnnx);
    assert.equal(await archivosCacheVozLegibles(temporal, estadosCompletos), false, 'ONNX ausente');
    await fs.writeFile(rutaOnnx, Buffer.from([8, 1]));

    const rutaTokenizador = path.join(modelo, 'tokenizer.json');
    await fs.writeFile(rutaTokenizador, '{');
    assert.equal(await archivosCacheVozLegibles(temporal, estadosCompletos), false, 'JSON truncado');
    await fs.writeFile(rutaTokenizador, '{}');

    const abrirOriginal = fs.open;
    fs.open = async function (ruta, ...args) {
      if (ruta === rutaTokenizador) throw Object.assign(new Error('Acceso denegado'), { code: 'EACCES' });
      return abrirOriginal.call(this, ruta, ...args);
    };
    try {
      assert.equal(await archivosCacheVozLegibles(temporal, estadosCompletos), false, 'Archivo ilegible');
    } finally {
      fs.open = abrirOriginal;
    }

    const estadoCompleto = { allCached: true, files: estadosCompletos };
    const progreso = [];
    const completo = crearTransformersSimulado(estadoCompleto, false);
    await conTransformersSimulado(completo, async () => {
      const servicio = new ServicioVozLocal(temporal, null, (mensaje) => progreso.push(mensaje));
      assert.equal((await servicio.transcribirAudioPCM(tono)).exito, true);
      assert.equal((await servicio.transcribirAudioPCM(tono)).exito, true);
    });
    assert.equal(completo.llamadas.registro, 1);
    assert.equal(completo.llamadas.pipeline, 1, 'Pipeline reutilizado en carga repetida');
    assert.equal(completo.llamadas.inferencia, 2);
    assert.ok(progreso.some((mensaje) => mensaje.includes('Cargando modelo local desde caché')));
    assert.deepEqual(completo.env, {
      cacheDir: 'cache-anterior', allowLocalModels: false,
      allowRemoteModels: true, useFSCache: false,
    }, 'El entorno global se restaura');

    const rutaPreprocesador = path.join(modelo, 'preprocessor_config.json');
    const rutaTemporalVieja = `${rutaOnnx}.tmp.residual`;
    const rutaTemporalActiva = `${rutaOnnx}.tmp.activa`;
    await fs.writeFile(rutaTemporalVieja, 'residuo');
    await fs.utimes(rutaTemporalVieja, new Date(0), new Date(0));
    await fs.writeFile(rutaTemporalActiva, 'descarga en curso');

    for (const contenidoCorrupto of ['{', Buffer.alloc(339)]) {
      await fs.writeFile(rutaPreprocesador, contenidoCorrupto);
      let intentos = 0;
      const simulado = crearTransformersSimulado(estadoCompleto, true);
      simulado.pipeline = async (_tarea, _modelo, opciones) => {
        intentos += 1;
        assert.equal(simulado.env.allowRemoteModels, true);
        assert.equal(opciones.local_files_only, false);
        assert.equal(await fs.stat(rutaPreprocesador).then(() => true, () => false), false);
        await fs.writeFile(rutaPreprocesador, '{}');
        return async () => ({ text: 'Frontales al 50%' });
      };
      const progresoReparacion = [];
      await conTransformersSimulado(simulado, async () => {
        const resultado = await new ServicioVozLocal(temporal, null, (mensaje) => progresoReparacion.push(mensaje)).transcribirAudioPCM(tono);
        assert.equal(resultado.exito, true);
      });
      assert.equal(intentos, 1, 'JSON inválido inicia una sola descarga simulada');
      assert.ok(progresoReparacion.some((mensaje) => /Caché de voz dañada/.test(mensaje)));
      assert.deepEqual(simulado.env, { cacheDir: 'cache-anterior', allowLocalModels: false, allowRemoteModels: true, useFSCache: false });
    }
    assert.equal(await fs.stat(rutaTemporalVieja).then(() => true, () => false), false, 'Temporal viejo retirado');
    assert.equal(await fs.readFile(rutaTemporalActiva, 'utf8'), 'descarga en curso', 'Temporal reciente intacto');
    assert.ok((await fs.readdir(path.dirname(rutaOnnx))).some((nombre) => nombre.startsWith(path.basename(rutaTemporalVieja) + '.corrupt.')));

    const contenidoOnnxCorrupto = Buffer.from([8, 1, 99]);
    await fs.writeFile(rutaOnnx, contenidoOnnxCorrupto);
    let intentosOnnx = 0;
    const simuladoOnnx = crearTransformersSimulado(estadoCompleto, false);
    simuladoOnnx.pipeline = async (_tarea, _modelo, opciones) => {
      intentosOnnx += 1;
      if (intentosOnnx === 1) {
        assert.equal(opciones.local_files_only, true);
        throw new Error(`Protobuf parsing failed: ${path.basename(rutaOnnx)}`);
      }
      assert.equal(simuladoOnnx.env.allowRemoteModels, true);
      assert.equal(opciones.local_files_only, false);
      assert.equal(await fs.stat(rutaOnnx).then(() => true, () => false), false);
      await fs.writeFile(rutaOnnx, Buffer.from([8, 1]));
      return async () => ({ text: 'Frontales al 50%' });
    };
    await conTransformersSimulado(simuladoOnnx, async () => {
      assert.equal((await new ServicioVozLocal(temporal).transcribirAudioPCM(tono)).exito, true);
    });
    assert.equal(intentosOnnx, 2, 'ONNX no vacío permite solo un reintento remoto');
    assert.ok((await fs.readdir(path.dirname(rutaOnnx))).some((nombre) => nombre.startsWith(path.basename(rutaOnnx) + '.corrupt.')));
    assert.deepEqual(simuladoOnnx.env, { cacheDir: 'cache-anterior', allowLocalModels: false, allowRemoteModels: true, useFSCache: false });

    let cargasConcurrentes = 0;
    const simuladoConcurrente = crearTransformersSimulado(estadoCompleto, false);
    simuladoConcurrente.pipeline = async (_tarea, _modelo, opciones) => {
      cargasConcurrentes += 1;
      if (cargasConcurrentes === 1) {
        assert.equal(opciones.local_files_only, true);
        return async () => { throw new Error(`Protobuf parsing failed: ${path.basename(rutaOnnx)}`); };
      }
      assert.equal(opciones.local_files_only, false);
      await fs.writeFile(rutaOnnx, Buffer.from([8, 1]));
      return async () => ({ text: 'Frontales al 50%' });
    };
    await conTransformersSimulado(simuladoConcurrente, async () => {
      const servicio = new ServicioVozLocal(temporal);
      const resultados = await Promise.all([servicio.transcribirAudioPCM(tono), servicio.transcribirAudioPCM(tono)]);
      assert.ok(resultados.every((resultado) => resultado.exito));
    });
    assert.equal(cargasConcurrentes, 2, 'Dos transcripciones comparten una sola recuperación');

    let intentosFallidos = 0;
    const simuladoSinInternet = crearTransformersSimulado(estadoCompleto, false);
    simuladoSinInternet.pipeline = async () => {
      intentosFallidos += 1;
      if (intentosFallidos === 1) throw new Error(`Protobuf parsing failed: ${path.basename(rutaOnnx)}`);
      throw new Error('ENOTFOUND huggingface.co');
    };
    await conTransformersSimulado(simuladoSinInternet, async () => {
      const resultado = await new ServicioVozLocal(temporal).transcribirAudioPCM(tono);
      assert.equal(resultado.exito, false);
      assert.match(resultado.mensaje, /Conéctate a internet/i);
    });
    assert.equal(intentosFallidos, 2, 'Fallo de recuperación no provoca bucle');
    assert.deepEqual(simuladoSinInternet.env, { cacheDir: 'cache-anterior', allowLocalModels: false, allowRemoteModels: true, useFSCache: false });
    await fs.writeFile(rutaOnnx, Buffer.from([8, 1]));

    await fs.unlink(rutaOnnx);
    const incompleto = crearTransformersSimulado(estadoCompleto, true);
    await conTransformersSimulado(incompleto, async () => {
      const resultado = await new ServicioVozLocal(temporal).transcribirAudioPCM(tono);
      assert.equal(resultado.exito, true, 'Permite primera descarga simulada');
    });
    await fs.writeFile(rutaOnnx, Buffer.from([8, 1]));

    const inexistente = crearTransformersSimulado(estadoCompleto, true);
    await conTransformersSimulado(inexistente, async () => {
      const resultado = await new ServicioVozLocal(path.join(temporal, 'no-existe')).transcribirAudioPCM(tono);
      assert.equal(resultado.exito, true, 'Permite primera descarga sin caché');
    });
    assert.equal(inexistente.llamadas.registro, 0, 'Sin metadatos no se consulta el registro');

    const cacheVacia = path.join(temporal, 'cache-vacia');
    await fs.mkdir(cacheVacia);
    const vacia = crearTransformersSimulado(estadoCompleto, true);
    await conTransformersSimulado(vacia, async () => {
      assert.equal((await new ServicioVozLocal(cacheVacia).transcribirAudioPCM(tono)).exito, true);
    });
    assert.equal(vacia.llamadas.pipeline, 1, 'Una raíz vacía permite la primera descarga');

    const sinRed = crearTransformersSimulado({ allCached: false, files: estadosCompletos }, false, true);
    sinRed.env.allowRemoteModels = false;
    await conTransformersSimulado(sinRed, async () => {
      const resultado = await new ServicioVozLocal(temporal).transcribirAudioPCM(tono);
      assert.equal(resultado.exito, false);
      assert.equal(resultado.estadoModelo, 'ERROR');
      assert.match(resultado.mensaje, /Faltan recursos|internet/i);
    });
    assert.equal(sinRed.env.allowRemoteModels, false);

    const errorDescarga = crearTransformersSimulado({ allCached: false, files: estadosCompletos }, true, true);
    await conTransformersSimulado(errorDescarga, async () => {
      const servicio = new ServicioVozLocal(temporal);
      assert.equal((await servicio.transcribirAudioPCM(tono)).estadoModelo, 'ERROR');
      assert.equal((await servicio.transcribirAudioPCM(tono)).estadoModelo, 'ERROR');
    });
    assert.equal(errorDescarga.llamadas.pipeline, 2, 'Reintenta después de un fallo');

    const entornoCompartido = {
      cacheDir: 'original', allowLocalModels: false,
      allowRemoteModels: true, useFSCache: false,
    };
    const politicasObservadas = [];
    const simultaneo = {
      env: entornoCompartido,
      ModelRegistry: { async is_pipeline_cached_files() { return estadoCompleto; } },
      async pipeline(_tarea, _modelo, opciones) {
        const politica = entornoCompartido.allowRemoteModels;
        politicasObservadas.push(politica);
        await new Promise((resolver) => setTimeout(resolver, 5));
        assert.equal(entornoCompartido.allowRemoteModels, politica, 'Otra instancia no debe alterar env durante la carga');
        assert.equal(opciones.local_files_only, !politica);
        return async () => ({ text: 'Frontales al 50%' });
      },
    };
    await conTransformersSimulado(simultaneo, async () => {
      const resultados = await Promise.all([
        new ServicioVozLocal(temporal).transcribirAudioPCM(tono),
        new ServicioVozLocal(path.join(temporal, 'sin-cache')).transcribirAudioPCM(tono),
      ]);
      assert.ok(resultados.every((resultado) => resultado.exito));
    });
    assert.deepEqual(politicasObservadas, [false, true]);
    assert.deepEqual(entornoCompartido, {
      cacheDir: 'original', allowLocalModels: false,
      allowRemoteModels: true, useFSCache: false,
    });
  } finally {
    // Nunca borrar una ruta calculada fuera del directorio temporal recién creado.
    if (path.resolve(temporal).startsWith(path.resolve(os.tmpdir()) + path.sep)) {
      await fs.rm(temporal, { recursive: true, force: true });
    }
  }
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

  // 7. Inspección local, política offline automática y errores con cachés aisladas
  await probarCacheYModoOffline(tono);

  console.log('Todos los casos de ServicioVozLocal (RF-06) pasaron exitosamente.');
}

ejecutarPruebas().catch((error) => {
  console.error(error);
  process.exit(1);
});
