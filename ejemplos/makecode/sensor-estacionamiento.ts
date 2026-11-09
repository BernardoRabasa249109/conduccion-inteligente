// Generado por «Conducción Inteligente — Laboratorio Tiny Pro».
// Extensión necesaria en MakeCode: https://github.com/YahboomTechnology/Tiny-bitLib
// Placa: micro:bit V2 (Tinybit.Ultrasonic_CarV2()).
// Verificado: compila en makecode.microbit.org con la extensión Tinybit v2.0.3 y se convierte en bloques.
// No verificado en el robot físico: calibra velocidades y tiempos en tu equipo.
let d = 0
let velocidad = 0
let rojo = 0
basic.forever(function () {
    d = Tinybit.Ultrasonic_CarV2()
    if (d == 0) {
        d = 100
    }
    velocidad = Math.constrain(Math.map(d, 8, 60, 0, 160), 0, 160)
    rojo = Math.constrain(Math.map(d, 10, 50, 255, 0), 0, 255)
    Tinybit.RGB_Car_Big2(rojo, (255 - rojo), 0)
    Tinybit.car_sport(velocidad, velocidad)
    // Decisión (solo en el simulador): (texto calculado)
})
