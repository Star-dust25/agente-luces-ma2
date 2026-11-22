# Validación de latencia RNF-06: texto a Telnet loopback

**Fecha de ejecución:** 22 de noviembre de 2026 (2026-11-22T21:18:56Z, 2026-11-22T21:19:09Z y 2026-11-22T21:20:21Z). **Rama:** `feature/ui-y-diccionario`. **Meta local evaluada:** p95 del flujo medido **menor que 100 ms**. Esta medición no evalúa la reacción de grandMA2 onPC ni de luminarias.

## Objetivo y recorrido

La prueba `tests/latenciaRNF06.test.cjs` mide cada orden desde que entra al traductor hasta que un servidor TCP/Telnet simulado, ligado exclusivamente a `127.0.0.1` en un puerto efímero, recibe la línea completa. Usa componentes reales del proyecto:

1. `TraductorLuces.interpretarOrden` (texto en español → payload tipado).
2. `bloqueoDeSeguridadCompuesto` (validación del frontend).
3. `esComandoLucesValido` (validación del backend).
4. `ConstructorComandosMA2.construirComando` (sintaxis grandMA2).
5. `ClienteTelnetMA2.enviarComando` (socket real hacia loopback).
6. Recepción y verificación de la línea esperada en el servidor simulado.

El servidor simula únicamente el saludo y la confirmación de login de Telnet. El traductor, ambos validadores, el constructor y el cliente TCP no se sustituyen por mocks. La prueba usa una cuenta ficticia local y no lee la configuración operativa ni contacta grandMA2. El cliente y el servidor se cierran al finalizar.

**Segmentos medidos:** A = traducción + validación frontend + validación backend + construcción; B = desde el fin de la construcción hasta que el servidor recibe la línea (incluye llamada al cliente, escritura TCP y planificación del proceso local); C = desde el inicio de traducción hasta esa recepción. El cronómetro usa `performance.now()` de Node.js. Se inicia **después** de compilar módulos, crear el servidor y autenticar al cliente. Se excluyen carga inicial de Electron, IPC, renderizado, eventos de UI, descarga/carga de Whisper, red hacia una consola externa y reacción de grandMA2.

## Entorno y método

| Dato | Valor observado |
| --- | --- |
| Sistema | Windows `win32/x64`; Node.js `v24.21.0` |
| CPU | Intel Core i5-1135G7 a 2.40 GHz; 8 procesadores lógicos |
| Destino | `127.0.0.1`, puerto efímero distinto por ejecución (65071, 65076 y 65113) |
| Conexión | Una sesión Telnet autenticada antes del cronómetro; 1 login observado por ejecución |
| Catálogo | `TraductorLuces.restablecerCatalogoPorDefecto()`; executor predeterminado 1 y preset azul 4.7; sin lectura de `config.json` del usuario |
| Carga | 10 vueltas de calentamiento y 50 vueltas medidas por cada uno de 4 casos: 40 envíos de calentamiento y **200 muestras** por ejecución |
| Orden | Casos alternados en secuencia, un envío y su recepción confirmada antes del siguiente |
| Estadísticos | Mínimo, media aritmética, mediana, p95 por *nearest rank* (`ceil(0,95 × n)`), máximo; tiempos en ms |
| Atípicos | Regla de Tukey: valores mayores que Q3 + 1,5 × IQR. **Ninguna muestra se elimina.** |

El tiempo de cada etapa se registra por separado. Los percentiles de A y B no tienen por qué sumar el percentil de C, porque corresponden a distribuciones distintas. El tiempo B incluye una pequeña parte del propio arnés de medición; se interpreta como tiempo local hasta recepción, no como latencia de red externa. La carga del sistema operativo no se fijó y puede causar variación entre ejecuciones.

## Órdenes usadas y verificación funcional

| Texto de entrada | Línea grandMA2 esperada y recibida |
| --- | --- |
| `Frontales al 50%` | `Group 1 At 50` |
| `Contraluz en azul` | `Group 2 At Preset 4.7` |
| `siguiente escena` | `Go Executor 1` |
| `ir a escena 3` | `Goto Cue 3 Executor 1` |

La prueba compara el comando construido con el esperado, comprueba que `enviarComando` devolvió éxito y compara la línea recibida en el servidor. En cada ejecución se recibieron exactamente **240 líneas de comando** (40 de calentamiento y 200 medidas) y un login. Si una comparación falla, la prueba termina con error funcional. **No hay una aserción temporal** que haga fallar el test por carga variable de la computadora.

## Resultados reales

### Ejecución 1 — 2026-11-22T21:18:56Z

Todos los valores siguientes se calculan con **n = 200** y están en milisegundos. Los valores atípicos están incluidos en cada estadístico.

| Etapa | Mínimo | Promedio | Mediana | p95 | Máximo | Atípicos |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Traducción | 0,006 | 0,018 | 0,015 | 0,041 | 0,226 | 12 |
| Validación frontend | 0,001 | 0,004 | 0,003 | 0,007 | 0,034 | 9 |
| Validación backend | 0,001 | 0,001 | 0,001 | 0,002 | 0,011 | 5 |
| Construcción MA2 | 0,001 | 0,001 | 0,001 | 0,002 | 0,008 | 7 |
| **A. Procesamiento** | **0,009** | **0,025** | **0,021** | **0,051** | **0,272** | **10** |
| **B. Telnet loopback** | **0,036** | **0,084** | **0,059** | **0,137** | **2,877** | **14** |
| **C. Total local** | **0,045** | **0,109** | **0,078** | **0,179** | **2,911** | **14** |

| Caso (50 muestras cada uno) | Promedio | Mediana | p95 | Máximo |
| --- | ---: | ---: | ---: | ---: |
| `Frontales al 50%` | 0,098 | 0,089 | 0,199 | 0,260 |
| `Contraluz en azul` | 0,118 | 0,085 | 0,291 | 1,000 |
| `siguiente escena` | 0,083 | 0,071 | 0,140 | 0,448 |
| `ir a escena 3` | 0,137 | 0,072 | 0,181 | 2,911 |

### Ejecución 2 — 2026-11-22T21:19:09Z

Repetición completa con **n = 200**, sin excluir muestras; el servidor usó otro puerto efímero.

| Etapa | Mínimo | Promedio | Mediana | p95 | Máximo | Atípicos |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| **A. Procesamiento** | **0,009** | **0,025** | **0,022** | **0,055** | **0,143** | **12** |
| **B. Telnet loopback** | **0,036** | **0,085** | **0,061** | **0,106** | **3,084** | **5** |
| **C. Total local** | **0,045** | **0,110** | **0,080** | **0,154** | **3,117** | **5** |

### Ejecución 3 — 2026-11-22T21:20:21Z

Validación final del script con **n = 200**, sin excluir muestras.

| Etapa | Mínimo | Promedio | Mediana | p95 | Máximo | Atípicos |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| **A. Procesamiento** | **0,008** | **0,020** | **0,018** | **0,042** | **0,109** | **8** |
| **B. Telnet loopback** | **0,033** | **0,070** | **0,049** | **0,091** | **2,682** | **11** |
| **C. Total local** | **0,042** | **0,091** | **0,068** | **0,125** | **2,707** | **10** |

## Comparación con la meta

La regla definida antes de interpretar las mediciones es **p95 de C < 100 ms**. Las tres ejecuciones cumplieron esa **meta local de procesamiento y recepción en loopback**: 0,179 ms, 0,154 ms y 0,125 ms. Los máximos, 2,911 ms, 3,117 ms y 2,707 ms, también quedaron por debajo de 100 ms en estas ejecuciones, pero no se usa el máximo como criterio de aceptación. La diferencia entre pasadas y los atípicos se reportan sin descartarlos.

**RNF-06 completo permanece pendiente de validación física.** El resultado local no demuestra latencia de clic o Enter a reacción de grandMA2 ni tiempo hasta un cambio observable en iluminación. Tampoco mide el camino de botones rápidos de UI, que omite el traductor de texto, ni la captura/transcripción de voz.

## Prueba física pendiente

En una ventana autorizada por el operador, usar un showfile de ensayo con salidas aisladas. Medir desde la acción de texto o botón en Electron hasta una señal observable y registrada en grandMA2 onPC; repetir por tipo de comando y registrar p95, máximos, equipo, carga y red. Para la latencia visible de luminarias se requeriría además instrumentación de salida física segura. No ejecutar Blackout ni afectar una función activa. Solo esa evidencia puede cerrar la parte de RNF-06 relativa a la consola y a la respuesta física.

## Reproducción

Desde la raíz del repositorio, con las dependencias ya instaladas:

```powershell
npm.cmd run test:latencia
```

El script compila el backend, carga y transpila los módulos puros del frontend con la instalación TypeScript de `frontend`, arranca el servidor local, autentica el cliente y ejecuta las 40 + 200 transmisiones. No necesita Electron, internet ni grandMA2 onPC. Repite el comando para comparar ejecuciones; conserva la salida completa con fecha y condiciones del equipo. El primer intento de desarrollo falló porque TypeScript 7 de la raíz no expone `transpileModule`; se corrigió el cargador para utilizar TypeScript del frontend antes de generar estos resultados.
