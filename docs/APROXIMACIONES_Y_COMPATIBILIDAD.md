# Aproximaciones y compatibilidad comprobada

Este documento separa tres cosas: lo que está **documentado** por el fabricante, lo que el simulador **simplifica**, y lo que es una **ampliación educativa**. Fecha de la revisión: 3 de noviembre de 2026.

## 1. Fuentes revisadas

| Fuente | Qué se obtuvo |
|---|---|
| Extensión del carro `YahboomTechnology/Tiny-bitLib` (`main.ts`, v2.0.3) | Nombres, parámetros y comportamiento de las funciones `Tinybit.*`. Se leyó el código completo. |
| Extensión de visión `YahboomTechnology/K210-Module` (`main.ts`, v1.0.1) | Funciones `k210_models.*` y el formato de las tramas serie (`$` + clase de 2 cifras + datos + `#`). |
| Curso «3.12.2 Autopilot» de Yahboom (yahboom.net/study/Tinybit-Pro/7870) | Señales que atiende el ejemplo oficial y el diagrama de flujo. El programa solo aparece en capturas. |
| Curso «Parsing K210 protocol data» (7715) | Puerto serie P1 (TX) / P2 (RX) a 115200; valores que devuelven los bloques. |
| Repositorio `YahboomTechnology/TinybitPro` | Solo contiene material de montaje en GitHub; el código del curso está en carpetas de Google Drive. |
| makecode.microbit.org | Se probó el código exportado con la extensión oficial añadida desde GitHub. |

## 2. Capacidades documentadas del equipo (usadas en el simulador)

| Elemento | Dato documentado | En el simulador |
|---|---|---|
| Motores | `Tinybit.car_sport(izq, der)` con valores −255…255. Al cambiar el patrón de sentido, la función hace `basic.pause(100)`. | Igual, incluida la pausa de 100 ms. |
| Movimientos predefinidos | `CarCtrlSpeed(CarState.Car_Run/Back/Left/Right/SpinLeft/SpinRight, v)`. `Car_Left` solo mueve la rueda derecha; `Car_SpinLeft` invierte la izquierda. | Igual (bloque «mover … a velocidad»). |
| Sensores de línea | `Line_Sensor(LeftState/RightState, White/Black)`: lectura digital de P13 (izq.) y P14 (der.); `Black` = 1. | 1 = negro, 0 = blanco. |
| Ultrasonido | `Ultrasonic_CarV2()` (micro:bit V2) y `Ultrasonic_Car()` (V1) devuelven cm enteros; sin eco devuelven **0**. Alcance indicado por Yahboom: ≈3–450 cm. | Devuelve 0 sin eco; alcance 2–400 cm; cm enteros. |
| Faros RGB | `RGB_Car_Big(enColor.Red…)`, colores OFF, Red, Green, Blue, White, Cyan, Pinkish, Yellow. | Igual. |
| Matriz LED | `basic.showIcon` / `showArrow` hacen una pausa de 600 ms. | Igual: el bloque tarda 0,6 s. |
| «repetir continuamente» | `basic.forever` cede al menos 20 ms por vuelta. | Igual. |
| Visión K210 | Se comunica por serie; el ejemplo Autopilot usa `object_detect()` (clase 09) y su propio programa (`3.12_Autopilot.py` + `tinybit_AI.kmodel`) en la tarjeta TF del K210. | **Simulada** (ver §3). |
| Señales del ejemplo oficial | Girar a la izquierda, girar a la derecha, límite de velocidad, fin del límite, claxon, semáforo rojo/verde, estacionamiento 1 y 2. | Disponibles en el simulador y en el editor. |

## 3. Simplificaciones del simulador (aproximaciones ajustables)

Todas están en `src/core/config.ts`.

| Parámetro | Valor | Motivo |
|---|---|---|
| Diámetro de rueda | 4,3 cm | Estimado de fotografías. |
| Distancia entre ruedas | 8,4 cm | Estimado. |
| Velocidad con PWM 255 | 40 cm/s, relación lineal, sin zona muerta | No publicada; en el robot real hay zona muerta y diferencias entre motores. |
| Respuesta del motor | Retardo de primer orden de 0,06 s | Para que los arranques no sean instantáneos. |
| Sensores de línea | A 4,6 cm por delante del eje, separados 1,4 cm; leen una mancha de 0,35 cm | Estimado. Con línea de 2,4 cm, centrado = «1 y 1». |
| Línea negra | 2,4 cm de ancho, piezas de pista de 30 cm | Aproximación del tapete; ajustable. |
| Ultrasonido | Cono de ±15° calculado de forma continua (sin huecos entre rayos). Cajas y personas se detectan en todo el cono; los postes delgados de señales y semáforos solo dentro de ±8° | Típico del HC-SR04: los objetos delgados devuelven poco eco fuera del eje. No modela ecos múltiples ni superficies blandas. |
| Cámara | 12,5 cm de altura, 8° hacia abajo, campo horizontal de 60° | Estimado del montaje con el soporte. |
| Reconocimiento | Se reconoce una señal si está dentro del campo, entre 7 y 55 cm, de frente (±55°), con al menos 22 px de tamaño aparente y sin nada delante. Se actualiza 10 veces por segundo y devuelve la más grande. | **No ejecuta el modelo K210.** La «confianza» es un número inventado a partir de distancia y ángulo. |
| Choques | El chasis es un círculo de 5,6 cm; al tocar un objeto o el borde, el robot se bloquea | Sin rebotes ni empujes. |
| Tiempo | Pasos fijos de 20 ms | Las esperas se redondean a múltiplos de 20 ms. |
| Lecturas en pantalla | Se refrescan unas 8 veces por segundo y cada valor se mantiene un momento (por ejemplo, la señal reconocida al menos 0,6 s) | Para que se puedan leer sin parpadeos. El programa sigue recibiendo los datos exactos cada 20 ms; el panel «Lo que lee el programa» muestra esos datos. |
| Modo avanzado | Ruido en sensores (bordes de línea, ±1,5 cm de distancia, una pérdida ocasional de la señal reconocida en el 5 % de las actualizaciones de visión) y retraso configurable | El modo inicial es determinista. |

## 4. Ampliaciones educativas (no forman parte del equipo ni del ejemplo oficial)

- Señal **«Alto»** y reconocimiento del semáforo en **amarillo** (marcados con * en los bloques).
- Bloques de **estados** (Seguir línea, Esperar, Girar, Estacionar, Recuperar línea). En MakeCode se traducen con variables y una función `cambiarEstado`.
- Bloque **«anotar decisión»**: solo muestra texto en el simulador; se exporta como comentario.
- **«obstáculo a menos de N cm»**: se exporta como una función que usa el ultrasonido oficial.

### Bloques del núcleo de MakeCode y de la extensión, ejecutados por el simulador

| Bloque | Cómo lo reproduce el simulador |
|---|---|
| Al presionar el botón A / B | Botones A y B junto a «Ejecutar» (aparecen si el programa los usa). Cada pulsación ejecuta su bloque en un hilo propio; si llega otra mientras se ejecuta, se atiende al terminar. Con botones, el programa sigue esperando aunque no tenga «repetir continuamente». |
| Función / llamar | Funciones sin parámetros. Una función que se llama a sí misma sin parar se detiene con un aviso (límite de 32 llamadas anidadas). |
| Mostrar número / texto | Mismos tiempos que `basic.showNumber` / `basic.showString` con intervalo de 150 ms: una sola cifra o letra 0,75 s; un texto más largo, 0,9 s por carácter más 0,75 s de salida. La matriz muestra cada carácter con una tipografía de 5 × 5 propia (no copia la de la micro:bit). |
| Tocar melodía | `Tinybit.Music_Car` suena de fondo y no detiene el programa, igual que en el simulador. **Aproximación:** el simulador solo toca un aviso corto de 4 notas, no la melodía real. |
| Luces RGB con valores | Los faros toman el color exacto (valores limitados a 0–255). |
| Número al azar | Entero entre los dos valores, ambos incluidos, como `randint`. **Diferencia:** en el simulador la secuencia se repite en cada ejecución para que los resultados sean predecibles; en la micro:bit cambia. |
| Mínimo / máximo, absoluto, restringir, convertir | Mismas fórmulas que `Math.min/max/abs/constrain/map`. |
- **«Zona 30»**: en el ejercicio significa PWM 70 (velocidad reducida acordada), no 30 km/h.
- Persona que «termina de cruzar» cuando el robot espera 2 s delante.

## 5. Compatibilidad con MakeCode: qué está comprobado

| Comprobación | Resultado |
|---|---|
| Nombres y tipos de las funciones exportadas frente al código fuente de Tiny-bitLib v2.0.3 | Prueba automática: el código exportado se compila con TypeScript junto a `main.ts` oficial (para micro:bit V2 y V1). Un nombre inventado hace fallar la prueba. |
| Compilación en el MakeCode real | Un programa que usa **todos** los bloques traducibles (incluidos botones A/B, funciones, mostrar número/texto, melodía, luces RGB por valores y las matemáticas) se pegó en la vista JavaScript de makecode.microbit.org con la extensión Tinybit v2.0.3 añadida: **sin errores** y MakeCode lo convirtió en bloques, sin bloques grises de código no convertible. |
| Bloques de visión (`la cámara ve…`, `señal que ve la cámara`, `confianza simulada`) | **Sin traducción.** Las etiquetas de texto que envía el programa oficial del K210 no están publicadas en texto, así que no se puede generar una comparación verificada. El exportador lo indica y no entrega código. |
| Robot físico | **No comprobado.** Solo se verificó el simulador y la compilación. Velocidades, tiempos de giro y de estacionamiento deben calibrarse en cada robot. |

Durante la verificación en MakeCode se encontraron y corrigieron dos problemas del exportador: el operador `?:` impedía volver a bloques (ahora se usa una función) y una comparación de estados no compilaba por el estrechamiento de tipos de TypeScript (ahora se usa `cambiarEstado`).

## 6. Qué cambia al pasar al robot real

- Los motores no son idénticos: con el mismo PWM, el robot puede desviarse.
- Por debajo de cierto PWM el motor no arranca (zona muerta).
- La luz ambiente y la altura del sensor cambian la lectura de la línea.
- El ultrasonido puede devolver valores falsos con superficies inclinadas o blandas.
- La visión depende de la luz, el enfoque y el modelo cargado en el K210; requiere su propio programa en la tarjeta TF.
- Las maniobras por tiempos (giros, estacionamiento) deben recalibrarse.
