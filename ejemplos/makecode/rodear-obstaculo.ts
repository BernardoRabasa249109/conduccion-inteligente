// Generado por «Conducción Inteligente — Laboratorio Tiny Pro».
// Extensión necesaria en MakeCode: https://github.com/YahboomTechnology/Tiny-bitLib
// Placa: micro:bit V2 (Tinybit.Ultrasonic_CarV2()).
// Verificado: compila en makecode.microbit.org con la extensión Tinybit v2.0.3 y se convierte en bloques.
// No verificado en el robot físico: calibra velocidades y tiempos en tu equipo.
let ultimoLado = ""
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
ultimoLado = "derecha"
basic.forever(function () {
    if (estado == "RECUPERAR") {
        if ((input.runningTime() - tEstado) < 380) {
            Tinybit.car_sport(-120, 120)
            // Decisión (solo en el simulador): 1. Giro a la izquierda para salir de la línea
        } else if ((input.runningTime() - tEstado) < 1150) {
            Tinybit.car_sport(120, 120)
            // Decisión (solo en el simulador): 2. Me aparto de la línea
        } else if ((input.runningTime() - tEstado) < 1530) {
            Tinybit.car_sport(120, -120)
            // Decisión (solo en el simulador): 3. Giro a la derecha
        } else if ((input.runningTime() - tEstado) < 3600) {
            Tinybit.car_sport(120, 120)
            // Decisión (solo en el simulador): 4. Paso junto a la caja
        } else if ((input.runningTime() - tEstado) < 3800) {
            Tinybit.car_sport(120, -120)
            // Decisión (solo en el simulador): 5. Giro hacia la línea
        } else if ((Tinybit.Line_Sensor(Tinybit.enPos.LeftState, Tinybit.enLineState.Black)) || (Tinybit.Line_Sensor(Tinybit.enPos.RightState, Tinybit.enLineState.Black))) {
            cambiarEstado("SEGUIR_LINEA")
            ultimoLado = "izquierda"
            // Decisión (solo en el simulador): 6. Encontré la línea: sigo
        } else {
            Tinybit.car_sport(110, 110)
        }
    } else if (hayObstaculo(15)) {
        Tinybit.CarCtrl(Tinybit.CarState.Car_Stop)
        cambiarEstado("RECUPERAR")
        // Decisión (solo en el simulador): Caja delante: la rodeo
    } else if ((Tinybit.Line_Sensor(Tinybit.enPos.LeftState, Tinybit.enLineState.Black)) && (Tinybit.Line_Sensor(Tinybit.enPos.RightState, Tinybit.enLineState.Black))) {
        Tinybit.car_sport(140, 140)
    } else if (Tinybit.Line_Sensor(Tinybit.enPos.LeftState, Tinybit.enLineState.Black)) {
        Tinybit.car_sport(20, 140)
        ultimoLado = "izquierda"
    } else if (Tinybit.Line_Sensor(Tinybit.enPos.RightState, Tinybit.enLineState.Black)) {
        Tinybit.car_sport(140, 20)
        ultimoLado = "derecha"
    } else if (ultimoLado == "izquierda") {
        Tinybit.car_sport(-70, 110)
    } else {
        Tinybit.car_sport(110, -70)
    }
})
