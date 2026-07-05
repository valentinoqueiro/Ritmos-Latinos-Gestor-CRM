import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { usuarios } from "@/db/schema";
import { COOKIE_SESION } from "./cookie";
import { usuarioVigente, type UsuarioSesion } from "./permissions";
import { firmarToken, verificarToken } from "./token";

export { COOKIE_SESION } from "./cookie";
const DIAS_SESION = 30;

function secreto(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("Falta la variable de entorno AUTH_SECRET");
  return s;
}

export async function crearSesion(usuario: UsuarioSesion): Promise<void> {
  const token = await firmarToken(usuario, secreto());
  const jar = await cookies();
  jar.set(COOKIE_SESION, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * DIAS_SESION,
    path: "/",
  });
}

// cache(): una sola verificación de JWT + consulta de usuario por request
// aunque layout y página pidan la sesión cada uno. Además devuelve SIEMPRE el
// mismo objeto usuario, lo que permite que sedesVisibles/sedeActiva (también
// cacheadas por argumento) deduplen sus consultas a la base.
export const obtenerSesion = cache(
  async (): Promise<UsuarioSesion | null> => {
    const jar = await cookies();
    const token = jar.get(COOKIE_SESION)?.value;
    if (!token) return null;
    const sesion = await verificarToken(token, secreto());
    if (!sesion) return null;
    // El token prueba la identidad; la base manda sobre el estado actual
    // (existencia, activo, rol, sede). Ver usuarioVigente en permissions.ts.
    const fila = await db.query.usuarios.findFirst({
      where: eq(usuarios.id, sesion.id),
    });
    return usuarioVigente(fila);
  },
);

export async function cerrarSesion(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_SESION);
}
