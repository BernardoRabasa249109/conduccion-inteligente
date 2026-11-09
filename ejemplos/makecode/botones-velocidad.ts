// Generado por «Conducción Inteligente — Laboratorio Tiny Pro».
// Extensión necesaria en MakeCode: https://github.com/YahboomTechnology/Tiny-bitLib
// Placa: micro:bit V2 (Tinybit.Ultrasonic_CarV2()).
// Verificado: compila en makecode.microbit.org con la extensión Tinybit v2.0.3 y se convierte en bloques.
// No verificado en el robot físico: calibra velocidades y tiempos en tu equipo.
let modo = 0
let andar = 0
let velocidad = 0
input.onButtonPressed(Button.A, function () {
    modo += 1
    if (modo > 3) {
        modo = 1
    }
    velocidad = (50 + (50 * modo))
    basic.showNumber(modo)
})
input.onButtonPressed(Button.B, function () {
    if (andar == 1) {
        andar = 0
    } else {
        andar = 1
    }
})
modo = 1
andar = 1
velocidad = 100
basic.showNumber(1)
basic.forever(function () {
    if (andar == 1) {
        if ((Tinybit.Line_Sensor(Tinybit.enPos.LeftState, Tinybit.enLineState.Black)) && (Tinybit.Line_Sensor(Tinybit.enPos.RightState, Tinybit.enLineState.Black))) {
            Tinybit.car_sport(velocidad, velocidad)
        } else if (Tinybit.Line_Sensor(Tinybit.enPos.LeftState, Tinybit.enLineState.Black)) {
            Tinybit.car_sport(20, velocidad)
        } else if (Tinybit.Line_Sensor(Tinybit.enPos.RightState, Tinybit.enLineState.Black)) {
            Tinybit.car_sport(velocidad, 20)
        } else {
            Tinybit.CarCtrl(Tinybit.CarState.Car_Stop)
        }
    } else {
        Tinybit.CarCtrl(Tinybit.CarState.Car_Stop)
    }
})
