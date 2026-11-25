# Informe final de investigación y aprendizajes — Hito 4

Fecha de actualización: 2026-11-25

Proyecto: ClauCode Lights 1.0.0

Estado: **cierre técnico preparado; validación presencial, Anexo C y aceptación del Club pendientes**.

## Resumen y objetivo

El objetivo es ofrecer a la cabina una aplicación de escritorio en español que traduzca texto y voz local en órdenes tipadas de iluminación, permita revisar el resultado y lo entregue por Telnet a grandMA2 onPC. Esta revisión añade separación de frases dictadas por punto seguido, valida rutas de caché equivalentes en Windows y documenta el instalador x64. La escritura correcta al socket no demuestra que grandMA2 ejecutó la orden ni que cambió una luminaria.

Fuentes de este informe: [README](README.md), [validación de Hitos 2 y 3](VALIDACION_HITOS_2_Y_3.md), [latencia RNF-06](VALIDACION_LATENCIA_RNF06.md), [empaquetado RNF-08](VALIDACION_EMPAQUETADO_RNF08.md) y [registro de evidencias Hito 4](REGISTRO_EVIDENCIAS_HITO4.md). Los estados manuales siguientes proceden del registro: las capturas se mencionan allí, pero no están adjuntas al repositorio. Los resultados automatizados y el nuevo paquete corresponden a la corrida del 25-11-2026.

## Arquitectura y flujo de una orden

1. **Renderer:** React y TypeScript en `frontend/src/App.tsx` muestran texto, vista previa, controles, actividad, Modo Cabina y Modo Día. `TraductorLuces.ts` transforma frases en payloads tipados. La validación frontend descarta ambigüedad, números inválidos y caracteres de inyección sobre la entrada original.
2. **Preload:** `src/preload.ts` expone mediante `contextBridge` una API limitada (`window.api`) con métodos IPC para comandos, estado, configuración y audio. El Renderer no recibe acceso directo al socket Telnet ni al sistema de archivos.
3. **Main:** `src/main.ts` recibe el payload por IPC, lo valida de nuevo, construye sintaxis grandMA2 mediante `ConstructorComandosMA2` y usa `ClienteTelnetMA2` para autenticar y escribir al socket. También distribuye el estado de conexión y el progreso de voz al Renderer.
4. **Telnet:** la plantilla de ensayo indica `127.0.0.1:30000`; el puerto 30000 corresponde al perfil registrado, no al benchmark. El cliente gestiona reconexión con backoff. Su cola limitada descarta la orden más antigua al llenarse y purga las pendientes con resultado fallido cuando se pierde o cambia la sesión, evitando reproducir órdenes antiguas en otro destino. Las pruebas usan un servidor simulado, no una consola real.
5. **Configuración en caliente:** `GestorConfiguracion` conserva la copia activa en `app.getPath('userData')/config.json`. Al guardar Ajustes, grupos, alias, colores, tema y voz se actualizan sin reiniciar; cambios de host, puerto o credenciales activan reconexión. La identidad de empaquetado (`name`, `appId`, `productName`) permanece estable.

## Voz local, incidente y recuperación

La ruta de voz usa muestras PCM mono a 16 kHz y `Xenova/whisper-tiny` con ONNX q8 mediante `@huggingface/transformers`. El modelo se guarda en `app.getPath('userData')/cache-modelos-voz`; una caché sana permite carga offline. La primera descarga, o la reposición de archivos dañados, necesita internet. El progreso distingue «Cargando modelo local desde caché (Whisper Tiny español)...» de la descarga remota.

H4-03 observó `Protobuf parsing failed` en el encoder ONNX, pese a tener tamaño mayor que cero. H4-03b, tras retirar solo ese encoder, observó un `preprocessor_config.json` con bytes NUL y un error de JSON. Son antecedentes **fallidos**, conservados en el registro. Después de una reparación manual selectiva, H4-03c registró una transcripción correcta; H4-06 registró voz sin Wi-Fi. Esas observaciones no validan todavía el nuevo mecanismo automático dentro del instalador.

El servicio actual valida los JSON con `JSON.parse`, pone en cuarentena solo archivos corruptos del modelo y temporales antiguos, y no toca descargas recientes. Ante error ONNX/JSON limita la recuperación a un reintento remoto, serializa la carga mediante `colaCargaModelo`, comparte la recuperación entre llamadas concurrentes y restaura las opciones globales en `finally`. Comprueba ruta real y rechaza escapes o enlaces simbólicos fuera de la caché. En Windows admite la misma raíz cuando solo cambia la mayúscula de la letra de unidad (`C:`/`c:`). Las pruebas de estos comportamientos usan archivos temporales y mocks; no descargan ni modifican la caché operativa.

## Diccionario, color y decisiones de interfaz

El traductor admite intensidades, presets de color del Pool 4 y cues/escenas. El punto final de Whisper se elimina solo al final de una cláusula; el punto seguido de espacio puede separar órdenes independientes, por ejemplo «frontales en azul. contras en rojo.». Se conservan cues decimales como `2.5` y `3.25`, presets `4.1`–`4.9` y porcentajes decimales admitidos. `50..`, `2.5.3`, punto y coma, CR, LF y `|` se rechazan sin convertirlos en órdenes válidas. Una cláusula inválida rechaza la orden compuesta completa.

La rueda estima el preset más cercano con distancia cromática CIE76 (ΔE76); el HEX es una vista previa, mientras la orden Telnet utiliza el número de preset configurado. La cabina mantiene controles rápidos, selección múltiple, historial, vista previa y Deshacer para estados de grupo representables. Modo Cabina y Modo Día y la alerta inferior conservan la distribución existente. Deshacer no revierte cues ni confirma el estado físico. La autoejecución de voz se mantiene desactivada en los ensayos iniciales para permitir revisión humana.

## Empaquetado Windows y aprendizaje

`electron-builder` genera NSIS x64 con ASAR. `build.files` y `build.asarUnpack` excluyen ONNX de Darwin, Linux y Windows arm64; el paquete conserva `win32/x64`, `onnxruntime_binding.node`, `onnxruntime.dll`, `DirectML.dll`, `dxcompiler.dll`, `dxil.dll` y `@img/sharp-win32-x64`. El campo `author` elimina su aviso previo; siguen sin configurarse icono propio ni firma de código. La inspección de ASAR comprueba la exclusión real, mientras el directorio desempaquetado comprueba que las bibliotecas nativas siguen disponibles.

| Instalador de esta corrida | Valor |
| --- | ---: |
| Ruta | `C:\Users\milen\Documents\agente-luces-ma2\release\ClauCode-Lights-1.0.0-x64.exe` |
| Tamaño exacto | **173818230 bytes** |
| Tamaño binario | **165.765982 MiB** |
| Referencia anterior proporcionada por el equipo | **221.98 MiB** |
| Reducción | **56.214018 MiB; 25.3239 %** |
| SHA-256 | `5CF1B85F1DACD6831D19D3A2D67C99C39A533C3C826911323A4495C3C5878120` |

La reducción se calcula contra la cifra de referencia del equipo, no contra una nueva medición del ejecutable antiguo. El detalle de los cinco binarios y sus tamaños consta en [RNF-08](VALIDACION_EMPAQUETADO_RNF08.md). No se instaló ni ejecutó el nuevo NSIS.

## Matriz de hitos y requisitos

Los documentos consultados no definen todos los identificadores RF/RNF. Para ellos se consigna **NO EVALUADO** en vez de atribuirles una función o aprobarlos sin evidencia. «APROBADO parcial» indica exclusivamente el alcance descrito en la columna de evidencia.

| Hito | Evidencia disponible | Estado de cierre |
| --- | --- | --- |
| Hito 1 | No hay acta o matriz específica de Hito 1 entre las fuentes consultadas. | **NO EVALUADO** en este informe. |
| Hito 2 | Código y suites para traductor, seguridad, controles, catálogo y rueda; [matriz técnica](VALIDACION_HITOS_2_Y_3.md). | **PARCIAL**; faltan verificaciones de cabina y consola indicadas en la matriz. |
| Hito 3 | Configuración, voz local, cues y pruebas simuladas; evidencia manual limitada de temas y voz en Hito 4. | **PARCIAL**; falta aceptación integral con onPC. |
| Hito 4 | Casos manuales y antecedentes en el [registro](REGISTRO_EVIDENCIAS_HITO4.md), pruebas automatizadas y paquete nuevo. | **PENDIENTE DE CIERRE** presencial, Anexo C y Club. |

| Requisito | Evidencia y límite | Estado en este informe |
| --- | --- | --- |
| RF-01 | No aparece definición verificable en las fuentes consultadas. | NO EVALUADO |
| RF-02 | Cliente Telnet, autenticación y reconexión probados en servidor simulado; consola real pendiente. | APROBADO parcial |
| RF-03 | Traductor español y rechazo de ambigüedad/inyección en suite frontend. | APROBADO automatizado |
| RF-04 | Construcción y validación de intensidad para grupos; efecto físico pendiente. | APROBADO automatizado; físico pendiente |
| RF-05 | Presets de color `4.1`–`4.9` y rueda probados en código; aplicación real pendiente. | APROBADO automatizado; físico pendiente |
| RF-06 | Whisper local con pruebas de caché y H4-03c/H4-06 registrados; recuperación nueva en Electron pendiente. | PARCIAL |
| RF-07 | Sintaxis de cues y executor en pruebas; showfile de ensayo pendiente. | APROBADO automatizado; físico pendiente |
| RF-08 | No aparece definición verificable en las fuentes consultadas. | NO EVALUADO |
| RNF-01, RNF-02 | Sin definición ni prueba específica verificable en las fuentes consultadas. | NO EVALUADO |
| RNF-03 | Persistencia y cambio de configuración simulados; H4-12 solo prueba persistencia del tema. | PARCIAL |
| RNF-04 | Sin definición ni prueba específica verificable en las fuentes consultadas. | NO EVALUADO |
| RNF-05 | Recursos locales inspeccionados y voz offline H4-06 registrada; flujo integral offline pendiente. | PARCIAL |
| RNF-06 | p95 de texto a Telnet loopback; latencia Electron/IPC/onPC pendiente. | APROBADO local; físico pendiente |
| RNF-07 | Sin definición ni prueba específica verificable en las fuentes consultadas. | NO EVALUADO |
| RNF-08 | NSIS x64 construido e inspeccionado; instalación y arranque nuevos pendientes. | APROBADO técnico; manual pendiente |

## Evidencia manual Hito 4 y pendientes

| Caso | Estado registrado | Alcance observado y lo que falta |
| --- | --- | --- |
| H4-01a, H4-01b | APROBADO | Instalación anterior y primer inicio informados; onPC estaba cerrado, sin conexión ni comandos. Probar el nuevo instalador sigue pendiente. |
| H4-02 | APROBADO | Modo Cabina y Modo Día aplicados; la persistencia se comprobó aparte en H4-12. |
| H4-03, H4-03b | FALLIDO histórico | Errores ONNX y JSON que originaron la investigación; no representan una aprobación de la recuperación automática. |
| H4-03c | APROBADO | Transcripción tras reparación manual; no prueba descarga limpia con el código nuevo. |
| H4-04 | PARCIAL / PENDIENTE MANUAL | Dictado de `frontales al 50%.` y vista previa `Group 1 At 50`; no hubo envío real. |
| H4-05 | APROBADO | Reinicio sin errores visibles; no prueba reutilización funcional posterior de voz. |
| H4-06 | APROBADO | Transcripción sin Wi-Fi; sin onPC ni controles enviados. |
| H4-07 | PARCIAL / PENDIENTE MANUAL | Vistas previas válida e inválida; no se pulsó Ejecutar ni se comprobó Telnet real. |
| H4-08, H4-09, H4-10, H4-11 | PENDIENTE MANUAL | Botones, grupos, presets, rueda y cues en consola/showfile autorizado. |
| H4-12 | APROBADO limitado | Persistió Modo Día al reiniciar; falta persistencia de otros campos operativos. |
| H4-13, H4-14, H4-15 | PENDIENTE MANUAL | Deshacer, desconexión/reconexión y latencia real con grandMA2. |

## Verificación automática de esta corrida

El 25-11-2026 finalizaron con código 0 `npm.cmd run build`, `npm.cmd --prefix frontend run build`, `npm.cmd test`, `npm.cmd run test:latencia` y `npm.cmd run dist:win`. Ambos `tsconfig.json` tienen `strict: true`; no hay usos de `any` en `src/` ni `frontend/src/`. Se ejecutaron **8 suites y 595 aserciones** (conteo instrumentado de llamadas a `node:assert/strict` en las ocho suites). Las nuevas regresiones cubren frases separadas por punto, decimales y entradas peligrosas, además de `C:`/`c:` y rutas que escapan de la caché.

El benchmark secuencial usó cuatro casos con 50 mediciones cada uno y un servidor TCP/Telnet simulado ligado a `127.0.0.1` en un puerto efímero. El **p95 total local fue 0.104 ms** y cumplió la meta local de <100 ms. La cifra no incluye clic o Enter en Electron, IPC, red hacia grandMA2, procesamiento de la consola ni respuesta de luminarias. Los resultados históricos de [RNF-06](VALIDACION_LATENCIA_RNF06.md) siguen como antecedentes separados.

## Bloque editable para validación presencial y entrega

Completar solo tras observación autorizada; no convertir una prueba automatizada o vista previa en aprobación física.

| Campo | Registro pendiente |
| --- | --- |
| Fecha, hora, operador y versión instalada | ______________________________ |
| Showfile de ensayo y confirmación de salidas físicas aisladas | ______________________________ |
| Perfil grandMA2 onPC, host/puerto y executor, sin credenciales | ______________________________ |
| H4-04/H4-07: comando enviado, respuesta visible en onPC y evidencia | ______________________________ |
| H4-08 a H4-11: controles, grupos, rueda, cues y evidencias | ______________________________ |
| H4-12: persistencia de campos operativos adicionales | ______________________________ |
| H4-13/H4-14: Deshacer y reconexión observados | ______________________________ |
| H4-15: método, muestras, p95 y respuesta en consola | ______________________________ |
| Nueva descarga/reparación Whisper desde instalador con internet y reuso offline | ______________________________ |
| Incidencias abiertas y decisión de aceptación del Club | ______________________________ |
| Anexo C: versión, fecha, responsable y firma | ______________________________ |
| Decisión eventual de pase a `main` v1.0.0, autorizante y fecha | ______________________________ |

**Anexo C: pendiente. Aceptación del Club: pendiente. Pase a `main` v1.0.0: no autorizado ni ejecutado.**
