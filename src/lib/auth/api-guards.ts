import "server-only";
import { NextResponse } from "next/server";
import { obtenerSesion } from "./session";
import {
  puedeAcceder,
  type Seccion,
  type UsuarioSesion,
} from "./permissions";

// Guardas para rutas de API internas: responden JSON con el código correcto
// en lugar de redirigir. Misma matriz de permisos que las pantallas.

export type ResultadoGuard =
  | { ok: true; usuario: UsuarioSesion }
  | { ok: false; respuesta: NextResponse };

export async function usuarioDeApi(): Promise<ResultadoGuard> {
  const usuario = await obtenerSesion();
  if (!usuario) {
    return {
      ok: false,
      respuesta: NextResponse.json(
        { error: "No autenticado" },
        { status: 401 },
      ),
    };
  }
  return { ok: true, usuario };
}

export async function usuarioDeApiConSeccion(
  seccion: Seccion,
): Promise<ResultadoGuard> {
  const resultado = await usuarioDeApi();
  if (!resultado.ok) return resultado;
  if (!puedeAcceder(resultado.usuario.rol, seccion)) {
    return {
      ok: false,
      respuesta: NextResponse.json(
        { error: "Sin permiso" },
        { status: 403 },
      ),
    };
  }
  return resultado;
}
