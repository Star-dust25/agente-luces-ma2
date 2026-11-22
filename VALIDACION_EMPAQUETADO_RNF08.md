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
