# Guía para el docente

## Idea central

El alumno debe poder pensar: *«Cambio esta condición, ejecuto y entiendo por qué mi robot se comporta diferente»*. Por eso:

- Cada lectura de sensor se calcula a partir de la posición real del robot y del tapete.
- Los programas de bloques se ejecutan de verdad sobre la simulación; no hay animaciones grabadas.
- El robot muestra su decisión actual («Me detengo porque detecté rojo») y el registro guarda las últimas decisiones.
- Las prácticas se marcan como completadas solo cuando el robot **hace** lo pedido.

Colores fijos en toda la aplicación (pantalla, escena 3D y bloques): **cian = percibir**, **ámbar = decidir**, **fucsia = actuar**.

## Antes de la clase

1. Abre la versión pública (la de Vercel, o `dist/index.html`) en el equipo del aula y en uno de prueba.
2. En tu equipo, usa la **versión del docente** (ver abajo) para ver las soluciones y abrir cualquier práctica. En la versión pública las prácticas se desbloquean en orden y no hay soluciones.
3. El **modo avanzado** añade el control de cada motor, ruido y retraso de sensores. Úsalo cuando el grupo ya domine el modo predecible.

## Recorrido sugerido de la primera sesión (50 min)

1. **Conducir** (10 min): «Conduce hasta la línea y observa qué detecta tu robot». Pide que encuentren las cuatro combinaciones de los sensores.
2. **Explorar** (10 min): modelo 3D del robot (se gira arrastrando; «Vista inicial» lo regresa), componentes, «Probar» y la demostración percibir → decidir → actuar con la regleta. Los sensores de línea están escondidos bajo el robot: al elegirlos se dibujan «en rayos X».
3. **Programar** (20 min): abre el ejemplo «Seguidor de línea básico», ejecútalo y cambia un número (por ejemplo, 20 → 120 en un giro). ¿Qué cambia?
4. **Prácticas 5 y 6** (10 min).

## Controles importantes

| Acción | Cómo |
|---|---|
| Parada de emergencia | Botón rojo «PARADA» (siempre visible) o tecla **Esc** |
| Pausar / continuar | Botón «Pausa» o tecla **P** |
| Conducir | Flechas o W A S D; al soltar, el robot se detiene |
| Colocar el robot | Conducir → «Colocar robot». Arrastra el robot para moverlo; arrastra el tirador ámbar para girarlo (con Shift, de 15 en 15°); teclas Q y E giran 15°; clic en el suelo libre lo lleva allí. El robot se desliza con suavidad y no puede salir del borde morado del tapete |
| Cambiar el semáforo | Botón «Semáforo» en la barra de ayudas del escenario (su punto muestra la luz encendida): abre un menú con automático, rojo, amarillo, verde o apagado (apagado, la cámara no reconoce ningún color). Solo aparece si el escenario tiene semáforo |
| Ver puntos de lectura, cono del ultrasonido, campo de la cámara | Botones de ayudas visuales sobre el escenario |
| Cuadrícula de piezas | Viene activada: marca las casillas de 30 cm para colocar piezas de pista. Solo se dibuja en el tapete; los sensores de línea no la ven. Se quita en Ajustes |
| Ventana de la cámara K210 | La flecha de su barra la minimiza (solo queda la barra con lo que detecta); «Programar» y «Conducir» lo recuerdan por separado. Arrástrala para ponerla en cualquier parte del escenario (o enfoca su barra y usa las flechas). El asa de su esquina la hace más pequeña, hasta un 10 % menos, nunca más grande. Doble clic la regresa a su esquina y tamaño. Se recuerda en el navegador |
| Rastro del robot | Botón «Rastro»: mostrar u ocultar y elegir entre 8 colores (se recuerda en el navegador) |
| Restablecer el escenario | Conducir → «Restablecer escenario» (o «Restablecer» en el editor): vuelve el mapa original —piezas, objetos, zonas y tamaño— y el robot a su salida. Pide confirmación. Con una práctica abierta, vuelve a su escenario preparado |
| Editar el escenario | Conducir → «Editar escenario». Con «Seleccionar y mover»: clic en una pieza, señal, obstáculo o zona para elegirla, arrastrar para moverla (una pieza se puede soltar en otra casilla; si está ocupada, se intercambian), clic otra vez para girarla, tecla Supr para eliminarla |
| Mover y girar señales, semáforos, obstáculos, franjas y zonas | En el editor, con «Seleccionar y mover»: al elegir uno aparece el mismo anillo que en «Colocar robot». Arrástralo para moverlo (se desliza y no sale del tapete); arrastra el tirador ámbar para girarlo al ángulo que quieras (con Shift, de 15 en 15°); botones ±15° o teclas Q y E. Clic otra vez sobre él: gira 45°. Las piezas de pista siguen girando de 90 en 90° |
| Glorietas | Dos piezas de pista en el editor, como las del tapete de referencia: **Glorieta** (la línea entra por un lado, rodea un anillo negro y sale por el lado opuesto) y **Glorieta de retorno** (fin de línea: el robot da la vuelta en el anillo y regresa). Se giran de 90 en 90° como las demás. La dona morada del centro es decoración: los sensores de línea del simulador solo leen la línea negra (en un tapete impreso, que el sensor la vea o no depende de la tinta). Con el ejemplo «Seguidor de línea básico» el robot se detiene al entrar al anillo (adentro lee 0 · 0); los que recuperan la línea («Recuperar la línea perdida», «Seguidor inteligente») rodean la glorieta y salen: buena pregunta para la clase |

Modo manual y modo programa están separados: mientras un programa tiene el mando, el control manual se bloquea (se indica arriba con «PROGRAMA EN MARCHA»).

## Categorías de bloques

- **Inicio y repetición**: al iniciar, repetir continuamente, al presionar el botón A/B, esperar, repetir, mientras.
- **Condiciones y lógica**: si (incluido uno ya armado con cuatro casos), comparaciones, y/o/no, anotar decisión.
- **Matemáticas**: números, operaciones, número al azar, mínimo/máximo, valor absoluto, restringir y convertir de una escala a otra (útil para que la velocidad dependa de la distancia).
- **Variables** y **Funciones** (crear una función y llamarla).
- **Motores**, **Sensores**, **Visión (simulada)**, **Estados**.
- **Luces y acciones**: iconos, flechas, mostrar número o texto, faros RGB (por nombre o por valores), claxon y melodías.

Las prácticas muestran solo las categorías que necesitan; en el modo libre aparecen todas.

## Depuración paso a paso

- **Paso** ejecuta un solo bloque y resalta el siguiente.
- El tiempo de la simulación **solo avanza** cuando el bloque es «esperar», «mostrar icono» (0,6 s, como en la micro:bit) o al terminar una vuelta de «repetir continuamente» (20 ms). Un bloque de motores, por sí solo, no mueve el robot hasta que pasa tiempo: es un buen tema de discusión.
- **Reiniciar** detiene el programa, borra variables y esperas pendientes y devuelve el robot a la salida.

## Ejemplos resueltos y programa del alumno

- Los ejemplos se abren con un aviso ámbar «Ejemplo resuelto». Se pueden ejecutar y modificar sin tocar el programa del alumno.
- «Copiar a mi programa» pide confirmación antes de reemplazar trabajo existente (ofrece guardar una copia en archivo).
- Cada práctica tiene su propia copia del programa del alumno, guardada en el navegador.
- Cinco ejemplos de refuerzo (pista básica): **Sensor de estacionamiento** (convertir la distancia en velocidad y en color de los faros), **Media vuelta ante un obstáculo** (estado Girar), **Cronómetro de vuelta** (tiempo desde el inicio y una variable que recuerda cuándo empezó la vuelta), **Cambiar la velocidad con los botones** (A cambia entre tres velocidades, B pausa) y **Rodear un obstáculo y volver a la línea** (maniobra por tiempos: en el robot real hay que calibrarlos). Los cuatro que no usan visión se exportan a MakeCode.
- «Seguidor inteligente: flechas, semáforo y obstáculos» (escenario 3) junta todo con prioridades: 1) persona o caja a menos de 15 cm → alto; 2) semáforo en rojo → alto; 3) girando → buscar la calle nueva; 4) fin de la calle → girar hacia la última flecha vista; 5) seguir la línea. Antes, en cada vuelta, recuerda la flecha (variable «giro») y, con el amarillo, baja la velocidad poco a poco. Con dos sensores sobre la línea, un cruce en «+» se ve igual que una recta: el giro se hace donde se acaba la calle (un cruce en «T»). La cámara no reconoce personas ni cajas: eso lo detecta el ultrasonido. El amarillo es una ampliación educativa (el modelo oficial reconoce rojo y verde).

## Versión pública y versión del docente

Hay dos versiones del mismo simulador:

| | Versión pública (GitHub y Vercel) | Versión del docente (solo en tu equipo) |
|---|---|---|
| Prácticas | Se desbloquean en orden | Las 25 abiertas (modo docente) |
| Soluciones | No las tiene: no están ni en el código público | Botón «Ver solución» en cada práctica |
| Verificar reportes de alumnos | No | Perfil → «Verificar el reporte de un alumno» |
| Cómo se reconoce | — | Distintivo amarillo **DOCENTE** junto al nombre |

- La versión del docente vive en la carpeta `docente/` del proyecto, que **nunca se sube** a GitHub ni a Vercel (está en `.gitignore`). Se abre con `docente/Abrir simulador docente.bat`. Las soluciones están en `docente/soluciones.ts`.
- En la versión del docente, **Ajustes → Modo docente** (encendido de entrada) se puede apagar para ver el simulador exactamente como lo ve un alumno.
- Después de cambiar el proyecto, vuelve a generar la versión del docente con `npm run build:docente` (la pública se genera con `npm run build`).
- No copies la carpeta `docente/` ni su `simulador/index.html` a los equipos del alumnado.

## Perfil del alumno y calificaciones

- **Registro**: botón **Perfil** (arriba a la derecha). El alumno escribe su correo de la escuela, su nombre y sus apellidos. Su avance (prácticas, calificaciones y programas) queda **ligado a su correo** en ese navegador: varios alumnos pueden usar el mismo equipo sin mezclar su avance («Cambiar de alumno»). Si en el navegador ya había avance sin perfil, el primer alumno que se registra puede pasarlo al suyo.
- **Completar una práctica** exige dos cosas: que el robot lo demuestre (las comprobaciones) **y** contestar bien la pregunta «Antes de probar». Sin la pregunta, la práctica no se marca como completada y «Siguiente» no se activa.
- **Calificación por práctica**: 10 al completarla; −1 por cada respuesta equivocada en «Antes de probar» (máximo −2); −0.5 por cada pista vista (máximo −1.5). Mínimo 5. (El alumnado ya no puede ver soluciones; si un registro anterior dice «vio la solución», esa práctica tiene −3.)
- **En el perfil** se ven: prácticas completadas (de 25 y en %), promedio de las completadas, calificación general sobre las 25 (las pendientes cuentan 0) y la tabla de cada práctica con su calificación, fecha y detalle.
- **Reporte para la plataforma de la escuela**: «Descargar mi avance (.txt)» crea un archivo con nombre, apellidos, correo, avance, promedio, calificación general y el detalle de cada práctica.
- **El .txt se puede abrir y editar** (es texto). Por eso termina con un **código de verificación** calculado con todo su contenido: si alguien cambia una calificación, un nombre o cualquier letra, el código deja de coincidir. Para comprobarlo: en la **versión del docente**, **Perfil** → «Verificar el reporte de un alumno» y elige el archivo (no hace falta registrar un perfil de alumno). Protege contra cambios hechos a mano; no es una firma infalible.
- **Cambiar de equipo**: el alumno descarga su reporte y, en el otro equipo, entra con el mismo correo y usa «Cargar mi avance de otro equipo». Solo se carga un reporte válido y del mismo correo.

## Las 25 prácticas

| # | Práctica | Espacio | Se completa cuando… |
|---|---|---|---|
| 1 | Reconocer los componentes | Explorar | Responde bien las 6 preguntas tocando el componente. |
| 2 | Manejar el robot manualmente | Conducir | Llega a la META sin chocar ni salir del tapete. |
| 3 | Comparar la velocidad de los motores | Conducir | Gira 90° en curva con las dos ruedas avanzando y la derecha más rápida. |
| 4 | Observar los sensores sobre blanco y negro | Conducir | Aparecen las 4 combinaciones 11, 10, 01 y 00. |
| 5 | Programar avance y parada | Programar | El programa detiene el robot (1 s quieto) dentro de la META. |
| 6 | Crear un seguidor de línea básico | Programar | Usa los sensores, toma una curva y recorre 2 m sin perder la línea más de 1 s. |
| 7 | Recuperarse cuando se pierde la línea | Programar | Empieza fuera de la línea, la encuentra y la sigue 1 m. |
| 8 | Detenerse ante un obstáculo | Programar | Usa el ultrasonido y se detiene a 3–20 cm de la caja durante 2 s sin chocar. |
| 9 | Explorar qué puede ver la cámara | Conducir | Se reconocen 3 señales distintas y se observa una no reconocida (lejos, de lado o tapada). |
| 10 | Respetar rojo y verde | Programar | Se detiene con rojo, no entra al cruce en rojo y pasa con verde. |
| 11 | Reducir velocidad ante una señal | Programar | Velocidad media en la ZONA 30 menor que el 65 % de la normal, y recupera después. |
| 12 | Elegir izquierda o derecha en un cruce | Programar | Gira hacia el lado de la flecha vista y sigue por la nueva calle. |
| 13 | Estacionarse en una zona indicada | Programar | Entra en la plaza 1, queda detenido unos 2 s, vuelve a la línea y no usa la plaza 2. |
| 14 | Resolver instrucciones simultáneas mediante prioridades | Programar | No cruza en rojo, se detiene ante la persona sin chocar y continúa cuando se va. |
| 15 | Completar una misión | Programar | Semáforo, giro indicado, persona, zona 30, estacionamiento en P2 y META. |
| 16 | Percibir, decidir y actuar paso a paso | Explorar | Con la regleta, se ven las cuatro lecturas (1·1, 1·0, 0·1, 0·0) y la decisión de cada una. |
| 17 | Conducir en zigzag entre cajas | Conducir | Pasa la 1.ª y la 3.ª caja por arriba y la 2.ª por abajo, llega a la META y no toca ninguna. |
| 18 | Arrancar y parar con los botones A y B | Programar | Quieto hasta pulsar A; con A sigue la línea 50 cm; con B se detiene y se queda quieto 2 s. |
| 19 | Luces que avisan | Programar | Faros verdes al avanzar (1 s) y rojos al detenerse ante la caja (1 s), sin chocar. |
| 20 | Frenar poco a poco según la distancia | Programar | Rápido lejos de la caja, mucho más lento entre 15 y 25 cm sin parar, y se detiene a menos de 14 cm sin chocar. |
| 21 | Tocar el claxon una sola vez | Programar | La cámara ve la señal de claxon, pita exactamente una vez y sigue la línea. |
| 22 | Respetar la señal de ALTO | Programar | Se detiene antes de ALTO entre 1,5 y 3,5 s, continúa y no se vuelve a detener. |
| 23 | Contar vueltas con una variable | Programar | Cuenta las pasadas junto a la señal, muestra el número y se detiene justo en la 3.ª. |
| 24 | Ordenar el programa con funciones | Programar | Tiene dos funciones y las llama; sigue la línea y se detiene ante la caja. |
| 25 | El amarillo: frenar sin detenerse | Programar | Con el semáforo en amarillo va a menos de dos tercios de su velocidad, no se detiene y pasa. |

Las prácticas 16 a 25 son de ampliación: la 16 se abre al completar la 1 y cada una de las siguientes, al completar la anterior (en la versión del docente, todas están abiertas).

**Cambiar de sección cierra la ventana de la práctica**: si estás en «Prácticas» y pasas a Explorar, Conducir o Programar desde las pestañas de arriba, la ventana se oculta para no tapar esa sección. La práctica sigue activa (su número aparece en la pestaña «Prácticas») y la ventana vuelve al regresar a «Prácticas». Cuando es la propia práctica la que te lleva («Ir a Programar» o, en la versión del docente, «Ver solución»), la ventana te acompaña.

**Ventanas en modo práctica**: en «Prácticas» y en «Conducir», la ventana de la práctica queda arriba a la izquierda del escenario. En «Programar», donde el escenario es pequeño, la práctica no va encima del escenario: aparece plegada arriba del panel «Lo que lee el programa» (se despliega con su flecha). En los tres casos, la cámara K210 se fija en la esquina inferior derecha, al 90 % de su tamaño, para que no se encimen. En modo libre la cámara se puede mover y encoger como siempre, y vuelve al lugar donde la dejaste.

**Práctica completada y viajar entre prácticas**: al completar la práctica, su ventana se pinta de verde y el número cambia por una palomita, aunque esté minimizada para ver el escenario. Al final de la ventana, «Anterior» y «Siguiente» llevan a la práctica de al lado; se activan solo cuando la práctica en turno está completada (y la otra práctica no está bloqueada).

**Reiniciar una práctica**: el botón circular a la derecha de cada práctica de la lista borra su avance (comprobaciones y marca de completada) y vuelve a su programa inicial, con confirmación. Las demás prácticas no cambian y las que ya estaban abiertas siguen abiertas.

Cada práctica incluye: objetivo, escenario preparado, pregunta de predicción con explicación, programa inicial parcial (si procede), reto, tres pistas progresivas, comprobación en vivo. La solución solo está en la versión del docente: se abre como ejemplo y no borra el programa que había.

En el equipo del docente, `npm test` verifica que cada solución completa su práctica y que el programa inicial **no** la completa. Donde no está `docente/soluciones.ts` (por ejemplo, en GitHub), esas pruebas se omiten.

## Ideas para discutir

- **Ambigüedad de dos sensores**: «1 y 1» aparece tanto en una recta como en un cruce. ¿Cómo sabe el robot dónde está?
- **Memoria**: la flecha se ve antes del cruce; hay que recordarla y olvidarla después del giro.
- **Prioridades**: en un «si / si no si», gana la primera condición verdadera. ¿Qué pasa si el seguimiento de línea va primero?
- **«30» no son km/h**: es una orden del ejercicio (PWM 70).
- **Lo que el robot no puede ver no existe para el programa**: si el semáforo sale del campo de la cámara, el programa ya no lo conoce.

## Del simulador al robot

Botón **MakeCode** en Programar:

1. Muestra si el programa es compatible. Solo se entrega código si **todos** sus bloques tienen traducción verificada; si no, se listan los que faltan (por ahora, los bloques de visión).
2. Incluye la tabla de correspondencia y la guía paso a paso: crear el proyecto, añadir la extensión oficial, pegar el código en la vista JavaScript, descargar, preparar aparte el K210 y calibrar.
3. «Abrir MakeCode» abre https://makecode.microbit.org/ en otra pestaña. **No** sincroniza nada automáticamente.

Recuerda al grupo: el programa de la micro:bit no sustituye el programa ni el modelo de la cámara K210, que se preparan por separado según la documentación de Yahboom. Prueba siempre primero con las ruedas en el aire y calibra velocidades y tiempos en el robot real.
