// Generado por «Conducción Inteligente — Laboratorio Tiny Pro».
// Extensión necesaria en MakeCode: https://github.com/YahboomTechnology/Tiny-bitLib
// Placa: micro:bit V2 (Tinybit.Ultrasonic_CarV2()).
// Verificado: compila en makecode.microbit.org con la extensión Tinybit v2.0.3 y se convierte en bloques.
// No verificado en el robot físico: calibra velocidades y tiempos en tu equipo.
let ultimoLado = ""
ultimoLado = "izquierda"
basic.forever(function () {
    if ((Tinybit.Line_Sensor(Tinybit.enPos.LeftState, Tinybit.enLineState.Black)) && (Tinybit.Line_Sensor(Tinybit.enPos.RightState, Tinybit.enLineState.Black))) {
        Tinybit.car_sport(150, 150)
        // Decisión (solo en el simulador): Sigo la línea
    } else if (Tinybit.Line_Sensor(Tinybit.enPos.LeftState, Tinybit.enLineState.Black)) {
        ultimoLado = "izquierda"
        Tinybit.car_sport(20, 150)
    } else if (Tinybit.Line_Sensor(Tinybit.enPos.RightState, Tinybit.enLineState.Black)) {
        ultimoLado = "derecha"
        Tinybit.car_sport(150, 20)
    } else {
        if (ultimoLado == "izquierda") {
            Tinybit.car_sport(-70, 110)
            // Decisión (solo en el simulador): Perdí la línea: la busco a la izquierda, donde la vi por última vez
        } else {
            Tinybit.car_sport(110, -70)
            // Decisión (solo en el simulador): Perdí la línea: la busco a la derecha, donde la vi por última vez
        }
    }
})
