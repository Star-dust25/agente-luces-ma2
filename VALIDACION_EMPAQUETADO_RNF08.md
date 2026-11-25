# Validacion de empaquetado RNF-08

Fecha: 2026-11-22

## Resultado

RNF-08 queda empaquetado y genera un instalador Windows x64. El ejecutable no fue instalado ni firmado en esta validacion.

## Configuracion

- Aplicacion: ClauCode Lights
- Version: 1.0.0, tomada de `package.json`
- Electron: 45.3.4
- electron-builder: 26.18.0
- Instalador: NSIS x64
- Directorio de salida: `release/`
- ASAR: habilitado
- Plantilla incluida: `config.json`
- Archivos incluidos: `dist/**/*`, `frontend/dist/**/*`, `config.json`, `package.json` y dependencias de produccion
- Modulo nativo desempaquetado: `node_modules/onnxruntime-node/**/*`

El proceso principal carga `dist/main.js`, `dist/preload.js` y `frontend/dist/index.html` mediante rutas relativas al paquete. La configuracion persistente usa `app.getPath('userData')/config.json` y la caché de voz usa `app.getPath('userData')/cache-modelos-voz`.

Whisper conserva `Xenova/whisper-tiny`, dtype `q8` y el bloqueo de descarga remota cuando la caché completa. No se incluyo ninguna caché privada ni modelo grande en el instalador.

## Dependencias

- Produccion: `@huggingface/transformers` 4.3.2
- Dependencia instalada por Transformers: `onnxruntime-node` 1.30.0
- Empaquetado: `electron-builder` 26.18.0

El binario Windows x64 `onnxruntime_binding.node` y `onnxruntime.dll` quedaron presentes en `app.asar.unpacked`.

## Comandos ejecutados

- `npm.cmd install --save-dev electron-builder`
- `npm.cmd run dist:win`
- `npm.cmd run build`
- `npm.cmd --prefix frontend run build`
- `npm.cmd test`
- `npm.cmd run test:latencia`
- `git diff --check`

## Resultado del instalador

- Ruta: `C:\Users\milen\Documents\agente-luces-ma2\release\ClauCode-Lights-1.0.0-x64.exe`
- Tamaño: 232763774 bytes (221.98 MiB)
- SHA-256: `EA0C55231363C35DC1489019EDA2B20131235AD098556D19EF685A10E582464D`

El ejecutable NSIS se genero correctamente en ambas ejecuciones finales de `dist:win`.

## Archivos incluidos y verificaciones

Se verifico en `release/win-unpacked/resources/app.asar` la presencia de:

- `dist/main.js`
- `dist/preload.js`
- `frontend/dist/index.html`
- `config.json`
- `node_modules/@huggingface/transformers/package.json`
- `node_modules/onnxruntime-node/package.json`

Se verifico ademas que no existen entradas de caché privada de voz en el ASAR.

Se verificaron como archivos desempaquetados:

- `onnxruntime-node/bin/napi-v6/win32/x64/onnxruntime_binding.node` (298848 bytes)
- `onnxruntime-node/bin/napi-v6/win32/x64/onnxruntime.dll` (28754232 bytes)

La version desempaquetada se inicio con su ejecutable durante 8 segundos y permanecio activa; se cerró controladamente despues. No se conecto a una consola grandMA2 operativa.

## Pruebas ejecutadas

- Backend y frontend compilan.
- `npm.cmd test`: pasa las cuatro suites backend y las cuatro suites frontend.
- `npm.cmd run test:latencia`: pasa la prueba local. C Total local p95: 0.179 ms; objetivo local declarado: menor a 100 ms.
- `npm.cmd run dist:win`: genera NSIS, sin errores.
- `git diff --check`: pasa. Git emitio una advertencia de conversion LF/CRLF de `README.md`, sin errores de whitespace.

## Errores y limitaciones

- electron-builder no estaba instalado y se añadio como dependencia de desarrollo.
- No existian `dist:win`, configuracion NSIS ni documentacion; quedaron implementados.
- electron-builder emitio advertencia por no tener autor en `package.json`.
- Electron muestra el icono predeterminado porque el proyecto no dispone de un icono configurado.
- El instalador no tiene firma de codigo por ausencia de certificado.
- No se ejecuto el instalador NSIS ni se realizo una prueba de primer arranque desde una instalacion final.
- No se descargaron ni incluyeron modelos privados.
- No se probo Whisper con voz real ni con una primera descarga completa desde el instalador.
- No se accedio a hardware grandMA2 ni se confirmo una respuesta fisica.
- No se conecto a una consola grandMA2 operativa.

## Nueva verificación técnica — 2026-11-25

Esta sección registra la corrida actual. Los 232763774 bytes y el aviso de autor descritos arriba corresponden al instalador histórico del 22-11-2026 y no al generado aquí. No se instaló ni abrió el ejecutable nuevo.

### Identidad y filtros

Se comprobaron ambos `package.json`: la raíz conserva `name: agente-luces-ma2`, versión `1.0.0`, `appId: cl.aucode.lights`, `productName: ClauCode Lights` y `author: Equipo ClauCode Lights - ITACA Arte y Cultura`; el frontend conserva `name: claucode-lights-ui`, versión `0.1.0` y `private: true`. No se cambió la identidad que determina `app.getPath('userData')`. `build.files` incluye los recursos de aplicación y dependencias de producción, y excluye explícitamente `onnxruntime-node/bin/napi-v6/{darwin,linux,win32/arm64}`. `build.asarUnpack` conserva el módulo ONNX y excluye esas mismas plataformas. La inspección posterior del ASAR comprueba que la exclusión se aplicó al paquete, no solo al desempaquetado.

`npm.cmd run dist:win` finalizó con código 0. La salida observada de electron-builder 26.18.0 no contiene el aviso de `author`. Sí informa que usa el icono predeterminado y que omite la firma porque no hay certificado configurado.

### Instalador de esta corrida

| Dato | Resultado |
| --- | --- |
| Ruta | `C:\Users\milen\Documents\agente-luces-ma2\release\ClauCode-Lights-1.0.0-x64.exe` |
| Tamaño exacto | **173818230 bytes** |
| Conversión | **165.765982 MiB**, con 1 MiB = 1048576 bytes |
| Referencia proporcionada por el equipo | **221.98 MiB** del instalador anterior |
| Reducción frente a esa referencia | **56.214018 MiB; 25.3239 %** |
| SHA-256 | `5CF1B85F1DACD6831D19D3A2D67C99C39A533C3C826911323A4495C3C5878120` |

### Inspección de `app.asar` y `app.asar.unpacked`

`app.asar` contiene las entradas `dist/main.js`, `dist/preload.js`, `frontend/dist/index.html`, `config.json` y `node_modules/@huggingface/transformers/package.json`. El índice de `node_modules/onnxruntime-node/bin/napi-v6` enumera únicamente `win32/x64` y los cinco archivos siguientes; sus archivos físicos existen en `release/win-unpacked/resources/app.asar.unpacked/node_modules/onnxruntime-node/bin/napi-v6/win32/x64`.

| Binario Windows x64 | Bytes desempaquetados |
| --- | ---: |
| `DirectML.dll` | 18527584 |
| `dxcompiler.dll` | 17986360 |
| `dxil.dll` | 1508664 |
| `onnxruntime.dll` | 28754232 |
| `onnxruntime_binding.node` | 298848 |

No hay entradas Darwin, Linux ni `win32/arm64` en el índice ASAR ni archivos de esas plataformas en el directorio ONNX desempaquetado. `@img/sharp-win32-x64` permanece en el paquete. La distribución observada coincide con los filtros esperados. Esta inspección no prueba el arranque del instalador nuevo ni una inferencia Whisper real desde él; ambas requieren validación manual.
