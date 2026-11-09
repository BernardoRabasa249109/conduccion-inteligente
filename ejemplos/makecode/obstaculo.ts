// Generado por «Conducción Inteligente — Laboratorio Tiny Pro».
// Extensión necesaria en MakeCode: https://github.com/YahboomTechnology/Tiny-bitLib
// Placa: micro:bit V2 (Tinybit.Ultrasonic_CarV2()).
// Verificado: compila en makecode.microbit.org con la extensión Tinybit v2.0.3 y se convierte en bloques.
// No verificado en el robot físico: calibra velocidades y tiempos en tu equipo.
function hayObstaculo(limite: number): boolean {
    let d = Tinybit.Ultrasonic_CarV2()
    return d > 0 && d < limite
}
basic.forever(function () {
    if (hayObstaculo(15)) {
        Tinybit.CarCtrl(Tinybit.CarState.Car_Stop)
        // Decisión (solo en el simulador): (texto calculado)
    } else {
        if ((Tinybit.Line_Sensor(Tinybit.enPos.LeftState, Tinybit.enLineState.Black)) && (Tinybit.Line_Sensor(Tinybit.enPos.RightState, Tinybit.enLineState.Black))) {
            Tinybit.car_sport(150, 150)
            // Decisión (solo en el simulador): Los dos sensores ven negro: sigo recto
        } else if (Tinybit.Line_Sensor(Tinybit.enPos.LeftState, Tinybit.enLineState.Black)) {
            Tinybit.car_sport(23, 150)
            // Decisión (solo en el simulador): La línea está a mi izquierda: giro a la izquierda
        } else if (Tinybit.Line_Sensor(Tinybit.enPos.RightState, Tinybit.enLineState.Black)) {
            Tinybit.car_sport(150, 23)
            // Decisión (solo en el simulador): La línea está a mi derecha: giro a la derecha
        } else {
            Tinybit.CarCtrl(Tinybit.CarState.Car_Stop)
            // Decisión (solo en el simulador): No veo la línea: me detengo
        }
    }
})
