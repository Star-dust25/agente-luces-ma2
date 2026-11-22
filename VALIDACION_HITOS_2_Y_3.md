# Validación técnica de los Hitos 2 y 3

**Actualización documental:** 22 de noviembre de 2026, rama `feature/ui-y-diccionario`, revisión de código `a55abab` al iniciar el bloque. El árbol de trabajo estaba limpio. **Evidencia histórica:** auditoría local del 20 de noviembre de 2026, registrada antes de las mejoras recientes de interfaz y del cambio de ubicación de la caché de voz. Sus resultados se conservan como observaciones de aquella fecha, sin atribuirlos a una prueba física ni repetirlos automáticamente para esta versión.

## Alcance y arquitectura actual

`frontend/src/App.tsx` coordina la interfaz, la selección de grupos, la vista previa, el historial y Deshacer. `TraductorLuces.ts` interpreta órdenes con el catálogo dinámico; `operacionesCabina.ts` construye lotes. `preload.ts` expone la API IPC limitada; `src/main.ts` valida cargas útiles, guarda ajustes, distribuye el progreso de voz y llama a `ClienteTelnetMA2`. La respuesta positiva de Telnet confirma escritura al socket, **no ejecución física** de grandMA2 onPC.

La voz sigue micrófono → PCM mono a 16 kHz → IPC → Whisper local → texto → traductor → validación → despacho. Electron guarda la configuración activa en `app.getPath('userData')/config.json`; el `config.json` de la raíz es una plantilla. El modelo se almacena en **`app.getPath('userData')/cache-modelos-voz`**, que `src/main.ts` pasa a `ServicioVozLocal`. El identificador del modelo es `Xenova/whisper-tiny`. La primera carga necesita internet si faltan recursos; las siguientes pueden usar los archivos locales. El código configura caché de sistema de archivos, pero la operación completa sin internet aún requiere un ensayo en Electron con red externa desconectada.

## Interfaz verificada en el código

| Zona | Comportamiento actual | Verificación pendiente |
| --- | --- | --- |
| Cabecera | Un indicador de conexión muestra **Conectado** tras autenticación Telnet, **Autenticando...** con socket abierto, **Conectando...**, **Reconectando...** o **Sin conexión**; en navegador muestra **Modo prueba**. A su lado están **Ajustes**, el icono con nombre accesible **Reconectar consola** y **Blackout**. | Comprobar transiciones con grandMA2 real. El icono consulta estado y configuración por IPC; no invoca directamente `ClienteTelnetMA2.conectar()`. La reconexión de red depende del cliente automático. |
| Grupos y control rápido | Cada tarjeta muestra juntos punto de color, porcentaje y barra de intensidad: son tres señales visuales del estado local del grupo. La barra de control de selección tiene niveles rápidos, slider, colores rápidos y **Rueda**. El slider cambia la vista mientras se arrastra y confirma al soltar el puntero; con teclado confirma al soltar la tecla. Los botones rápidos envían el **preset configurado** a la selección; el HEX es una referencia visual. | Comparar con el showfile: el estado local puede no reflejar ejecución física. |
| Escenas y orden | La barra **Escenas** contiene **Anterior**, **Siguiente**, campo **Escena**, **Ir** y **Detener**. **Orden de Iluminación** contiene el botón **?** de atajos, el campo de texto y **Hablar**. No hay etiquetas visibles `Control NLP` ni `Exec 1`; el executor se consulta en Ajustes o en la ayuda emergente de los controles. | Probar teclado, voz y cues en Electron. |
| Actividad y avisos | **Actividad** conserva la bitácora; su entrada más reciente tiene un destello CSS de **600 ms** en ambos temas. Hay una sola cápsula flotante centrada abajo para avisos importantes, incluidos errores, advertencias y Blackout. Los envíos habituales se registran en Actividad sin aviso de éxito por cada orden. | Revisar apariencia, contraste y lectura de avisos en Electron. |
| Color y tema | **Rueda** abre un panel mediante React Portal sobre `document.body`; presenta HEX/HSV, preset más cercano y diferencia **CIE76 (ΔE76)**. Arrastrar o cancelar solo cambia la vista previa; **Aplicar color** despacha el preset. **Ajustes** ofrece **Modo Cabina (Oscuro)** y **Modo Día (Gris Suave)**. | Inspeccionar panel, foco y contraste visualmente; el preset aproxima el color elegido y no garantiza equivalencia física. |

Al guardar **Ajustes**, el frontend aplica el catálogo nuevo al traductor y los grupos sin reiniciar. `src/main.ts` persiste la configuración; `ClienteTelnetMA2` reconecta cuando cambian host, puerto, usuario o contraseña. Los cambios de tema, catálogo y opción de voz se reflejan en caliente. No se ha probado visualmente esta secuencia en Electron.

El servicio informa `Cargando modelo de voz local (Whisper Tiny español)...`, `Cargando recurso del modelo (...)` y `Modelo de voz local listo y en caché.` mediante IPC **`ma2:progreso-voz`**; la interfaz los muestra durante **Transcribiendo...**. El texto `Cargando recurso` sirve tanto al leer caché como al descargar: **no indica por sí solo el origen de los bytes**. Para distinguir ambos casos hay que documentar una primera ejecución con caché vacía e internet y otra con caché poblada y red externa desconectada, registrando el tráfico o la ausencia de descarga. El programa no presenta una etiqueta exclusiva «Descargando».

## Resultados ejecutados en este bloque

| Comprobación | Fecha y resultado | Alcance |
| --- | --- | --- |
| `npm.cmd run build` | 22-11-2026: **APROBADO**, salida 0 | TypeScript del backend. |
| `npm.cmd --prefix frontend run build` | 22-11-2026: primer intento **FALLIDO** por `Acceso denegado` al leer `vite.config.ts` dentro del sandbox; repetición autorizada **APROBADO**, salida 0, 43 módulos transformados | TypeScript y Vite; el fallo inicial fue de permisos del entorno, no de compilación del código. |
| `npm.cmd test` | 22-11-2026: **APROBADO**, salida 0 | Ocho suites: constructor MA2, configuración, voz con ASR inyectado, Telnet simulado, seguridad, traductor, operaciones de cabina y rueda. |
| `git diff --check` | 22-11-2026: **APROBADO**, salida 0, sin errores de espacios | Diff documental. |
| Revisión de usos nuevos de `any` | 22-11-2026: **APROBADO**, ninguno introducido | Solo se editaron archivos Markdown. |

La línea `ENOTFOUND huggingface.co` en `npm.cmd test` es un fallo de red **simulado** en la suite unitaria de voz. El aviso de JSON corrupto pertenece a un caso de recuperación de configuración con archivo temporal. No son fallos de la suite.

### Evidencia histórica conservada: 20-11-2026

En esa auditoría se registraron compilaciones backend/frontend y ocho suites con salida 0. Un diagnóstico opcional, `node tests/verificarWhisperCacheOffline.cjs`, cargó un modelo real desde **una caché local existente**, con `allowRemoteModels=false`, y produjo `WHISPER_LOCAL_LISTO` en 2051 ms. Un tono sintético generó `¡Pero!`: demuestra inferencia con esos recursos, **no reconocimiento fiable de habla española**. El traductor rechazó esa cadena. Se inspeccionaron tokenizador, configuración y dos ONNX cuantizados (aproximadamente 30,7 MB y 10,1 MB) en la caché utilizada entonces. Esta evidencia no verifica que el perfil actual de Electron tenga el modelo en `app.getPath('userData')/cache-modelos-voz` ni que toda la app funcione offline. La inspección histórica de `frontend/dist` encontró JS/CSS relativos y 30 archivos Poppins locales.

También quedaron registrados, en esa fecha, el descarte de órdenes pendientes al caer o cambiar la sesión Telnet, la corrección del mensaje de progreso que antes decía «Descargando», y pruebas simuladas de ambos cambios. Se observó que leer un JSON corrupto restaura valores por defecto o plantilla sin conservar automáticamente el archivo corrupto. Las pruebas de voz unitaria inyectaron un transcriptor y comprobaron `language: 'spanish'` y `task: 'transcribe'`.

## Matriz de cumplimiento

**Estados:** APROBADO = prueba ejecutada y superada **solo en su alcance**; FALLIDO = resultado incorrecto observado; PENDIENTE MANUAL = falta ejecución en Electron o equipo físico; NO EVALUADO = no se ejecutó ni hay evidencia suficiente. **Tipos:** U = unitaria, I = integración simulada, E = inspección estática/build, V = visual, F = física, A = aceptación. La revisión de código acredita implementación, no aprueba por sí misma una prueba manual. Los resultados U/I indicados a continuación corresponden a la ejecución de `npm.cmd test` del 22-11-2026; el diagnóstico de modelo corresponde exclusivamente al 20-11-2026.

| ID | Tipo | Comprobación y evidencia | Estado | Pendiente o límite |
| --- | --- | --- | --- | --- |
| RF-06-U1 | U | `tests/servicioVozLocal.test.cjs`: PCM, silencio, normalización, error simulado y opciones de español. | APROBADO | ASR inyectado; no mide precisión de habla. |
| RF-06-I1 | I | Diagnóstico del 20-11: modelo real con caché existente, red remota prohibida y tono sintético. | APROBADO | Solo ese perfil y ese audio; no valida la ruta actual de Electron. |
| RF-06-U2 | U | `frontend/tests/traductorRF03.test.cjs`: `¡Pero!` no genera payload. | APROBADO | No cubre otras alucinaciones que formen órdenes válidas. |
| RF-06-V1 | V | **Hablar**, medidor, **Transcribiendo...**, progreso IPC y modo de confirmación. | PENDIENTE MANUAL | Probar micrófono y UI real en español. |
| RF-06-F1 | F | Primera carga con internet, caché en userData, frase hablada y autoenvío controlado. | PENDIENTE MANUAL | Registrar transcripción, comando y ausencia de envíos indebidos. |
| RNF-05-I1 | I | Diagnóstico de caché del 20-11 con `allowRemoteModels=false`; inferencia con tono. | APROBADO | No implica arranque ni flujo offline integral. |
| RNF-05-E1 | E | Build actual genera JS/CSS y fuentes locales; inspección de paquete del 20-11. | APROBADO | Acredita recursos empaquetados, no funcionamiento offline de Electron. |
| RNF-05-V1 | V | Inicio de Electron y carga de fuentes con internet externo desconectado. | PENDIENTE MANUAL | Requiere observación de la ventana real. |
| RNF-05-F1 | F | Inicio, texto, controles, escenas y voz con internet externo desconectado. | PENDIENTE MANUAL | Probar con caché actual ya poblada y showfile aislado. |
| RF-07-U1 | U | Constructor y traductor: `GoBack`, `Go`, `Goto Cue` y `Off Executor` en casos probados. | APROBADO | Confirmar executor y cue reales. |
| RF-07-I1 | I | `tests/clienteTelnetMA2.test.cjs`: login y comandos sobre servidor TCP simulado. | APROBADO | Escritura a socket, no movimiento físico. |
| RF-07-F1 | F | **Anterior**, **Siguiente**, **Escena** + **Ir**, **Detener** en grandMA2 onPC. | PENDIENTE MANUAL | Showfile de ensayo y salida aislada. |
| RNF-03-I1 | I | `tests/gestorConfiguracion.test.cjs`: persistencia, respaldo y rechazo de valores inválidos con archivos temporales. | APROBADO | Probar el archivo real de userData en Electron. |
| RNF-03-U1 | U | `frontend/tests/traductorRF03.test.cjs`: catálogo nuevo aplicado a grupo, preset y HEX. | APROBADO | Verificar guardado desde Ajustes. |
| RNF-03-I2 | I | `tests/clienteTelnetMA2.test.cjs`: destino y credenciales nuevos, corte y reconexión simulados. | APROBADO | Probar entorno de red real; observar el icono de reconexión. |
| RNF-03-V1 | V | **Modo Día (Gris Suave)**, **Modo Cabina (Oscuro)**, controles y contraste. | PENDIENTE MANUAL | No hay inspección visual actual en Electron. |
| SEG-U1 | U | Seguridad frontend y operaciones: selección, **Todos**, Deshacer, rangos y payload inválido. | APROBADO | No acredita restauración física. |
| SEG-I1 | I | Telnet simulado: órdenes pendientes fallan tras corte o cambio de destino. | APROBADO | Observar recuperación visible en Electron. |
| SEG-F1 | F | Blackout con confirmación, deduplicación y Deshacer en showfile aislado. | PENDIENTE MANUAL | **Nunca ejecutar Blackout sobre una función activa.** |
| RUEDA-U1 | U | `frontend/tests/ruedaColores.test.cjs`: coordenadas, CIE76, preset y posición. | APROBADO | Falta interacción real de puntero. |
| RUEDA-V1 | V | React Portal, panel, redimensionamiento, foco, vista previa y ambos temas. | PENDIENTE MANUAL | La captura histórica del panel no fue concluyente. |
| ACEPTACIÓN | A | Aprobación del Club de Arte y Cultura. | PENDIENTE MANUAL | No hay acta ni prueba de campo cerrada. |

## Riesgos y cierre

La cápsula muestra errores importantes, pero las órdenes entregadas normalmente solo quedan en **Actividad**. Las tarjetas de grupos representan el estado que mantiene la aplicación tras una entrega Telnet, no una lectura de luminarias. El control **Reconectar consola** consulta estado/configuración mientras el cliente Telnet se reconecta automáticamente; se debe comprobar si esa interacción satisface la expectativa del operador. La inferencia sobre un tono mostró una posible alucinación; mantener desactivado el autoenvío en los ensayos iniciales.

**RF-06, RF-07, RNF-03 y RNF-05 siguen pendientes de aceptación integral.** Faltan voz hablada real, primera descarga en un perfil limpio, operación con internet externo desconectado, revisión visual de Electron, respuesta en grandMA2 onPC y aceptación del Club. La guía complementaria contiene los pasos y la evidencia requerida.
