import "./styles/main.css";
import { App } from "./ui/app";
import { setStudentScope, store } from "./ui/dom";
import type { Profile } from "./practices/perfil";

const root = document.getElementById("app")!;
// El avance (prácticas, calificaciones y programas) es del alumno que registró su perfil.
setStudentScope(store.get<Profile | null>("alumno:actual", null)?.correo ?? null);
// Quita el aviso de «este no es el archivo para abrir» que trae index.html.
root.replaceChildren();

/** El simulador dibuja con WebGL 2 (Chrome 90+, Edge 90+, Safari 15+, Firefox 90+). */
function hasWebGL2(): boolean {
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}

if (hasWebGL2()) {
  // Exponer la app facilita la verificación automática desde la consola del navegador.
  (window as unknown as { tinyPro: App }).tinyPro = new App(root);
} else {
  const box = document.createElement("div");
  box.className = "no-webgl";
  box.innerHTML =
    "<h1>Este navegador no puede mostrar el simulador en 3D</h1>" +
    "<p>Hace falta WebGL 2. Usa Google Chrome o Microsoft Edge (versión 90 o más reciente) o Safari 15 o más reciente.</p>" +
    "<p>Si ya los usas, revisa que esté activada la <b>aceleración por hardware</b> en la configuración del navegador y actualiza el controlador de la tarjeta gráfica.</p>";
  root.append(box);
}
