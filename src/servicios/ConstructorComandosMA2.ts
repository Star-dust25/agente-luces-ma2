import { ComandoLuces, TipoAccionLuz } from '../interfaces/ComandoLuces';

/**
 * Contrato para los constructores de comandos nativos de GrandMA2 (Inversión de Dependencias).
 */
export interface IConstructorComandosMA2 {
  construirComando(comando: ComandoLuces): string;
  construirComandoLogin(usuario: string, contrasena: string): string;
}

/**
 * Servicio responsable de traducir objetos tipados del frontend a sintaxis exacta
 * de línea de comandos para GrandMA2 vía Telnet (RF-04).
 */
export class ConstructorComandosMA2 implements IConstructorComandosMA2 {
  private static readonly TERMINADOR_LINEA_MA2 = '\r\n';
  private static readonly INTENSIDAD_MINIMA = 0;
  private static readonly INTENSIDAD_MAXIMA = 100;
  private static readonly EXPRESION_GRUPO_VALIDO = /^\d+(?:\s*(?:thru|\+|-)\s*\d+)*$/i;
  private static readonly EXPRESION_PRESET_COLOR_VALIDO = /^(?:4\.)?[1-9]\d?$/;
  private static readonly EXPRESION_CARACTERES_CONTROL = /[\r\n\0]/;

  /**
   * Construye la instrucción Telnet exacta que requiere la consola GrandMA2.
   * Ejemplos de salida: "Group 1 At 50\r\n" o "Group 1 At Preset 4.2\r\n"
   */
  public construirComando(comando: ComandoLuces): string {
    switch (comando.tipo) {
      case 'intensidad':
        return this.construirComandoIntensidad(comando);
      case 'color':
        return this.construirComandoColor(comando);
      default: {
        const tipoNoSoportado: never = comando.tipo;
        throw new Error(`Tipo de parámetro no soportado para GrandMA2: ${String(tipoNoSoportado)}`);
      }
    }
  }

  /**
   * Construye la sentencia de autenticación Telnet para la sesión en GrandMA2.
   */
  public construirComandoLogin(usuario: string, contrasena: string): string {
    const usuarioLimpio = this.sanitizarCredencial(usuario, 'usuario');
    const contrasenaLimpia = this.sanitizarCredencial(contrasena, 'contraseña');

    return `login ${usuarioLimpio} ${contrasenaLimpia}${ConstructorComandosMA2.TERMINADOR_LINEA_MA2}`;
  }

  /**
   * Traduce un comando de intensidad a sintaxis "Group <grupo> At <intensidad>\r\n".
   */
  private construirComandoIntensidad(comando: ComandoLuces): string {
    const grupoNormalizado = this.sanitizarGrupo(comando.grupo);
    const intensidadResuelta = this.resolverValorIntensidad(comando.accion, comando.valor);

    return `Group ${grupoNormalizado} At ${intensidadResuelta}${ConstructorComandosMA2.TERMINADOR_LINEA_MA2}`;
  }

  /**
   * Traduce un comando de color a sintaxis de preset en GrandMA2:
   * "Group <grupo> At Preset 4.<indice>\r\n".
   */
  private construirComandoColor(comando: ComandoLuces): string {
    const grupoNormalizado = this.sanitizarGrupo(comando.grupo);
    const presetNormalizado = this.normalizarPresetColor(comando.valor);

    return `Group ${grupoNormalizado} At Preset ${presetNormalizado}${ConstructorComandosMA2.TERMINADOR_LINEA_MA2}`;
  }

  /**
   * Normaliza el identificador del preset de color hacia el pool 4 de GrandMA2.
   */
  private normalizarPresetColor(valorPreset: string): string {
    const presetLimpio = valorPreset.trim();
    if (!ConstructorComandosMA2.EXPRESION_PRESET_COLOR_VALIDO.test(presetLimpio)) {
      throw new Error(
        `El preset de color "${valorPreset}" no es válido. Se esperaba un índice de preset (ej. "4.2" o "2").`
      );
    }

    return presetLimpio.includes('.') ? presetLimpio : `4.${presetLimpio}`;
  }

  /**
   * Normaliza el identificador de grupo y verifica que cumpla con la sintaxis segura de GrandMA2.
   */
  private sanitizarGrupo(grupo: string): string {
    const grupoNormalizado = grupo.trim().replace(/\s+/g, ' ');

    if (
      grupoNormalizado.length === 0 ||
      !ConstructorComandosMA2.EXPRESION_GRUPO_VALIDO.test(grupoNormalizado)
    ) {
      throw new Error(
        `El grupo "${grupo}" no es válido. Se esperaba un número o rango de GrandMA2 (ej. "1" o "1 thru 10").`
      );
    }

    return grupoNormalizado;
  }

  /**
   * Calcula y valida el nivel de intensidad final en el rango [0, 100].
   * Si la acción es "apagar", fuerza la intensidad a 0 independientemente del valor recibido.
   */
  private resolverValorIntensidad(accion: TipoAccionLuz, valorTexto: string): number {
    if (accion === 'apagar') {
      return ConstructorComandosMA2.INTENSIDAD_MINIMA;
    }

    const valorLimpio = valorTexto.trim();
    if (valorLimpio.length === 0) {
      throw new Error('El valor de intensidad no puede estar vacío.');
    }

    const valorNumerico = Number(valorLimpio);
    if (!Number.isFinite(valorNumerico)) {
      throw new Error(`El valor de intensidad "${valorTexto}" no es un número válido.`);
    }

    if (
      valorNumerico < ConstructorComandosMA2.INTENSIDAD_MINIMA ||
      valorNumerico > ConstructorComandosMA2.INTENSIDAD_MAXIMA
    ) {
      throw new Error(
        `La intensidad (${valorNumerico}) está fuera del rango permitido (${ConstructorComandosMA2.INTENSIDAD_MINIMA}-${ConstructorComandosMA2.INTENSIDAD_MAXIMA}).`
      );
    }

    return Number.isInteger(valorNumerico)
      ? valorNumerico
      : Math.round(valorNumerico * 100) / 100;
  }

  /**
   * Valida que las credenciales no contengan saltos de línea ni caracteres de control Telnet.
   */
  private sanitizarCredencial(valor: string, nombreCampo: string): string {
    const textoLimpio = valor.trim();

    if (
      textoLimpio.length === 0 ||
      ConstructorComandosMA2.EXPRESION_CARACTERES_CONTROL.test(textoLimpio)
    ) {
      throw new Error(`El campo ${nombreCampo} contiene un formato inválido para Telnet.`);
    }

    return textoLimpio;
  }
}
