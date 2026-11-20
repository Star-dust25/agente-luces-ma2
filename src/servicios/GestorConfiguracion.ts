import * as fs from 'fs';
import * as path from 'path';
import {
  ConfiguracionSistemaMA2,
  esConfiguracionSistemaValida,
} from '../interfaces/ComandoLuces';

/**
 * Contrato para la gestión persistente de la configuración externa del sistema (RNF-03).
 */
export interface IGestorConfiguracion {
  obtenerConfiguracion(): ConfiguracionSistemaMA2;
  guardarConfiguracion(nuevaConfig: unknown): ConfiguracionSistemaMA2;
  obtenerRutaArchivo(): string;
}

export const CONFIGURACION_SISTEMA_POR_DEFECTO: ConfiguracionSistemaMA2 = {
  conexion: {
    host: '127.0.0.1',
    puerto: 30000,
    usuario: 'administrator',
    contrasena: 'admin',
  },
  executorPorDefecto: 1,
  grupos: [
    {
      id: '1',
      nombre: 'Frontales',
      descripcion: 'Luz clave y rostro de escenario',
      sinonimos: ['frontales', 'frontal', 'frente', 'rostro', 'cara'],
    },
    {
      id: '2',
      nombre: 'Contraluz',
      descripcion: 'Recorte trasero y silueta',
      sinonimos: ['contraluz', 'contraluces', 'contra', 'contras', 'trasera', 'traseras', 'back'],
    },
    {
      id: '3',
      nombre: 'Laterales',
      descripcion: 'Calles y barras laterales',
      sinonimos: ['laterales', 'lateral', 'calles', 'calle', 'side', 'costados'],
    },
    {
      id: '4',
      nombre: 'Wash Escenario',
      descripcion: 'Baño general y ambiente de piso',
      sinonimos: ['wash', 'ambiente', 'piso', 'bano', 'fondo', 'ciclorama'],
    },
    {
      id: '5',
      nombre: 'Cabezas Móviles',
      descripcion: 'Beams, spots y efectos aéreos',
      sinonimos: ['moviles', 'movil', 'cabezas', 'cabeza', 'beams', 'beam', 'spots', 'spot'],
    },
    {
      id: '6',
      nombre: 'Público / Blinders',
      descripcion: 'Cegadoras e iluminación de audiencia',
      sinonimos: ['publico', 'audiencia', 'blinders', 'blinder', 'cegadoras', 'cegadora'],
    },
  ],
  colores: [
    {
      id: 'blanco',
      nombre: 'Blanco Frío',
      preset: '4.1',
      hex: '#f8fafc',
      sinonimos: ['blanco', 'blanca', 'blancos', 'blancas', 'frio', 'white', 'neutro'],
    },
    {
      id: 'rojo',
      nombre: 'Rojo Carmesí',
      preset: '4.2',
      hex: '#ef4444',
      sinonimos: ['rojo', 'roja', 'rojos', 'rojas', 'red', 'carmesi'],
    },
    {
      "id": 'ambar',
      "nombre": 'Ámbar Cálido',
      "preset": '4.3',
      "hex": '#f59e0b',
      "sinonimos": ['ambar', 'calido', 'calida', 'naranja', 'oro', 'dorado'],
    },
    {
      id: 'amarillo',
      nombre: 'Amarillo Sol',
      preset: '4.4',
      hex: '#eab308',
      sinonimos: ['amarillo', 'amarilla', 'sol'],
    },
    {
      id: 'verde',
      nombre: 'Verde Esmeralda',
      preset: '4.5',
      hex: '#10b981',
      sinonimos: ['verde', 'verdes', 'esmeralda', 'green'],
    },
    {
      id: 'cian',
      nombre: 'Cian Turquesa',
      preset: '4.6',
      hex: '#06b6d4',
      sinonimos: ['cian', 'celeste', 'turquesa', 'agua', 'cyan'],
    },
    {
      id: 'azul',
      nombre: 'Azul Cobalto',
      preset: '4.7',
      hex: '#3b82f6',
      sinonimos: ['azul', 'azules', 'blue', 'marino', 'cobalto'],
    },
    {
      id: 'magenta',
      nombre: 'Magenta Neón',
      preset: '4.8',
      hex: '#ec4899',
      sinonimos: ['magenta', 'rosa', 'fucsia', 'neon', 'pink'],
    },
    {
      id: 'violeta',
      nombre: 'Violeta Escénico',
      preset: '4.9',
      hex: '#a855f7',
      sinonimos: ['violeta', 'morado', 'morada', 'purpura', 'lila'],
    },
  ],
  interfaz: {
    tema: 'cabina',
    autoEjecutarVoz: false,
  },
};

/**
 * Administra la lectura, validación estricta y persistencia en disco de config.json.
 */
export class GestorConfiguracion implements IGestorConfiguracion {
  private readonly rutaArchivoConfig: string;
  private readonly rutaPlantillaProyecto: string | null;

  constructor(rutaArchivoConfig: string, rutaPlantillaProyecto: string | null = null) {
    this.rutaArchivoConfig = rutaArchivoConfig;
    this.rutaPlantillaProyecto = rutaPlantillaProyecto;
  }

  public obtenerRutaArchivo(): string {
    return this.rutaArchivoConfig;
  }

  /**
   * Lee y valida la configuración desde disco.
   * Si no existe, siembra desde la plantilla del proyecto o crea una copia con valores por defecto.
   */
  public obtenerConfiguracion(): ConfiguracionSistemaMA2 {
    const desdeDestino = this.leerSiEsValida(this.rutaArchivoConfig);
    if (desdeDestino !== null) {
      return desdeDestino;
    }

    if (
      this.rutaPlantillaProyecto !== null &&
      this.rutaPlantillaProyecto !== this.rutaArchivoConfig
    ) {
      const desdePlantilla = this.leerSiEsValida(this.rutaPlantillaProyecto);
      if (desdePlantilla !== null) {
        this.persistirEnDisco(desdePlantilla);
        return desdePlantilla;
      }
    }

    const respaldo = this.clonarConfiguracion(CONFIGURACION_SISTEMA_POR_DEFECTO);
    this.persistirEnDisco(respaldo);
    return respaldo;
  }

  /**
   * Valida estrictamente la nueva configuración con Type Guard y la persiste en disco.
   */
  public guardarConfiguracion(nuevaConfig: unknown): ConfiguracionSistemaMA2 {
    if (!esConfiguracionSistemaValida(nuevaConfig)) {
      throw new Error(
        'La configuración recibida no cumple con el esquema válido de config.json (verifica host, puerto, credenciales, grupos, colores y tema).'
      );
    }

    const normalizada = this.normalizarConfiguracion(nuevaConfig);
    this.persistirEnDisco(normalizada);
    return normalizada;
  }

  private leerSiEsValida(rutaArchivo: string): ConfiguracionSistemaMA2 | null {
    try {
      if (!fs.existsSync(rutaArchivo)) {
        return null;
      }

      const contenido = fs.readFileSync(rutaArchivo, 'utf8');
      const analizado: unknown = JSON.parse(contenido);
      if (!esConfiguracionSistemaValida(analizado)) {
        console.warn(
          `[GestorConfiguracion] El archivo "${rutaArchivo}" tiene formato inválido; se aplicará respaldo por defecto.`
        );
        return null;
      }

      return this.normalizarConfiguracion(analizado);
    } catch (error: unknown) {
      const detalle = error instanceof Error ? error.message : String(error);
      console.warn(
        `[GestorConfiguracion] No se pudo leer "${rutaArchivo}": ${detalle}`
      );
      return null;
    }
  }

  private persistirEnDisco(config: ConfiguracionSistemaMA2): void {
    const directorio = path.dirname(this.rutaArchivoConfig);
    if (!fs.existsSync(directorio)) {
      fs.mkdirSync(directorio, { recursive: true });
    }
    fs.writeFileSync(this.rutaArchivoConfig, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  }

  private normalizarConfiguracion(config: ConfiguracionSistemaMA2): ConfiguracionSistemaMA2 {
    return {
      conexion: {
        host: config.conexion.host.trim(),
        puerto: config.conexion.puerto,
        usuario: config.conexion.usuario.trim(),
        contrasena: config.conexion.contrasena.trim(),
      },
      executorPorDefecto: config.executorPorDefecto,
      grupos: config.grupos.map((g) => ({
        id: g.id.trim(),
        nombre: g.nombre.trim(),
        descripcion: g.descripcion.trim(),
        sinonimos: Array.from(
          new Set(
            g.sinonimos
              .map((s) =>
                s
                  .normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '')
                  .toLowerCase()
                  .trim()
              )
              .filter((s) => s.length > 0)
          )
        ),
      })),
      colores: config.colores.map((c) => ({
        id: c.id.trim(),
        nombre: c.nombre.trim(),
        preset: c.preset.trim().includes('.') ? c.preset.trim() : `4.${c.preset.trim()}`,
        hex: c.hex.trim(),
        sinonimos: Array.from(
          new Set(
            c.sinonimos
              .map((s) =>
                s
                  .normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '')
                  .toLowerCase()
                  .trim()
              )
              .filter((s) => s.length > 0)
          )
        ),
      })),
      interfaz: {
        tema: config.interfaz.tema,
        autoEjecutarVoz: config.interfaz.autoEjecutarVoz,
      },
    };
  }

  private clonarConfiguracion(config: ConfiguracionSistemaMA2): ConfiguracionSistemaMA2 {
    return JSON.parse(JSON.stringify(config)) as ConfiguracionSistemaMA2;
  }
}
