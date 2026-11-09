# Conducción Inteligente — Laboratorio Tiny Pro

Simulador educativo para preparar el trabajo con el robot **Yahboom Tiny:bit Pro** (micro:bit + módulo de visión K210). El alumnado conduce, programa con bloques y comprueba retos antes de pasar al robot físico.

- **Explorar el robot**: modelo 3D del robot (se gira arrastrando) sobre un plano técnico, ficha de cada componente con «Probar» y la demostración *percibir → decidir → actuar*.
- **Conducir**: control manual (teclado o botones), lecturas de sensores en vivo, editor de escenarios.
- **Programar**: bloques en español (Blockly), ejecución real sobre la simulación, paso a paso, variables, registro de decisiones y puente a MakeCode.
- **Prácticas**: 25 prácticas guiadas con comprobación por comportamiento (15 básicas y 10 de ampliación), cada una con su botón para reiniciarla.
- **Perfil del alumno**: correo de la escuela, nombre y apellidos; calificación por práctica, avance y promedio; reporte .txt con código de verificación para la plataforma de la escuela.

## Usarlo en Windows (sin instalar nada)

1. En la carpeta principal, haz doble clic en `Abrir simulador.bat`.
2. O bien abre la carpeta `dist` y haz doble clic en el `index.html` que está **dentro**. (El `index.html` de la carpeta principal es el código fuente: no abre el simulador con doble clic.)
3. Se abre en el navegador (recomendado: Chrome o Edge actualizados). Funciona sin internet, sin cuentas y sin claves.

Para proyectar en clase, usa el botón de pantalla completa (arriba a la derecha) o la tecla F11 del navegador.

El progreso y los programas se guardan en el navegador de ese equipo. Para llevarlos a otro equipo, usa **Guardar** (programa + escenario en un archivo `.json`) y luego **Abrir**.

## Publicarlo en un servidor local (para todo el grupo)

Toda la aplicación es **un solo archivo**: `dist/index.html` (unos 1,8 MB; 480 KB comprimido). No descarga nada de internet.

1. Copia `dist/index.html` a la carpeta del servidor web de la escuela (por ejemplo, `htdocs` de XAMPP, `wwwroot` de IIS o la carpeta pública de nginx o Apache). Puedes renombrarlo o ponerlo en una subcarpeta: funciona en cualquier ruta.
2. Los alumnos abren la dirección del servidor en el navegador, por ejemplo `http://192.168.1.10/simulador/`.
3. Para probarlo sin instalar un servidor, en la carpeta `dist` puedes ejecutar `python -m http.server 8080` y abrir `http://IP-DEL-EQUIPO:8080` desde los otros equipos.

Recomendaciones:
- **Compresión**: activa gzip o brotli en el servidor; el archivo baja de 1,8 MB a unos 480 KB.
- **Al actualizar**, pide a los alumnos que recarguen con Ctrl+F5 (Cmd+Mayús+R en Mac), o configura el servidor para que no guarde en caché `index.html`.
- **El progreso se guarda en cada navegador** y para cada dirección del servidor. Si cambia la dirección (otra IP o nombre), el navegador la trata como otro sitio y el progreso no aparece: usa **Guardar** y **Abrir** para llevar los proyectos.
- En **Safari**, una ventana privada borra el progreso al cerrarse.

### Navegadores

- **Google Chrome** o **Microsoft Edge** 90 o más reciente (Windows, macOS, ChromeOS).
- **Safari 15** o más reciente (macOS Monterey o posterior; iPad con iPadOS 15 o posterior).
- **Firefox** 90 o más reciente.

El simulador necesita **WebGL 2**. Si un equipo no lo tiene, aparece un aviso que explica qué hacer (actualizar el navegador o activar la aceleración por hardware).

### Rendimiento en equipos sencillos

- Cuando nada se mueve y nadie toca la pantalla, el escenario se dibuja a 15 imágenes por segundo en lugar de 60: ahorra tarjeta gráfica y batería.
- En pantallas de alta densidad (Retina), el 3D se dibuja como máximo a 1,5 veces la resolución; la vista de la cámara K210 se dibuja a la mitad de imágenes.
- Si un equipo va lento: minimiza la ventana de la cámara (flecha de su barra), apaga las ayudas visuales que no uses y cierra otras pestañas del navegador.

## Modificar el proyecto (opcional, para el docente)

Requiere [Node.js](https://nodejs.org/) 18 o superior.

```bat
npm install
npm run dev        :: servidor de desarrollo en http://localhost:5173
npm test           :: 132 verificaciones automáticas (112 sin las soluciones del docente)
npm run build      :: versión pública: dist\index.html (sin modo docente ni soluciones)
npm run build:docente :: versión del docente: docente\simulador\index.html (solo en el equipo del docente)
npm run docente    :: servidor de desarrollo de la versión del docente (puerto 5181)
npm run examples   :: regenera los archivos de la carpeta ejemplos\
```

`Desarrollo (instalar y ejecutar).bat` hace `npm install` y `npm run dev` con doble clic.

### Versión del docente (solo local)

La versión pública no tiene modo docente ni las soluciones de las prácticas. Las soluciones están en `docente/soluciones.ts`, una carpeta que está en `.gitignore` y solo existe en el equipo del docente; `npm run build:docente` falla a propósito si no la encuentra. Detalles en `docs/GUIA_DOCENTE.md`.

### Cambiar el modelo 3D de «Explorar»

1. Edita `modelo3D/crear_tinybit_pro_3d.py` y ejecútalo (`pip install trimesh numpy` y luego `python crear_tinybit_pro_3d.py`): vuelve a crear `Tinybit_Pro_conceptual.glb`.
2. Ejecuta `npm run build`: el modelo queda dentro de `dist\index.html`.

El simulador reconoce cada pieza por el número con el que empieza su nombre: 10–14 ruedas y motores (`_1` izquierda, `_-1` derecha), 30–33 ultrasonido, 40, 41 y 43 micro:bit, 42 matriz LED (`42_LED_microbit_fila_columna`), 50–67 cámara K210 y su soporte. Si añades piezas, respeta esos números para que se puedan tocar. Los sensores de línea no están en el modelo: los dibuja el simulador bajo el frente del chasis.

## Contenido

| Carpeta | Qué hay |
|---|---|
| `dist/index.html` | La aplicación lista para usar (un solo archivo). |
| `ejemplos/escenarios/` | Pista básica, ciudad y reto en JSON (se cargan en el editor de escenarios). |
| `ejemplos/programas/` | Los 16 ejemplos resueltos como proyectos (se abren con «Abrir» en Programar). |
| `ejemplos/makecode/` | Código MakeCode de los ejemplos compatibles (sin visión). |
| `docs/GUIA_DOCENTE.md` | Cómo usarlo en clase y detalle de las 25 prácticas. |
| `docs/APROXIMACIONES_Y_COMPATIBILIDAD.md` | Qué está comprobado, qué es simulado y qué es ampliación educativa. |
| `src/` | Código fuente (TypeScript, Three.js, Blockly). |
| `tests/` | Verificaciones automáticas (Vitest). |
| `modelo3D/` | Modelo 3D del robot que se ve en «Explorar» (`Tinybit_Pro_conceptual.glb`), el script que lo genera y la imagen de referencia. |

## Arquitectura

```
src/core/        estado y movimiento del robot (robot.ts), sensores (sensors.ts),
                 entorno y pista (scenario.ts, track.ts, world.ts), bucle (sim.ts)
src/program/     bloques (blocks.ts), traducción a árbol (compile.ts),
                 intérprete por hilos (interpreter.ts), ejemplos, exportación a MakeCode
src/render/      escena 3D compartida por las tres vistas (Three.js)
src/render/exploreScene.ts  vista 3D de «Explorar»: carga modelo3D/Tinybit_Pro_conceptual.glb
src/practices/   definición y comprobación de las 25 prácticas
src/ui/          interfaz: espacios, paneles, editor de escenarios, diálogos
```

La simulación avanza en pasos fijos de 20 ms: leer sensores → ejecutar el programa → mover el robot → comprobar choques. Todas las vistas (isométrica, superior y cámara de a bordo) dibujan ese mismo estado.

## Licencias

- Código de este proyecto: uso educativo libre.
- `tests/makecode/tinybit-main.ts`: copia sin cambios de la extensión oficial Tiny-bitLib (MIT, Shenzhen Yahboom Tech), usada solo para verificar que el código exportado compila.
- Three.js (MIT) y Blockly (Apache 2.0) se incluyen en la compilación.
