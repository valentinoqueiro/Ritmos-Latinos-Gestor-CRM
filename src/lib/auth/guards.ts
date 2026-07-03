import "server-only";
import { redirect } from "next/navigation";
import { obtenerSesion } from "./session";
import {
  autorizarSeccion,
  puedeAcceder,
  type Seccion,
  type UsuarioSesion,
} from "./permissions";

// Guardas transversales para PANTALLAS (server components / server actions).
// Para rutas de API usar las variantes de api-guards.ts (devuelven JSON, no redirigen).

export async function requerirUsuario(): Promise<UsuarioSesion> {
  const usuario = await obtenerSesion();
  if (!usuario) redirect("/login");
  return usuario;
}

export async function requerirSeccion(
  seccion: Seccion,
): Promise<UsuarioSesion> {
  const usuario = await requerirUsuario();
  if (!puedeAcceder(usuario.rol, seccion)) {
    // Fuera de su alcance: lo mandamos a su pantalla inicial, sin filtrar detalles.
    redirect(rutaInicial(usuario));
  }
  return usuario;
}

// Variante para server actions: lanza (no redirige), el caller decide el mensaje.
export async function exigirSeccion(seccion: Seccion): Promise<UsuarioSesion> {
  const usuario = await requerirUsuario();
  autorizarSeccion(usuario, seccion);
  return usuario;
}

export function rutaInicial(usuario: UsuarioSesion): string {
  return usuario.rol === "owner" ? "/dashboard" : "/inicio";
}
