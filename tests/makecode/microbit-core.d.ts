// Declaraciones mínimas del núcleo de micro:bit en MakeCode (pxt-microbit),
// solo lo que usan la extensión Tinybit y el código exportado. Firmas tomadas
// de la documentación pública de MakeCode.
interface Buffer { [index: number]: number; length: number }
declare const enum DigitalPin { P0 = 0, P1, P2, P8 = 8, P12 = 12, P13, P14, P15, P16 }
declare const enum AnalogPin { P0 = 0, P1, P2 }
declare const enum PinPullMode { PullDown = 0, PullUp = 1, PullNone = 2 }
declare const enum PulseValue { High = 1, Low = 0 }
declare const enum NeoPixelMode { RGB = 1, RGBW = 2, RGB_RGB = 3 }
declare const enum Melodies { Dadadadum, Entertainer, Prelude, Ode, Nyan, Ringtone, Funk, Blues, Birthday, Wedding, Funeral, Punchline, Baddy, Chase, BaDing, Wawawawaa, JumpUp, JumpDown, PowerUp, PowerDown }
declare const enum MelodyOptions { Once = 1, Forever = 2 }
declare const enum BeatFraction { Whole = 1, Half = 2, Quarter = 4, Eighth = 8 }
declare const enum IconNames { Heart, SmallHeart, Yes, No, Happy, Sad, Confused, Angry, Asleep, Surprised, Silly, Fabulous, Meh, Square, SmallSquare, Diamond, SmallDiamond, Target }
declare const enum ArrowNames { North, NorthEast, East, SouthEast, South, SouthWest, West, NorthWest }
declare namespace basic {
  function pause(ms: number): void;
  function forever(a: () => void): void;
  function showIcon(icon: IconNames, interval?: number): void;
  function showArrow(direction: number, interval?: number): void;
  function showNumber(value: number, interval?: number): void;
}
declare namespace input { function runningTime(): number }
declare namespace control { function waitMicros(micros: number): void }
declare namespace music {
  function playTone(frequency: number, ms: number): void;
  function beat(fraction?: BeatFraction): number;
  function beginMelody(melodyArray: string[], options?: MelodyOptions): void;
  function builtInMelody(melody: Melodies): string[];
}
declare namespace pins {
  function createBuffer(size: number): Buffer;
  function i2cWriteBuffer(address: number, buf: Buffer, repeat?: boolean): void;
  function setPull(name: DigitalPin, pull: PinPullMode): void;
  function digitalReadPin(name: DigitalPin): number;
  function digitalWritePin(name: DigitalPin, value: number): void;
  function analogReadPin(name: AnalogPin): number;
  function pulseIn(name: DigitalPin, value: PulseValue, maxDuration?: number): number;
}
declare namespace neopixel {
  class Strip {}
  function create(pin: DigitalPin, numleds: number, mode: NeoPixelMode): Strip;
}
// Añadidos para los bloques de botones, texto y matemáticas (núcleo de MakeCode).
declare const enum Button { A = 1, B = 2, AB = 3 }
declare namespace input { function onButtonPressed(button: Button, body: () => void): void }
declare namespace basic { function showString(text: string, interval?: number): void }
declare function randint(min: number, max: number): number;
interface Math {
  constrain(value: number, low: number, high: number): number;
  map(value: number, fromLow: number, fromHigh: number, toLow: number, toHigh: number): number;
}
