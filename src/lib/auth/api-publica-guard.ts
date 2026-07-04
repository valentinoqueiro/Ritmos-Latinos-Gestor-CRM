import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { hashearClave, tieneAlcance, type AlcanceApi } from "./api-keys";
import { excedeLimite } from "./rate-limit";

// Guarda de autenticación para /api/v1 (API pública, distinta de la sesión de
// usuario interno: ver api-guards.ts para esa). Misma idea — devuelve una
// NextResponse lista para retornar en vez de lanzar — pero el sujeto acá es
// una API key, no un usuario con rol.

export type ResultadoAuthApi =
  | { ok: true; apiKeyId: number }
  | { ok: false; respuesta: NextResponse };

function rechazo(mensaje: string, status: number): ResultadoAuthApi {
  return { ok: false, respuesta: NextResponse.json({ error: mensaje }, { status }) };
}

function claveDelEncabezado(request: NextRequest): string | null {
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim() || null;
  return null;
}

/**
 * Autentica la API key del encabezado `Authorization: Bearer <clave>` y
 * verifica que tenga el alcance pedido. El mensaje de error es el mismo
 * tanto si la clave no existe como si está revocada: no filtramos cuál de
 * las dos pasó.
 */
export async function autenticarApiPublica(
  request: NextRequest,
  alcanceRequerido: AlcanceApi,
): Promise<ResultadoAuthApi> {
  const clave = claveDelEncabezado(request);
  if (!clave) {
    return rechazo(
      "Falta la API key (encabezado Authorization: Bearer <clave>)",
      401,
    );
  }

  const hash = hashearClave(clave);
  const fila = await db.query.apiKeys.findFirst({
    where: eq(apiKeys.hash, hash),
  });
  if (!fila || !fila.activa) {
    return rechazo("API key inválida o revocada", 401);
  }

  if (excedeLimite(fila.id)) {
    return rechazo(
      "Demasiadas solicitudes. Esperá un minuto e intentá de nuevo.",
      429,
    );
  }

  if (!tieneAlcance(fila.alcances, alcanceRequerido)) {
    return rechazo("Esta API key no tiene el alcance necesario", 403);
  }

  await db
    .update(apiKeys)
    .set({ ultimoUso: new Date() })
    .where(eq(apiKeys.id, fila.id));

  return { ok: true, apiKeyId: fila.id };
}
