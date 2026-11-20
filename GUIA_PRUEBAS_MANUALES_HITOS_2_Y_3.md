# Guía de pruebas manuales: Hitos 2 y 3

**Equipo:** laptop Windows con Electron y grandMA2 onPC. **Fecha de preparación:** 20 de noviembre de 2026. Esta guía comprueba lo que las pruebas unitarias y el servidor Telnet simulado no pueden demostrar. Registra cada resultado como APROBADO, FALLIDO o PENDIENTE MANUAL en una copia de `VALIDACION_HITOS_2_Y_3.md`.

## Preparación común

1. Acuerda con el operador una ventana de pruebas y abre un **showfile de ensayo** en grandMA2 onPC. Desconecta salidas DMX/Art-Net/sACN o usa fixtures de prueba sin luminarias conectadas. No uses el showfile del espectáculo activo.
2. Haz una copia de la configuración de usuario de Electron (`app.getPath('userData')/config.json`) y anota los valores de prueba de IP, puerto, usuario, executor y presets. El `config.json` del repositorio sirve de plantilla, no es necesariamente el archivo activo.
3. Compila con `npm.cmd --prefix frontend run build` y `npm.cmd run build`; abre la app con `npm.cmd start`. Confirma en grandMA2 que Remote Command/Telnet y la cuenta de prueba están habilitados. Usa `127.0.0.1:30000` solo si grandMA2 onPC corre en la misma laptop y ese es su puerto configurado.
4. Prepara una carpeta de evidencias con fecha. En cada captura incluye reloj, estado de conexión, acción y resultado. Oculta contraseñas y datos de producción.
5. Si aparece un comportamiento peligroso o inesperado, deja de enviar órdenes, desconecta salidas, registra pantalla y log, vuelve a la copia de configuración y avisa al operador. No repitas Blackout en un sistema en vivo.

## 1. Inicio, conexión y recursos locales

1. **Abrir:** grandMA2 onPC con showfile de ensayo y luego la ventana de ClauCode Lights en Electron.
2. **Configurar:** IP/puerto y cuenta de prueba; conexión de la laptop habilitada. Mantén `autoEjecutarVoz` desactivado.
3. **Pulsar:** **Sincronizar** y espera el estado; abre **Ajustes** para confirmar que aparecen grupos, colores y presets.
4. **Observar:** la app abre sin archivos faltantes, la fuente Poppins se ve correctamente y el estado cambia a **MA2 Autenticado** solo tras la confirmación de login.
5. **Pasa/falla:** pasa si UI, catálogo y conexión coinciden con la configuración de prueba. Falla si falta el frontend, hay fuentes sustituidas o se indica autenticación sin sesión real.
6. **Guardar:** captura completa de la app, estado de sesión en grandMA2 y hora.
7. **Si hay error:** comprueba primero IP, puerto, habilitación Telnet y cuenta; anota el mensaje exacto antes de modificar nada.

## 2. Rueda cromática, Modo Día y controles de color

1. **Abrir:** ClauCode Lights y el panel **Ajustes**; deja grandMA2 en el showfile de ensayo.
2. **Configurar:** verifica que existan presets del Pool 4. Selecciona primero un grupo; para varios, usa Ctrl+Clic en dos tarjetas. Prueba también el tema **Modo Día**.
3. **Pulsar:** **Rueda**; arrastra el indicador, pulsa **Cancelar**, vuelve a abrir y usa **Aplicar color** con un color aproximado. Repite con la ventana estrecha y con Escape/clic fuera.
4. **Observar:** el círculo completo queda dentro de un panel opaco por encima de Escenas y Actividad; no hay degradado fuera del disco. HEX, HSV, nombre, preset y diferencia se leen. Arrastrar/cancelar no crea entradas en Actividad ni líneas Telnet; Aplicar envía solo el preset mostrado a los grupos seleccionados. El panel no se corta al redimensionar y el foco vuelve al botón tras Escape/Cancelar.
5. **Pasa/falla:** pasa si la apariencia y los envíos cumplen lo anterior en Cabina y Día. Falla si algo queda tapado, si cambia una luz durante el arrastre o si el color elegido se presenta como reproducción física exacta cuando es aproximado.
6. **Guardar:** capturas con rueda abierta en ambos temas y ventana estrecha; captura de Actividad antes/después de arrastrar y línea de comando de grandMA2 tras Aplicar.
7. **Si hay error:** cancela el panel; no uses **Aplicar** de nuevo hasta guardar captura, tamaño de ventana y pasos reproducibles.

## 3. Voz con Confirmar con Enter — RF-06

1. **Abrir:** Electron y panel de **Orden de iluminación**; prepara micrófono Windows y grandMA2 en ensayo.
2. **Configurar:** en Ajustes deja **Voz: Confirmar con Enter**; concede permiso de micrófono si Windows lo solicita. La primera carga del modelo puede necesitar internet.
3. **Pulsar:** botón **Voz** para iniciar/detener, luego prueba mantenerlo presionado; repite con **Alt+Espacio**. Di una instrucción segura como «frontales al 50 por ciento» y otra no interpretable.
4. **Observar:** medidor de audio, transcripción en español dentro del campo, vista previa y **ningún envío** hasta pulsar Enter. La frase no interpretable debe quedar sin payload ejecutable y mostrar un aviso.
5. **Pasa/falla:** pasa si una frase clara se transcribe razonablemente y Enter produce el comando previsto, mientras una frase confusa no ejecuta nada. Falla si se envía antes de confirmar o queda el micrófono activo tras soltar/cancelar.
6. **Guardar:** capturas de estado Escuchando, texto transcrito, vista previa y Actividad antes/después de Enter; anota frase pronunciada y frase reconocida.
7. **Si hay error:** revisa permiso, dispositivo predeterminado y volumen; copia el mensaje exacto. Usa entrada por texto mientras se investiga.

## 4. Voz con autoenvío y salida ASR errónea — RF-06

1. **Abrir:** Ajustes de Electron y grandMA2 con salidas físicas aisladas.
2. **Configurar:** habilita `autoEjecutarVoz` solo para esta prueba con un grupo y nivel de ensayo. Asegura que el operador esté presente.
3. **Pulsar:** graba una instrucción clara; después prueba ruido de fondo y una frase sin orden de luces. Vuelve a desactivar autoenvío al terminar.
4. **Observar:** una orden clara y válida genera exactamente el payload de la vista previa; una salida ASR no interpretable no genera comando. Vigila si ruido o tonos se convierten en palabras: el diagnóstico automático produjo `¡Pero!` a partir de un tono, aunque el traductor la rechazó.
5. **Pasa/falla:** pasa si no hay envíos por frases inválidas ni duplicados y el operador puede recuperar control. Falla si una transcripción errónea válida provoca un cambio no solicitado.
6. **Guardar:** audio de prueba si la política del equipo lo permite, transcripción, Actividad, log de grandMA2 y hora; protege datos de voz personales.
7. **Si hay error:** desactiva autoenvío, registra la frase reconocida y utiliza Confirmar con Enter hasta revisar la causa.

## 5. Descarga inicial y operación sin internet — RNF-05

1. **Abrir:** una instalación de prueba o perfil nuevo de Electron, sin borrar la caché operativa del usuario; grandMA2 onPC en la misma laptop si se probarán comandos de loopback.
2. **Configurar:** con internet, realiza una primera transcripción de prueba y comprueba que la caché `Xenova/whisper-tiny` contiene tokenizador y modelos ONNX. Después desconecta internet físicamente o deshabilita la interfaz externa, conservando la comunicación local necesaria.
3. **Pulsar:** reinicia Electron; usa texto, niveles rápidos, un preset, la rueda, un cue de ensayo y Voz. Puedes repetir `node tests/verificarWhisperCacheOffline.cjs` como diagnóstico adicional.
4. **Observar:** la UI y Poppins cargan; el modelo inicia desde caché sin descarga remota; las acciones locales siguen disponibles. Verifica por separado si la conexión Telnet local continúa.
5. **Pasa/falla:** pasa solo si el flujo completo funciona sin internet externo en la laptop aislada. Falla si intenta obtener recursos indispensables de internet o si alguna acción queda bloqueada inesperadamente. El diagnóstico de caché por sí solo no concede aprobación integral.
6. **Guardar:** capturas del estado de red, app, caché sin datos sensibles, resultado de voz y registro de comandos del showfile.
7. **Si hay error:** reconecta internet solo para diagnóstico, anota recurso faltante y mensaje; no declares RNF-05 cumplido hasta repetir el ensayo offline.

## 6. Escenas y lenguaje natural — RF-07

1. **Abrir:** grandMA2 onPC con un executor de ensayo que tenga al menos tres cues conocidos, y ClauCode Lights.
2. **Configurar:** en Ajustes establece el número real de ese executor; no uses un executor del espectáculo activo.
3. **Pulsar:** **Anterior**, **Siguiente**, escribe Cue `3` y pulsa **Ir**, luego **Off**. Repite por texto con «siguiente escena», «ir a escena 3» y «detener escena».
4. **Observar:** Actividad muestra `GoBack Executor X`, `Go Executor X`, `Goto Cue 3 Executor X` y `Off Executor X`; grandMA2 confirma la transición esperada en el executor de ensayo. El número de cue inválido no debe enviarse.
5. **Pasa/falla:** pasa si cada botón y frase afecta solo al executor configurado y al cue esperado. Falla si el comando llega a otro executor, se duplica o la app indica ejecución física sin respuesta real.
6. **Guardar:** capturas de Actividad y vista de executor/cue de grandMA2 antes y después de cada paso, con hora.
7. **Si hay error:** detén la secuencia de ensayo, confirma executor y cue configurados, guarda el comando textual exacto y avisa al operador.

## 7. Ajustes, persistencia y reconexión — RNF-03

1. **Abrir:** Ajustes de Electron y copia de seguridad de `config.json` de usuario; prepara un segundo puerto o destino Telnet de ensayo autorizado.
2. **Configurar:** modifica un nombre/sinónimo de grupo, un preset y su HEX, el tema, y después IP/puerto o cuenta de prueba. Evita credenciales operativas reales.
3. **Pulsar:** **Guardar**, **Sincronizar**, cierra y reinicia Electron; vuelve a abrir Ajustes y prueba una orden con el nuevo sinónimo. Para la parte de red cambia al destino de ensayo.
4. **Observar:** valores persistidos tras reiniciar, rueda y traductor actualizados, reconexión al nuevo destino, rechazo de HEX/preset/puerto inválido. Si se cambia solo tema o colores, observa si la conexión permanece estable.
5. **Pasa/falla:** pasa si todo coincide con lo guardado y grandMA2 recibe solo órdenes destinadas al servidor de ensayo. Falla si se pierde configuración, se aceptan datos inválidos o se envía una orden antigua al nuevo destino.
6. **Guardar:** capturas de Ajustes antes/después, archivo de configuración de prueba con contraseña cubierta, estado de conexión y logs del destino.
7. **Si hay error:** restaura la copia de configuración, reinicia Electron, anota valores de entrada y mensaje exacto. No sobrescribas el archivo de producción.

## 8. Seguridad, selección, Deshacer y Blackout

1. **Abrir:** showfile de ensayo con salidas desconectadas, Electron y Actividad visibles.
2. **Configurar:** grupos de ensayo con niveles y colores conocidos; operador presente. Verifica que no haya luminarias físicas conectadas.
3. **Pulsar:** selecciona dos grupos con Ctrl+Clic y luego **Todos**; aplica nivel y preset, pulsa **Deshacer**. Intenta una orden inválida por texto. Pulsa **Blackout** una vez, espera más de 3,5 s y confirma que no actuó; solo en el showfile aislado, repite dos clics rápidos para probar confirmación.
4. **Observar:** lotes corresponden a selección, Deshacer restaura estados representables, orden inválida no llega a Telnet, primer clic de Blackout solo arma confirmación y segundo dentro del plazo envía `Group 1 thru 6 At 0`. Comprueba que no hay duplicados por doble clic accidental.
5. **Pasa/falla:** pasa si cada efecto y ausencia de efecto coincide con lo anterior. Falla si un solo clic apaga, si se envía una orden inválida o si Deshacer afecta grupos ajenos.
6. **Guardar:** vídeo/capturas del primer clic sin comando, segundo clic en ensayo, Actividad y estado de grupos antes/después de Deshacer.
7. **Si hay error:** detén pruebas de envío, conserva log y showfile de ensayo, e informa al responsable antes de repetir.

## 9. Pérdida de conexión y recuperación

1. **Abrir:** Electron y un servidor/instancia grandMA2 de ensayo; observa el indicador de conexión.
2. **Configurar:** usa un puerto o enlace de prueba que pueda cerrarse sin afectar el espectáculo.
3. **Pulsar:** cierra el servidor de ensayo mientras una orden está pendiente o antes de enviar otra; vuelve a levantarlo y pulsa **Sincronizar**. Repite cambiando a otro puerto de ensayo en Ajustes.
4. **Observar:** estado de error/reconexión, mensaje de fallo y recuperación a autenticado. Un comando pendiente de la sesión caída o del puerto anterior no debe enviarse tardíamente al destino nuevo.
5. **Pasa/falla:** pasa si el operador recibe un error claro, la interfaz deja de indicar envío exitoso y la nueva sesión no recibe órdenes obsoletas. Falla si aparece un cambio retrasado no solicitado.
6. **Guardar:** capturas de estados, hora del corte/restablecimiento y logs Telnet de ambos destinos.
7. **Si hay error:** desconecta el cliente, anota la secuencia temporal y no continúes con comandos de show hasta entender si quedan órdenes pendientes.

## Cierre de aceptación

Reúne capturas, comandos, resultados y fallos en la matriz. Entrega el expediente al Club de Arte y Cultura y solicita aprobación explícita de los Hitos 2 y 3. Una suite automatizada aprobada no sustituye esa aceptación.
