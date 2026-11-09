// Generado por «Conducción Inteligente — Laboratorio Tiny Pro».
// Extensión necesaria en MakeCode: https://github.com/YahboomTechnology/Tiny-bitLib
// Placa: micro:bit V2 (Tinybit.Ultrasonic_CarV2()).
// Verificado: compila en makecode.microbit.org con la extensión Tinybit v2.0.3 y se convierte en bloques.
// No verificado en el robot físico: calibra velocidades y tiempos en tu equipo.
let estado = ""
let tEstado = 0
function cambiarEstado(nuevo: string) {
    if (estado != nuevo) {
        estado = nuevo
        tEstado = input.runningTime()
    }
}
function hayObstaculo(limite: number): boolean {
    let d = Tinybit.Ultrasonic_CarV2()
    return d > 0 && d < limite
}
cambiarEstado("SEGUIR_LINEA")
basic.forever(function () {
    if (estado == "GIRAR") {
        if (((input.runningTime() - tEstado) > 450) && ((Tinybit.Line_Sensor(Tinybit.enPos.LeftState, Tinybit.enLineState.Black)) || (Tinybit.Line_Sensor(Tinybit.enPos.RightState, Tinybit.enLineState.Black)))) {
            cambiarEstado("SEGUIR_LINEA")
            // Decisión (solo en el simulador): Ya di media vuelta: sigo la línea hacia el otro lado
        } else {
            Tinybit.car_sport(-120, 120)
        }
    } else if (hayObstaculo(15)) {
        Tinybit.CarCtrl(Tinybit.CarState.Car_Stop)
        cambiarEstado("GIRAR")
        // Decisión (solo en el simulador): Obstáculo delante: doy media vuelta
    } else {
        if ((Tinybit.Line_Sensor(Tinybit.enPos.LeftState, Tinybit.enLineState.Black)) && (Tinybit.Line_Sensor(Tinybit.enPos.RightState, Tinybit.enLineState.Black))) {
            Tinybit.car_sport(140, 140)
        } else if (Tinybit.Line_Sensor(Tinybit.enPos.LeftState, Tinybit.enLineState.Black)) {
            Tinybit.car_sport(21, 140)
        } else if (Tinybit.Line_Sensor(Tinybit.enPos.RightState, Tinybit.enLineState.Black)) {
            Tinybit.car_sport(140, 21)
        } else {
            Tinybit.CarCtrl(Tinybit.CarState.Car_Stop)
        }
    }
})
