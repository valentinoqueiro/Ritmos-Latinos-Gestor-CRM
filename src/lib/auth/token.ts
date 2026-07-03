import { SignJWT, jwtVerify } from "jose";
import type { UsuarioSesion } from "./permissions";

// Firma y verificación del token de sesión (JWT HS256 en cookie httpOnly).
// Módulo puro (recibe el secreto por parámetro) para poder testearlo aislado;
// el pegamento con cookies de Next vive en session.ts.

const DURACION_SESION = "30d";

function clave(secreto: string): Uint8Array {
  if (!secreto || secreto.length < 32) {
    throw new Error(
      "AUTH_SECRET debe existir y tener al menos 32 caracteres (ver .env.example)",
    );
  }
  return new TextEncoder().encode(secreto);
}

export async function firmarToken(
  usuario: UsuarioSesion,
  secreto: string,
): Promise<string> {
  return new SignJWT({ usuario })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(DURACION_SESION)
    .sign(clave(secreto));
}

export async function verificarToken(
  token: string,
  secreto: string,
): Promise<UsuarioSesion | null> {
  try {
    const { payload } = await jwtVerify(token, clave(secreto));
    const usuario = payload.usuario as UsuarioSesion | undefined;
    if (
      !usuario ||
      typeof usuario.id !== "number" ||
      typeof usuario.rol !== "string"
    ) {
      return null;
    }
    return usuario;
  } catch {
    return null;
  }
}
