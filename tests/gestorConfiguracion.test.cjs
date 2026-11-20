const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  GestorConfiguracion,
  CONFIGURACION_SISTEMA_POR_DEFECTO,
} = require('../dist/servicios/GestorConfiguracion.js');
const { esConfiguracionSistemaValida } = require('../dist/interfaces/ComandoLuces.js');

console.log('Iniciando pruebas unitarias de GestorConfiguracion (RNF-03):');

const dirTemporal = fs.mkdtempSync(path.join(os.tmpdir(), 'ma2-config-test-'));

try {
  // 1. Si no existe destino ni plantilla, crea config.json por defecto en disco
  const rutaPorDefecto = path.join(dirTemporal, 'sin-plantilla', 'config.json');
  const gestorPorDefecto = new GestorConfiguracion(rutaPorDefecto);
  const configInicial = gestorPorDefecto.obtenerConfiguracion();

  assert.equal(fs.existsSync(rutaPorDefecto), true, 'Debe crear config.json en disco');
  assert.equal(configInicial.conexion.host, CONFIGURACION_SISTEMA_POR_DEFECTO.conexion.host);
  assert.equal(configInicial.conexion.puerto, 30000);
  assert.equal(configInicial.executorPorDefecto, 1);
  assert.equal(configInicial.grupos.length, 6);
  assert.equal(configInicial.colores.length, 9);
  assert.equal(configInicial.interfaz.tema, 'cabina');
  assert.equal(configInicial.interfaz.autoEjecutarVoz, false);

  // 2. Siembra desde plantilla del proyecto cuando el archivo destino aún no existe
  const rutaPlantilla = path.join(dirTemporal, 'plantilla-proyecto.json');
  const configPlantilla = {
    ...structuredClone(CONFIGURACION_SISTEMA_POR_DEFECTO),
    conexion: {
      host: '192.168.10.50',
      puerto: 30001,
      usuario: 'operador',
      contrasena: 'secreto',
    },
    executorPorDefecto: 5,
    interfaz: {
      tema: 'dia',
      autoEjecutarVoz: true,
    },
  };
  fs.writeFileSync(rutaPlantilla, JSON.stringify(configPlantilla, null, 2), 'utf8');

  const rutaDestinoSembrado = path.join(dirTemporal, 'userData', 'config.json');
  const gestorSembrado = new GestorConfiguracion(rutaDestinoSembrado, rutaPlantilla);
  const leidaDesdePlantilla = gestorSembrado.obtenerConfiguracion();

  assert.equal(fs.existsSync(rutaDestinoSembrado), true);
  assert.equal(leidaDesdePlantilla.conexion.host, '192.168.10.50');
  assert.equal(leidaDesdePlantilla.conexion.puerto, 30001);
  assert.equal(leidaDesdePlantilla.executorPorDefecto, 5);
  assert.equal(leidaDesdePlantilla.interfaz.tema, 'dia');
  assert.equal(leidaDesdePlantilla.interfaz.autoEjecutarVoz, true);

  // 3. Guardar y recargar configuración modificada
  const nuevaConfig = {
    ...structuredClone(leidaDesdePlantilla),
    conexion: {
      host: '10.0.0.12',
      puerto: 30000,
      usuario: 'iluminacion',
      contrasena: 'cabina',
    },
    executorPorDefecto: 12,
    interfaz: {
      tema: 'cabina',
      autoEjecutarVoz: false,
    },
    grupos: leidaDesdePlantilla.grupos.map((grupo) =>
      grupo.id === '1' ? { ...grupo, nombre: 'Proscenio', sinonimos: ['proscenio'] } : grupo
    ),
    colores: leidaDesdePlantilla.colores.map((color) =>
      color.id === 'rojo' ? { ...color, nombre: 'Rojo QA', preset: '4.12', hex: '#cc2233' } : color
    ),
  };
  const guardada = gestorSembrado.guardarConfiguracion(nuevaConfig);
  assert.equal(guardada.conexion.host, '10.0.0.12');
  assert.equal(guardada.executorPorDefecto, 12);

  const gestorRecargado = new GestorConfiguracion(rutaDestinoSembrado, rutaPlantilla);
  const recargada = gestorRecargado.obtenerConfiguracion();
  assert.equal(recargada.conexion.host, '10.0.0.12');
  assert.equal(recargada.conexion.usuario, 'iluminacion');
  assert.equal(recargada.executorPorDefecto, 12);
  assert.equal(recargada.interfaz.tema, 'cabina');
  assert.equal(recargada.grupos[0].nombre, 'Proscenio');
  assert.deepEqual(recargada.grupos[0].sinonimos, ['proscenio']);
  assert.equal(recargada.colores.find((color) => color.id === 'rojo').preset, '4.12');
  assert.equal(recargada.colores.find((color) => color.id === 'rojo').hex, '#cc2233');

  // 4. Rechazar configuración inválida (puerto fuera de rango, executor inválido, inyección)
  assert.equal(esConfiguracionSistemaValida(null), false);
  assert.throws(
    () =>
      gestorSembrado.guardarConfiguracion({
        ...structuredClone(nuevaConfig),
        conexion: { ...nuevaConfig.conexion, puerto: 70000 },
      }),
    /esquema válido/i
  );
  assert.throws(
    () =>
      gestorSembrado.guardarConfiguracion({
        ...structuredClone(nuevaConfig),
        executorPorDefecto: 0,
      }),
    /esquema válido/i
  );
  assert.throws(
    () =>
      gestorSembrado.guardarConfiguracion({
        ...structuredClone(nuevaConfig),
        conexion: { ...nuevaConfig.conexion, usuario: 'admin\r\nOff 1' },
      }),
    /esquema válido/i
  );
  assert.throws(
    () =>
      gestorSembrado.guardarConfiguracion({
        ...structuredClone(nuevaConfig),
        interfaz: { tema: 'neón', autoEjecutarVoz: false },
      }),
    /esquema válido/i
  );
  assert.throws(
    () => gestorSembrado.guardarConfiguracion({
      ...structuredClone(nuevaConfig),
      colores: nuevaConfig.colores.map((color) =>
        color.id === 'rojo' ? { ...color, hex: 'rojo' } : color
      ),
    }),
    /esquema válido/i
  );
  assert.throws(
    () => gestorSembrado.guardarConfiguracion({
      ...structuredClone(nuevaConfig),
      colores: nuevaConfig.colores.map((color) =>
        color.id === 'rojo' ? { ...color, preset: '5.1' } : color
      ),
    }),
    /esquema válido/i
  );

  // 5. Recuperación segura si config.json en disco está corrupto
  const rutaCorrupta = path.join(dirTemporal, 'corrupta', 'config.json');
  fs.mkdirSync(path.dirname(rutaCorrupta), { recursive: true });
  fs.writeFileSync(rutaCorrupta, '{ json roto !!!', 'utf8');
  const gestorCorrupto = new GestorConfiguracion(rutaCorrupta);
  const recuperada = gestorCorrupto.obtenerConfiguracion();
  assert.equal(recuperada.conexion.host, '127.0.0.1');
  assert.equal(recuperada.executorPorDefecto, 1);

  console.log('Todos los casos de GestorConfiguracion (RNF-03) pasaron exitosamente.');
} finally {
  fs.rmSync(dirTemporal, { recursive: true, force: true });
}
