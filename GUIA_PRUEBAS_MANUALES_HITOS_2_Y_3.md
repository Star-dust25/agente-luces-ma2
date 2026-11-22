# Guía de pruebas manuales: Hitos 2 y 3

**Actualizada:** 22 de noviembre de 2026 para la rama `feature/ui-y-diccionario` (revisión `a55abab` al iniciar el bloque). Sustituye los nombres de controles de la guía preparada el 20 de noviembre. **Ningún paso de esta guía está marcado como ejecutado.** Registra cada caso como APROBADO, FALLIDO, PENDIENTE MANUAL o NO EVALUADO en la matriz de `VALIDACION_HITOS_2_Y_3.md`, con fecha, versión, equipo y evidencia.

## Preparación común en Windows

1. En VS Code, abre la carpeta del proyecto y una terminal PowerShell. Ejecuta `npm.cmd --prefix frontend run build`, `npm.cmd run build` y luego `npm.cmd start`. Espera la ventana de **Electron**; una página abierta solo en navegador dice **Modo prueba** y no prueba Telnet ni Whisper mediante IPC.
2. Acuerda la ventana con el operador de grandMA2 onPC. Abre un **showfile de ensayo** con grupos, presets y un executor conocidos. Aísla salidas físicas DMX, Art-Net y sACN o usa fixtures de ensayo sin luminarias conectadas. **Nunca ejecutes Blackout sobre una función activa.** No uses un showfile de producción.
3. Abre **Ajustes → Conexión & Cabina**. Anota IP/host, puerto Telnet, cuenta de ensayo y **Executor por defecto (Cues)**. Habilita la consola para Remote Command/Telnet según la instalación. Usa `127.0.0.1:30000` únicamente si onPC comparte laptop y ese puerto corresponde a su configuración. En **Grupos (G1–G6)** y **Colores (4.1–4.9)** verifica las entradas del showfile.
4. Antes de cambiar ajustes, copia el archivo activo `app.getPath('userData')/config.json` a una carpeta de ensayo. El `config.json` del repositorio es plantilla. Oculta contraseña y datos operativos en capturas. Crea una carpeta de evidencias con fecha, versión, hora de Windows y nombre de cada caso; guarda capturas de Electron y de onPC, y logs cuando corresponda.
5. Mantén desmarcada **Auto-ejecutar comandos dictados por voz (por seguridad en vivo se recomienda desactivado)** salvo durante la prueba controlada de autoenvío. Si observas una orden inesperada, detén los envíos, conserva capturas/logs y avisa al operador. Reanuda solo tras comprobar la causa en el showfile aislado.

Una entrada de **Actividad** con «Comando entregado a Telnet; ejecución física no confirmada.» confirma entrega al socket. Para aprobar un efecto físico, compara también el estado de grandMA2 onPC y del showfile. La cápsula inferior muestra avisos importantes; los envíos normales quedan en Actividad.

## 1. Inicio, conexión e indicadores

- **Objetivo:** comprobar inicio de Electron, recursos locales y estados de conexión.
- **Preparación:** showfile de ensayo abierto, Telnet y cuenta de prueba configurados; mantén internet disponible para este caso.
- **Pasos en Electron:** abre la app; observa la cabecera antes y después del login; pulsa el **icono Reconectar consola** (ayuda emergente y nombre accesible); abre **Ajustes** y revisa grupos y colores. Con el operador, corta y restablece solo la conexión de ensayo para observar estados.
- **Resultado esperado:** la cabecera muestra **Conectando...** o **Reconectando...** durante intentos, **Autenticando...** con socket abierto y **Conectado** tras confirmación de login; ante error, **Sin conexión**. Poppins y el catálogo aparecen. El icono refresca estado/configuración; el cliente Telnet gestiona los reintentos automáticos.
- **Criterio de aprobación:** los estados corresponden a la sesión real y la vista carga sin recursos faltantes. No atribuyas una reconexión al icono si solo coincidió con un reintento automático.
- **Evidencia:** capturas de cada estado con hora, detalle del indicador al pasar el puntero, estado de login en onPC y log de conexión.
- **Ante fallo:** registra texto exacto y hora; comprueba host, puerto, credenciales y habilitación Telnet antes de repetir.

## 2. Disposición, slider, Actividad y temas

- **Objetivo:** verificar la organización actual y el comportamiento visible de intensidad y avisos.
- **Preparación:** grupos de ensayo seleccionables, salidas aisladas y Actividad visible. Anota intensidad inicial en onPC.
- **Pasos en Electron:** observa una tarjeta de grupo y selecciona dos con Ctrl+Clic; abre el botón **?** junto a **Orden de Iluminación**; arrastra el slider de intensidad y mantenlo sin soltar, luego suéltalo. Repite con teclado. Abre **Ajustes → Conexión & Cabina**, guarda **Modo Día (Gris Suave)** y luego **Modo Cabina (Oscuro)**. Provoca solo un error inocuo de entrada para comprobar el aviso, sin enviar una orden peligrosa.
- **Resultado esperado:** cada tarjeta reúne punto de color, porcentaje y barra de intensidad; la cabecera separa el estado de conexión, **Ajustes**, icono de reconexión y **Blackout**. La barra **Escenas** queda entre grupos y paneles. No aparecen etiquetas visibles `Control NLP` ni `Exec 1`. El slider muestra el valor mientras se arrastra y envía una orden al soltar; con teclado, al soltar la tecla. La entrada nueva de **Actividad** destella aproximadamente **600 ms**. Un solo aviso en cápsula inferior central muestra errores/cambios importantes; no aparece un aviso de éxito por cada envío. **?** despliega atajos, incluido Alt + Espacio.
- **Criterio de aprobación:** un cambio de slider produce un solo comando final, el diseño es legible en ambos temas y los avisos no tapan los controles. La prueba visual no acredita que una luminaria haya respondido.
- **Evidencia:** video corto del arrastre antes/después de soltar, Actividad, comando de onPC, capturas de ambos temas y del aviso con hora.
- **Ante fallo:** deja de mover el control, conserva el valor enviado y una grabación reproducible; restaura el nivel del showfile con el operador.

## 3. Colores rápidos y rueda cromática

- **Objetivo:** comprobar presets rápidos, selección de color aproximada y panel flotante.
- **Preparación:** presets válidos del Pool 4 en el showfile; selecciona un grupo y luego dos grupos con Ctrl+Clic. Mantén salidas aisladas.
- **Pasos en Electron:** pulsa un botón redondo de color rápido; coteja su `title` con el preset enviado. Abre **Rueda**, arrastra el indicador y pulsa **Cancelar**; vuelve a abrir, usa flechas del teclado, pulsa **Aplicar color** y repite en ventana estrecha, **Modo Día (Gris Suave)** y **Modo Cabina (Oscuro)**. Comprueba Escape y clic fuera.
- **Resultado esperado:** el botón rápido envía el preset configurado a la selección, no un valor HEX directo. La rueda aparece por encima del contenido (React Portal), muestra HEX, HSV, preset más cercano y diferencia ΔE76 cuando hay aproximación. Arrastrar, teclas y Cancelar no envían; **Aplicar color** envía el preset mostrado. Escape/Cancelar devuelven el foco al botón **Rueda**; verifica el comportamiento al cerrar por clic fuera por separado. El panel no se corta al redimensionar.
- **Criterio de aprobación:** comandos y grupos destino coinciden con la vista previa; la comparación CIE76 se presenta como aproximación, no como igualdad física de color; el panel sigue usable en ambos temas.
- **Evidencia:** capturas con rueda abierta y ventana estrecha, Actividad antes/después de Cancelar y Aplicar, línea de comando y preset activo en onPC.
- **Ante fallo:** pulsa **Cancelar** o Escape, registra color elegido, preset mostrado, tamaño de ventana y pasos; no repitas **Aplicar color** antes de revisar el destino.

## 4. Voz hablada en español con confirmación — RF-06

- **Objetivo:** validar micrófono, transcripción real en español y envío solo tras Enter.
- **Preparación:** micrófono y permisos de Windows listos; en **Ajustes → Conexión & Cabina**, deja desmarcada **Auto-ejecutar comandos dictados por voz (por seguridad en vivo se recomienda desactivado)**. Selecciona un grupo de ensayo y verifica que el modelo esté cargado o que haya internet para la primera carga.
- **Pasos en Electron:** pulsa **Hablar** para empezar y de nuevo para detener; repite manteniéndolo presionado al menos 320 ms y soltando; prueba **Alt + Espacio** desde la ventana. Pronuncia una frase segura y conocida, por ejemplo «frontales al 50 por ciento» si «frontales» es un alias configurado. Pronuncia también una frase sin orden de iluminación. Revisa el texto y la vista previa antes de presionar Enter.
- **Resultado esperado:** aparecen **Escuchando...**, medidor y **Transcribiendo...**; el texto reconocido queda en la orden. El progreso de modelo llega por `ma2:progreso-voz` durante la transcripción. No hay envío hasta Enter cuando autoejecución está desmarcada. Una frase no interpretable no genera payload ejecutable. Los textos de progreso dicen «Cargando…»; no prueban por sí solos si hubo descarga.
- **Criterio de aprobación:** la frase española se reconoce de forma suficiente para producir exactamente el comando previsto y solo Enter lo envía; la frase inválida no llega a Telnet. Si el micrófono falla, registra FALLIDO para este caso aunque pase la prueba unitaria de ASR.
- **Evidencia:** frase pronunciada y transcripción literal, capturas de los tres estados, vista previa, Actividad antes/después de Enter, comando de onPC y hora.
- **Ante fallo:** revisa permiso, dispositivo y nivel de entrada en Windows; anota el mensaje y continúa por texto mientras se investiga.

## 5. Voz con autoenvío controlado — RF-06

- **Objetivo:** comprobar el modo automático y la protección ante transcripciones erróneas.
- **Preparación:** operador presente, showfile aislado, grupo y nivel seguros. Primero completa el caso 4. La auditoría del 20-11 observó que un tono sintético produjo `¡Pero!`, rechazado por el traductor; no garantiza rechazo de toda alucinación.
- **Pasos en Electron:** marca **Auto-ejecutar comandos dictados por voz (por seguridad en vivo se recomienda desactivado)** y guarda; usa **Hablar** con una orden clara de ensayo; después prueba ruido de fondo y una frase sin orden. Desmarca y guarda la opción al terminar.
- **Resultado esperado:** una transcripción válida despacha una vez el comando previsto; una salida no interpretable no envía. Actividad registra los intentos y los errores importantes aparecen en la cápsula inferior.
- **Criterio de aprobación:** no hay envíos duplicados o por frases inválidas y el operador confirma el efecto esperado. Si una alucinación forma una orden válida inesperada, marca FALLIDO y suspende autoenvío.
- **Evidencia:** transcripción literal, audio solo si se permite, Actividad, log de onPC, nivel antes/después y hora; protege datos personales de voz.
- **Ante fallo:** desmarca autoejecución, guarda el texto reconocido y usa el modo de confirmación hasta corregir la causa.

## 6. Primera descarga, caché y trabajo sin internet — RNF-05

- **Objetivo:** distinguir primera descarga de carga local y evaluar el flujo offline integral.
- **Preparación:** utiliza un **perfil de Electron de ensayo** o una instalación de prueba; haz copia de la caché operativa y no la borres. La ruta del perfil bajo prueba debe corresponder a `app.getPath('userData')/cache-modelos-voz`. Prepara internet para la primera fase y grandMA2 onPC local con salidas aisladas para la segunda.
- **Pasos en Electron:** con caché de ensayo vacía e internet activo, inicia una transcripción con **Hablar**; guarda mensajes de **Transcribiendo...**, progreso, actividad de red y contenido creado en `cache-modelos-voz` (modelo `Xenova/whisper-tiny`). Cierra Electron. Desconecta el acceso a internet externo sin interrumpir el enlace local con onPC; reinicia Electron y repite voz hablada, texto, niveles rápidos, colores, **Rueda** y una escena de ensayo. El diagnóstico opcional `node tests/verificarWhisperCacheOffline.cjs` puede usar una ruta explícita, pero su tono no reemplaza estas pruebas.
- **Resultado esperado:** la primera fase obtiene y guarda los recursos que falten; la segunda los lee desde caché sin descarga remota, mientras la UI y los comandos locales continúan. El mensaje `Cargando recurso del modelo (...)` puede aparecer en ambas fases: distingue el origen con la red y la ruta, no con ese texto.
- **Criterio de aprobación:** RNF-05 solo se aprueba si **todo** el flujo indicado funciona sin internet externo, incluida voz hablada y Telnet local. Una inferencia aislada con `allowRemoteModels=false` no basta.
- **Evidencia:** fecha, versión, perfil usado, estado de red en ambas fases, mensajes IPC visibles, ruta y tamaño de caché sin secretos, transcripción, Actividad y respuesta del showfile.
- **Ante fallo:** registra recurso o error faltante; recupera internet solo para diagnóstico. Mantén RNF-05 PENDIENTE MANUAL o FALLIDO según lo observado y repite el ensayo completo tras corregir.

## 7. Escenas y lenguaje natural — RF-07

- **Objetivo:** verificar cues y executor configurado con acciones físicas observables en el showfile.
- **Preparación:** executor de ensayo con al menos tres cues conocidos; anota número y estado inicial en onPC. Salidas físicas aisladas.
- **Pasos en Electron:** establece **Executor por defecto (Cues)** en **Ajustes → Conexión & Cabina** y guarda. En **Escenas** pulsa **Anterior**, **Siguiente**, escribe `3` en **Escena** y pulsa **Ir**, luego **Detener**. Repite por texto «siguiente escena», «ir a escena 3» y «detener escena». Prueba un número de escena inválido sin forzar su envío.
- **Resultado esperado:** Actividad registra `GoBack Executor X`, `Go Executor X`, `Goto Cue 3 Executor X` y `Off Executor X` según cada acción; onPC muestra la transición correspondiente. Un cue inválido se rechaza. **Escena** y **Detener** son los nombres visibles actuales.
- **Criterio de aprobación:** cada orden afecta solo al executor de ensayo y al cue previsto, sin duplicados. La escritura Telnet no basta para aprobar el resultado físico.
- **Evidencia:** capturas de Actividad y onPC antes/después de cada acción con hora, executor y cue.
- **Ante fallo:** detén la secuencia de ensayo, conserva comando exacto y compara executor configurado con el showfile antes de repetir.

## 8. Ajustes en caliente, persistencia y reconexión — RNF-03

- **Objetivo:** verificar catálogo, tema y conexión actualizados sin reiniciar, y persistencia al reiniciar.
- **Preparación:** copia de `app.getPath('userData')/config.json`, dos destinos/puertos Telnet de ensayo autorizados y alias de grupo de prueba.
- **Pasos en Electron:** en **Ajustes**, modifica un alias en **Grupos (G1–G6)**, un preset y HEX válidos en **Colores (4.1–4.9)** y el tema en **Conexión & Cabina**; pulsa **Guardar** y prueba el alias, color rápido y rueda **antes de cerrar la app**. Reabre Ajustes para comprobar los valores. Después cambia host/puerto o credenciales de ensayo, guarda, observa el indicador, cierra y reinicia Electron. Prueba entradas inválidas de puerto, preset y HEX sin guardar un cambio válido accidental.
- **Resultado esperado:** traductor, grupos, rueda y tema reflejan el catálogo nuevo en caliente; el cambio de red provoca reconexión automática al destino nuevo; la configuración válida persiste. Los valores inválidos muestran error y no se guardan. El icono **Reconectar consola** refresca estado/configuración, pero no fuerza directamente `conectar()`.
- **Criterio de aprobación:** valores correctos antes/después de reiniciar y ninguna orden anterior entregada al nuevo destino. Un cambio solo visual no debería cortar la sesión Telnet.
- **Evidencia:** capturas de Ajustes y ambos temas, comando con alias/preset nuevo, archivo de prueba con contraseña cubierta y logs de ambos destinos.
- **Ante fallo:** restaura la copia de configuración, reinicia Electron y conserva valores ingresados, mensaje y hora; no sobrescribas el archivo operativo.

## 9. Seguridad, selección, Deshacer y Blackout

- **Objetivo:** comprobar protección de órdenes y restauración en un showfile seguro.
- **Preparación:** **solo** showfile de ensayo, salidas físicas aisladas, operador presente, grupos con niveles y colores conocidos. Nunca uses Blackout en una función activa.
- **Pasos en Electron:** selecciona dos grupos con Ctrl+Clic y luego **Todos**; aplica nivel y color, usa **Deshacer** y prueba una orden inválida por texto. Pulsa **Blackout** una vez, espera más de 3,5 s y comprueba que no se envió. Solo si la instalación sigue aislada, pulsa dos veces dentro de 3,5 s para confirmar; registra la cápsula crítica.
- **Resultado esperado:** lotes afectan la selección, Deshacer restaura estados representables, la orden inválida no llega a Telnet y el primer clic de Blackout solo arma **¿Confirmar Blackout?**. Tras expirar el plazo no se envía; la segunda pulsación dentro del plazo envía `Group 1 thru N At 0`, donde N es el número de grupos configurados. Actividad registra la entrega y la cápsula avisa de Blackout.
- **Criterio de aprobación:** ausencia de envío con un solo clic o tras el plazo, grupos destino correctos y respuesta del showfile sin órdenes duplicadas. La reversión física se juzga en onPC, no solo en tarjetas locales.
- **Evidencia:** video de ambas secuencias, Actividad, aviso, comandos y estados de grupos antes/después en onPC, con hora.
- **Ante fallo:** detén las pruebas, conserva logs y showfile, e informa al operador antes de cualquier repetición.

## 10. Corte de conexión y recuperación

- **Objetivo:** comprobar errores visibles, descarte de órdenes pendientes y regreso a una sesión autenticada.
- **Preparación:** servidor o instancia de ensayo cuyo enlace pueda cortarse sin afectar otra operación; dos destinos de ensayo si se prueba cambio de puerto.
- **Pasos en Electron:** con **Conectado** visible, corta el servidor de ensayo antes o durante un envío seguro; observa la cabecera, cápsula y Actividad. Restablece el servidor; observa el reintento automático y pulsa el icono **Reconectar consola** para refrescar la vista. Repite cambiando al segundo puerto desde **Ajustes** y comprueba ambos logs.
- **Resultado esperado:** aparece **Sin conexión** o **Reconectando...**, el envío fallido se registra, y tras confirmar login vuelve **Conectado**. Una orden pendiente de la sesión anterior no llega tarde ni al nuevo destino. El icono por sí solo no garantiza un nuevo intento inmediato.
- **Criterio de aprobación:** mensaje claro y sin cambios retrasados en el showfile ni órdenes obsoletas en el segundo servidor.
- **Evidencia:** hora del corte/restablecimiento, capturas de estados y avisos, Actividad y logs de ambos destinos.
- **Ante fallo:** no envíes más órdenes; registra la línea temporal y revisa la cola/sesión antes de reanudar.

## Cierre de aceptación

Anota fecha, versión, resultado y vínculo a la evidencia de cada caso en la matriz. Los casos sin ejecución siguen PENDIENTE MANUAL; marca NO EVALUADO cuando no hubo condiciones para ensayarlos. Entrega el expediente al Club de Arte y Cultura y solicita su aceptación explícita. Las suites automáticas y la existencia de código no sustituyen esa aceptación.
