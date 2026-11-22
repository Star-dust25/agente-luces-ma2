# Registro de evidencias — Hito 4

Fecha de inicio: 2026-11-22  
Rama verificada: `feature/ui-y-diccionario`  
Version del instalador: 1.0.0

## Reglas de registro

- **APROBADO** solo con evidencia observada para el alcance indicado.
- **FALLIDO** si el comportamiento observado no cumple el resultado esperado.
- **PENDIENTE MANUAL** si falta ejecutar o adjuntar evidencia.
- **NO EVALUADO** si no hubo condiciones para probarlo.
- Las pruebas de UI, voz y grandMA2 no se aprueban por build, código o pruebas simuladas.
- Capturas y logs deben ocultar contraseñas y datos operativos.
- No usar showfile de producción, no ejecutar Blackout y no afectar luminarias sin autorización.

## Verificaciones previas

| Comprobacion | Estado | Evidencia / nota |
| --- | --- | --- |
| Rama correcta | APROBADO | `feature/ui-y-diccionario`. |
| Instalador generado | APROBADO | `release/ClauCode-Lights-1.0.0-x64.exe`, 232763774 bytes; SHA-256 `EA0C55231363C35DC1489019EDA2B20131235AD098556D19EF685A10E582464D`. |
| Recursos esenciales y ONNX | APROBADO | Inspeccion del ASAR y binarios nativos documentada en `VALIDACION_EMPAQUETADO_RNF08.md`. |
| Perfil Telnet de ensayo | PENDIENTE MANUAL | La plantilla local contiene `127.0.0.1:30000` y credenciales configuradas. No hay showfile de ensayo autorizado ni salidas aisladas confirmadas. Se encontro `gma2onpc` escuchando en `0.0.0.0:30000`; el usuario confirmo que era seguro cerrar onPC, lo cerro normalmente y una segunda consulta confirmo que no hay listener en el puerto. No se abrio conexion; no se registran valores secretos. Mantener onPC cerrado durante H4-01b. |
| Aceptacion del Club y Anexo C | PENDIENTE MANUAL | No se recibio evidencia de validacion ni entrega formal. |

## Casos manuales

| ID | Prueba | Estado | Evidencia / resultado observado |
| --- | --- | --- | --- |
| H4-01a | Instalar sin iniciar Electron | APROBADO | El usuario informa instalacion 1.0.0 para usuario actual, sin errores y sin iniciar Electron. Captura reportada: `H4-01a_Instalacion_ClauCode.png` (no adjunta a este repositorio). |
| H4-01b | Primer inicio de Electron | APROBADO | El usuario informa que la interfaz Electron abrio y quedo `Sin conexion` con onPC cerrado. Sin error observado. Evidencia reportada: `captura1` (no adjunta a este repositorio). No se enviaron comandos ni se modificaron Ajustes. |
| H4-02 | Verificar Modo Cabina y Modo Dia | APROBADO | El usuario autorizo guardar unicamente el tema, sin modificar campos operativos. Informa que ambos temas se aplicaron sin errores; tema inicial Cabina y tema final Dia. Evidencias reportadas: `H4-02_Modo_Cabina.png`, `H4-02_Modo_Dia.png` (no adjuntas a este repositorio). La prueba no verifica persistencia tras reiniciar. |
| H4-03 | Primera descarga de Whisper con internet | FALLIDO | `Voz no procesada`; ONNX produjo `Protobuf parsing failed` al cargar `encoder_model_quantized.onnx`. No hubo transcripcion ni ejecucion. Evidencia reportada: `H4-03_Error_Whisper_ONNX.png`. Autoejecucion seguia desactivada y no se enviaron comandos. Queda pendiente diagnosticar integridad/tamano/ruta sin borrar ni descargar el modelo. |
| H4-03b | Reintento tras retirar solo el encoder | FALLIDO | ONNX ya no produjo el error protobuf. Apareció `Unexpected token '', "..." is not valid JSON`. No hubo transcripcion ni ejecucion. Evidencia reportada: `H4-03b_Error_Whisper_JSON.png`. onPC siguio cerrado, sin envio de comandos ni cambios de configuracion. |
| H4-03c | Reparar el preprocessor y repetir Whisper | APROBADO | La transcripcion termino correctamente sin repetir los errores ONNX/JSON. Texto observado: `Estoy probando Cloud Cloud.` Evidencia reportada: `H4-03c_Whisper_Transcripcion.png`. La prueba no evaluó modo offline ni comunicacion con grandMA2. |
| H4-04 | Dictar ordenes reales en espanol | PENDIENTE MANUAL/PARCIAL | Whisper reconoció `frontales al 50%.` sin ejecutar y onPC permaneció cerrado. Evidencia: `H4-04_Dictado_Orden_Sin_Ejecutar.png`. No se observó vista previa visible, por lo que falta confirmar el comando previsto y el criterio completo de envío seguro. |
| H4-05 | Cerrar y reiniciar la aplicacion | APROBADO | Reinicio limpio con onPC cerrado y puerto sin listener. No aparecieron errores ONNX/JSON ni descarga al abrir. Evidencia reportada: `H4-05_Reinicio_ClauCode.png`. La reutilizacion funcional de Whisper requiere voz posterior; no prueba modo offline ni Telnet real. |
| H4-06 | Probar Whisper con Wi-Fi desconectado | APROBADO | Con Wi-Fi/Ethernet desconectado, Whisper transcribió `Probando sin internet.` sin errores visibles. El usuario resto posteriormente la red. Evidencia: `H4-06_Whisper_Offline.png`. onPC permanecio cerrado y no se enviaron controles. |
| H4-07 | Enviar comandos escritos | PENDIENTE MANUAL/PARCIAL | Con grandMA2 cerrado se verificó que `frontales al 50 por ciento` muestra vista previa válida y una frase inválida muestra rechazo. Evidencias: `H4-07_Orden_Valida.png`, `H4-07_Orden_Invalida.png`. No se pulsó Enter/Ejecutar ni se envió Telnet; falta el envío real. |
| H4-08 | Probar botones rapidos e intensidad | PENDIENTE MANUAL | |
| H4-09 | Seleccionar grupos y presets | PENDIENTE MANUAL | |
| H4-10 | Probar rueda cromatica CIE76 | PENDIENTE MANUAL | |
| H4-11 | Probar escenas/cues con executor de ensayo | PENDIENTE MANUAL | |
| H4-12 | Verificar persistencia de Ajustes | APROBADO | Solo se evaluó persistencia visual del tema. Modo Día persistió después de cerrar y reiniciar ClauCode; sin errores. Evidencia: `H4-12_Persistencia_Tema.png`. No se modificaron campos operativos ni se enviaron controles. |
| H4-13 | Probar Deshacer | PENDIENTE MANUAL | |
| H4-14 | Probar desconexion y reconexion Telnet | PENDIENTE MANUAL | |
| H4-15 | Medir latencia real con grandMA2 onPC, si es posible | PENDIENTE MANUAL | |

Para cada caso registrar: fecha/hora local, version instalada, perfil utilizado sin secretos, pasos, resultado esperado/observado, estado final y nombres de capturas/logs. Adjuntar evidencia de Electron y onPC cuando aplique. Una entrega positiva al socket no demuestra ejecucion fisica.

## Diagnostico no destructivo de H4-03

- Versiones: `@huggingface/transformers` 4.3.2 y `onnxruntime-node` 1.30.0.
- Caché examinada: `%APPDATA%\agente-luces-ma2\cache-modelos-voz`.
- Tamaño total observado: 43622127 bytes en 8 archivos.
- Encoder: `encoder_model_quantized.onnx`, 10124910 bytes, SHA-256 `99D2782602643E38238A7D4E6A3D40AEDE5780779B5B9032888A536808D881A9`.
- Decoder: `decoder_model_merged_quantized.onnx`, 30727765 bytes, SHA-256 `6C0C125986B007D2E3734BEC84C18BDA0152071B90B87FADAC6D7764499927A0`.
- Se encontro ademas un archivo temporal de 0 bytes llamado `decoder_model_merged_quantized.onnx.tmp.19128.1pgcywh`; no se elimino.
- Prueba directa con el ONNX Runtime instalado: el encoder falla con `Protobuf parsing failed`; el decoder carga correctamente con 19 entradas y 25 salidas.
- El proceso Electron instalado seguia abierto al registrar el diagnóstico; no se abrio grandMA2 ni se cambio la configuracion.
- No se modifico, borro, movio ni descargó ninguna parte de la caché durante el diagnóstico.

### Causa probable

El encoder q8 cacheado es invalido para el ONNX Runtime instalado o esta incompleto/corrupto. No es un fallo confirmado del codigo de captura de voz ni del decoder. La ruta coincide con la utilizada por el ejecutable y el cache no contiene el encoder valido.

### Correccion propuesta, sin aplicar

Reparar solo el encoder:

1. No borrar config.json, tokenizador, preprocessor ni decoder.
2. Cerrar ClauCode Lights.
3. Hacer una copia de respaldo del encoder actual.
4. Eliminar únicamente el archivo final `encoder_model_quantized.onnx` y su archivo temporal, si existiera.
5. Reiniciar con internet y ejecutar una sola transcripcion inocua.
6. Verificar directamente que el nuevo encoder carga con ONNX Runtime antes de abrir grandMA2.

No adoptar como correccion borrar toda la caché ni descargar el modelo automáticamente hasta obtener autorizacion.

### Reparacion minima autorizada

El usuario autorizo el 2026-11-22 retirar solo el encoder y conservarlo como respaldo. ClauCode se cerro con sus procesos conocidos y no se modificaron configuraciones ni grandMA2.

- Encoder respaldado y retirado de su ruta original:
  `cache-modelos-voz\Xenova\whisper-tiny\onnx\encoder_model_quantized.onnx.corrupt-backup-20261122`
- El decoder, tokenizador, preprocesador, configuraciones y caché restante no se modificaron.
- El puerto local 30000 no tiene listener; grandMA2 sigue cerrado.
- Resultado de la descarga nueva: PENDIENTE hasta que el usuario vuelva a abrir Electron con internet y ejecute una transcripcion inocua.

## Diagnostico no destructivo de H4-03b

- El encoder retirado en H4-03b se redescargo y ahora carga con ONNX Runtime:
  10124910 bytes, SHA-256 `fd9d995b9dcb0520f0dbf6cf68651af639fc385f594d9d876e69ca2802dc438e`.
- El respaldo original sigue intacto y falla con `Protobuf parsing failed`.
- El JSON `preprocessor_config.json` tiene 339 bytes llenos de bytes NUL. Node.js no puede interpretarlo y produce `Unexpected token '', "..." is not valid JSON`.
- Los otros JSON examinados pasan:
  `config.json`, `generation_config.json` y `tokenizer_config.json`; `tokenizer.json` es valido como JSON.
- El error H4-03b procede de un recurso corrupto de preprocesamiento en la caché, no del encoder nuevo ni del ONNX Runtime.
- Transformers/ONNX instalados siguen siendo 4.3.2/1.30.0 y el ejecutable usa la misma ruta de caché y binarios nativos.

### Reconexion visible

La interfaz muestra `Reconectando...` porque el cliente Telnet programa reintentos con backoff al perder o no alcanzar `127.0.0.1:30000`. No indica que haya conectado ni enviado credenciales; el puerto sigue sin listener y grandMA2 sigue cerrado. El estado es independiente del fallo Whisper.

### Correccion propuesta, sin aplicar

Reparar solo el preprocessor:

1. Hacer respaldo de `preprocessor_config.json`.
2. Retirar ese unico archivo de la caché.
3. Mantener encoder nuevo, decoder, tokenizer y configuracion validos.
4. Cerrar Electron, confirmar el puerto Telnet cerrado y reiniciar con internet.
5. Ejecutar una sola transcripcion inocua.
6. Si vuelve a fallar, verificar directamente que el nuevo preprocessor es JSON válido antes de cualquier borrado amplio.

No se borrara toda la caché ni se modificara el codigo ni la configuracion operativa.

### Reparacion minima autorizada del preprocessor

El usuario autorizo el 2026-11-22 retirar solo `preprocessor_config.json`.

- ClauCode se cerro; no quedan procesos visibles.
- El archivo original se respaldo como `preprocessor_config.json.corrupt-backup-20261122`.
- Backup: 339 bytes, SHA-256 `33DC553C447488566B65C24B620773A09683ACC7FD05538F23CCB38746E88292`.
- El archivo original ya no existe en la ruta activa.
- El encoder nuevo, el decoder, el tokenizer y el resto de la caché no se modificaron.
- El puerto 30000 sigue sin listener y grandMA2 sigue cerrado.
- El resultado de la descarga nueva del preprocessor queda PENDIENTE hasta reabrir ClauCode con internet y ejecutar una transcripcion inocua.

## Latencia: alcance y limite

La prueba automatizada local de RNF-06 midio traduccion, validaciones, construccion y recepcion de Telnet en un servidor simulado de loopback. La ejecucion del 2026-11-22 registro p95 local de **0.179 ms** y cumplio la meta local definida (<100 ms). Esta cifra no mide el tiempo desde una accion real de UI, IPC, Electron, red hasta grandMA2, ni la respuesta de consola o luminarias. La latencia real queda **PENDIENTE MANUAL** hasta disponer de una ventana autorizada, showfile de ensayo y medicion observable en onPC; no afecta una funcion activa.

## Cierre

Hito 4 no se considera cerrado hasta completar las validaciones acordadas, registrar las evidencias del Club de Arte y Cultura y efectuar la entrega formal del Anexo C. No inferir aceptacion a partir de este registro.
