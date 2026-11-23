# Validación técnica de los Hitos 2 y 3

**Fecha:** 20 de noviembre de 2026. **Rama:** `feature/ui-y-diccionario`. **Alcance:** revisión del código y pruebas locales, sin enviar órdenes a grandMA2 onPC ni cambiar la configuración operativa. La rama ya contenía cambios sin confirmar de la rueda cromática al iniciar esta auditoría; se conservaron.

## Arquitectura revisada

`frontend/src/App.tsx` concentra la interfaz, validación previa, selección de grupos, historial y Deshacer. `TraductorLuces.ts` interpreta texto con el catálogo dinámico y `operacionesCabina.ts` arma lotes para grupos. `preload.ts` expone una API IPC limitada; `src/main.ts` valida payloads, consulta `GestorConfiguracion`, invoca `ServicioVozLocal` y entrega comandos a `ClienteTelnetMA2`. Este último construye una sesión TCP/Telnet y envía la sintaxis de `ConstructorComandosMA2`. La respuesta positiva confirma escritura al socket, **no ejecución física**.

La voz sigue la ruta micrófono → PCM mono remuestreado a 16 kHz → IPC → Whisper local → texto → traductor → validación → despacho. El archivo persistido de Electron se ubica en `app.getPath('userData')/config.json`; el `config.json` de la raíz es plantilla inicial. Las pruebas de configuración usan archivos temporales.

## Ejecución y resultados reales

| Comando o comprobación | Resultado observado |
| --- | --- |
| `npm.cmd --prefix frontend run build` | Código de salida 0; TypeScript y Vite terminaron; 43 módulos transformados. Vite necesitó ejecución fuera del sandbox de archivos para cargar `vite.config.ts`. |
| `npm.cmd run build` | Código de salida 0; compilación TypeScript del backend. |
| `npm.cmd test` | Código de salida 0; ocho suites: comandos MA2, configuración, voz, Telnet simulado, seguridad frontend, traductor, operaciones de cabina y rueda. |
| `node tests/verificarWhisperCacheOffline.cjs` | Código de salida 0 con `allowRemoteModels=false`; `WHISPER_LOCAL_LISTO`, inferencia en 2051 ms. Un tono sintético produjo `"¡Pero!"`: el audio **no demuestra reconocimiento de habla española**. |
| Inspección de `.cache-modelos-voz/Xenova/whisper-tiny` | Se encontraron configuración, tokenizador y ambos modelos ONNX cuantizados (aprox. 30,7 MB y 10,1 MB). |
| Inspección de `frontend/dist` | `index.html` referencia JS/CSS relativos y hay 30 archivos locales Poppins. No se observó una URL externa en el código fuente de frontend; la primera descarga de Whisper sí requiere acceso a Hugging Face. |
| `git diff --check` | Sin errores de espacios al cierre de la auditoría. |

La suite de voz usa un transcriptor inyectado para comprobar el paso de `language: 'spanish'` y `task: 'transcribe'`; el diagnóstico offline sí invoca el modelo real, pero con un tono, no con una frase hablada. El mensaje de error `ENOTFOUND huggingface.co` que aparece en `npm.cmd test` procede de un fallo **simulado** en la prueba unitaria.

## Matriz de cumplimiento

**Estados:** APROBADO = comprobación ejecutada y superada para el alcance indicado; FALLIDO = comprobación ejecutada con resultado incorrecto; PENDIENTE MANUAL = requiere interfaz, micrófono, aislamiento de red o consola real; NO EVALUADO = no se pudo ejecutar. U = unitaria, I = integración, A = aceptación o interfaz. Un resultado APROBADO de U/I no implica que el requisito completo esté cerrado.

| ID del requisito | Funcionalidad | Prueba realizada | Resultado | Evidencia | Estado | Pendientes |
| --- | --- | --- | --- | --- | --- | --- |
| RF-06-U1 | PCM, silencio, errores y opción española | Suite `servicioVozLocal.test.cjs` con ASR inyectado | Pasa limpieza, normalización, rechazo de audio corto/silencio y error de red simulado | `npm.cmd test`; `tests/servicioVozLocal.test.cjs` | APROBADO | Voz real y precisión no cubiertas |
| RF-06-I1 | Carga local de Whisper Tiny | Inferencia con recursos en caché y red remota prohibida | Pipeline listo; tono sintético devolvió `"¡Pero!"` | `node tests/verificarWhisperCacheOffline.cjs` | APROBADO | Verificar frase española con micrófono; el tono expone posibilidad de alucinación |
| RF-06-U2 | Protección de texto no interpretable | Traductor con salida observada `¡Pero!` | Sin payload ejecutable | `frontend/tests/traductorRF03.test.cjs` | APROBADO | No prueba todas las posibles alucinaciones de ASR |
| RF-06-A1 | Botón Voz, Alt+Espacio, Confirmar con Enter y autoenvío | Revisión de handlers y modos en `App.tsx`; sin interacción de micrófono | Flujo presente en código | `frontend/src/App.tsx` | PENDIENTE MANUAL | Probar ambos modos, pulsación corta/larga y permisos en Electron |
| RF-06-A2 | Primera descarga del modelo | No se borró ni alteró la caché operativa | Sin prueba de descarga inicial | Caché existente al auditar | PENDIENTE MANUAL | Probar en equipo limpio con internet y luego sin internet |
| RNF-05-U1 | Recursos locales del frontend | Build e inspección de referencias y fuentes | JS/CSS relativos; Poppins empaquetada localmente | `frontend/dist/index.html`, 30 archivos Poppins | APROBADO | Verificación completa con red desconectada |
| RNF-05-I1 | Whisper desde caché sin red remota | `allowRemoteModels=false` e inferencia real | Modelo ONNX cargó y ejecutó | Diagnóstico offline, salida `WHISPER_LOCAL_LISTO` | APROBADO | Probar voz hablada y arranque completo sin internet |
| RNF-05-A1 | Operación integral offline de texto, botones, rueda, presets y cues | No se desconectó físicamente internet ni se enviaron comandos reales | Sin resultado de aceptación | Restricción de entorno | PENDIENTE MANUAL | Seguir guía en laptop aislada y showfile de prueba |
| RF-07-U1 | Executor, Anterior, Siguiente, Cue X Ir y Off | Constructor, type guards y traductor | Sintaxis `GoBack`, `Go`, `Goto Cue` y `Off Executor` correcta para casos probados | `tests/constructorComandosMA2.test.cjs`; `frontend/tests/traductorRF03.test.cjs` | APROBADO | Confirmar semántica en showfile real |
| RF-07-I1 | Envío de escenas por Telnet | Servidor TCP simulado en loopback | Login y cuatro líneas de comandos recibidos; sin duplicados en el caso probado | `tests/clienteTelnetMA2.test.cjs` | APROBADO | No equivale a ejecución en grandMA2 |
| RF-07-A1 | Escenas en grandMA2 onPC | No se enviaron comandos a la consola real | Sin resultado físico | Restricción de operación | PENDIENTE MANUAL | Verificar executor y cues existentes con el operador |
| RNF-03-I1 | Lectura, escritura, respaldo y persistencia | Archivos temporales, reinicio del gestor, entrada corrupta e inválida | Conserva IP, puerto, usuario, grupos, preset, HEX, tema y autoenvío; rechaza valores inválidos | `tests/gestorConfiguracion.test.cjs` | APROBADO | Verificar interfaz de Ajustes y persistencia en Electron |
| RNF-03-U1 | Traductor actualizado al cambiar catálogo | Alias de grupo, executor, preset y HEX nuevos | Produce `Group 1 At Preset 4.12` con el catálogo cambiado | `frontend/tests/traductorRF03.test.cjs` | APROBADO | Probar edición/guardado desde Ajustes |
| RNF-03-I2 | Reconexión por puerto/usuario y caída de socket | Dos servidores Telnet simulados | Reconecta y autentica con destino nuevo; reintenta tras corte | `tests/clienteTelnetMA2.test.cjs` | APROBADO | Probar IP, credenciales y red reales en entorno autorizado |
| RNF-03-A1 | Modo Día y contraste | Revisión de reglas CSS, sin evaluación gráfica confiable | Contraste visual no medido | `frontend/src/styles.css` | PENDIENTE MANUAL | Capturas y lectura visual en Electron |
| SEG-U1 | Payloads inválidos, selección múltiple, Todos y Deshacer | Suites de seguridad y operaciones | Casos unitarios pasan; construcción de rangos y snapshots verificada | `frontend/tests/seguridadComandos.test.cjs`; `frontend/tests/operacionesCabina.test.cjs` | APROBADO | Verificar secuencia y efecto físico en showfile de prueba |
| SEG-I1 | Órdenes pendientes ante corte o cambio de destino | Cliente Telnet contra simulador, sin consola real | Tras el ajuste, las promesas pendientes fallan y no llegan al nuevo destino | `tests/clienteTelnetMA2.test.cjs` | APROBADO | Comprobar experiencia de error y recuperación en interfaz |
| SEG-A1 | Blackout, deduplicación, errores visibles, Deshacer físico | Solo revisión de flujo; ninguna pulsación real de Blackout | Sin resultado de aceptación | `frontend/src/App.tsx` | PENDIENTE MANUAL | Probar en showfile aislado y documentar evidencia |
| RUEDA-U1 | Coordenadas, CIE76, preset y posición del panel | Suite de rueda | Casos matemáticos y markup accesible pasan | `frontend/tests/ruedaColores.test.cjs` | APROBADO | Interacción real de puntero y aspecto visual |
| RUEDA-A1 | Arrastre sin envío, Cancelar, Aplicar y panel flotante | No se obtuvo una captura gráfica confiable del panel abierto | Sin conclusión visual | Intento anterior de captura de Electron agotó tiempo | PENDIENTE MANUAL | Revisar solapamiento, recorte, foco y resize |
| ACEPTACIÓN | Validación por Club de Arte y Cultura | No realizada | Hitos sin cierre de usuario | No hay acta de aceptación | PENDIENTE MANUAL | Recoger aprobación del Club tras pruebas de campo |

## Hallazgos y correcciones

1. **Corregido:** la cola Telnet retenía comandos de una sesión que se caía o cambiaba de destino. `ClienteTelnetMA2` ahora resuelve esas órdenes como fallidas antes de reconectar. La prueba con sockets simulados comprueba que `Off Executor 1/2` pendiente no se entrega tarde ni al nuevo puerto. No se cambió el formato de comandos ni IPC.
2. **Corregido:** el progreso de Whisper indicaba «Descargando» aunque el modelo estuviera en caché. Ahora indica «Cargando recurso del modelo», compatible con ambos casos.
3. **Observación sin corrección automática:** Whisper devolvió `¡Pero!` para un tono no vocal. El traductor rechazó esa cadena y no generó comando, pero el RMS por sí solo no descarta todas las alucinaciones. La exactitud del habla y el riesgo de frases erróneas válidas requieren ensayos con operadores; mantén `autoEjecutarVoz` desactivado en esas pruebas iniciales.
4. **Limitación de configuración:** al leer JSON corrupto, el gestor aplica y escribe valores por defecto (o la plantilla). La recuperación se probó, pero el archivo corrupto original no se conserva automáticamente. Guarda una copia antes de ensayos manuales.

## Archivos modificados durante esta auditoría

- `src/red/ClienteTelnetMA2.ts`: descarte de cola al perder sesión o cambiar destino.
- `src/servicios/ServicioVozLocal.ts`: texto de progreso veraz.
- `tests/clienteTelnetMA2.test.cjs`: integración con servidor simulado.
- `tests/gestorConfiguracion.test.cjs`: persistencia de grupo, preset y HEX; rechazos adicionales.
- `frontend/tests/traductorRF03.test.cjs`: catálogo actualizado y rechazo de texto ASR no interpretable.
- `tests/verificarWhisperCacheOffline.cjs`: diagnóstico opcional del modelo en caché, sin acceso remoto.
- `package.json`: incorpora la prueba Telnet a `npm.cmd test`.
- `VALIDACION_HITOS_2_Y_3.md` y `GUIA_PRUEBAS_MANUALES_HITOS_2_Y_3.md`: informe y guía.

## Conclusión

Las ocho suites automatizadas pasan, el frontend y backend compilan, la inferencia local funciona desde la caché presente y el protocolo se comporta correctamente en el simulador para los casos ejecutados. **RF-06, RF-07, RNF-03 y RNF-05 no están aceptados de extremo a extremo**: faltan micrófono y habla real, aislamiento físico de red, observación gráfica de Electron, comportamiento en grandMA2 onPC y validación del Club de Arte y Cultura. No se afirma que la iluminación física haya respondido ni que el sistema sea 100 % offline.
