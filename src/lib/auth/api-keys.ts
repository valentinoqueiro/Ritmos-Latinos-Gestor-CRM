import { randomBytes, createHash } from "node:crypto";

// API keys para la API pública v1 (Fase 7, PLAN.md §3). Módulo PURO (sin
// Next ni base de datos): genera, hashea y verifica claves, y define los
// alcances posibles. El pegamento con la base vive en src/lib/api-publica.ts.
//
// Por qué SHA-256 y no bcrypt: una API key es un secreto aleatorio de alta
// entropía (no una contraseña elegida por una persona), así que no hace
// falta un hash lento contra fuerza bruta por diccionario. Necesitamos poder
// buscarla por igualdad exacta en la base (WHERE hash = ...) sin recorrer
// todas las filas — bcrypt no lo permite porque cada hash lleva una sal
// distinta. SHA-256 con un secreto de 256 bits de entropía es el estándar de
// facto para este caso (mismo enfoque que usan GitHub/Stripe: prefijo legible
// + hash determinístico indexable).

export const PREFIJO_CLAVE = "rlk_live_";

export const ALCANCES_API = [
  "leads:write",
  "leads:read",
  "alumnos:read",
  "vencimientos:read",
  "cumpleanos:read",
] as const;

export type AlcanceApi = (typeof ALCANCES_API)[number];

export const ETIQUETA_ALCANCE: Record<AlcanceApi, string> = {
  "leads:write": "Crear leads",
  "leads:read": "Leer leads (pipeline del CRM)",
  "alumnos:read": "Leer alumnos",
  "vencimientos:read": "Leer vencimientos",
  "cumpleanos:read": "Leer cumpleaños",
};

export function esAlcanceValido(valor: string): valor is AlcanceApi {
  return (ALCANCES_API as readonly string[]).includes(valor);
}

/** Genera una clave nueva: `rlk_live_<43 chars base64url>` (256 bits de entropía). */
export function generarClave(): {
  clave: string;
  hash: string;
  ultimosCaracteres: string;
} {
  const secreto = randomBytes(32).toString("base64url");
  const clave = `${PREFIJO_CLAVE}${secreto}`;
  return {
    clave,
    hash: hashearClave(clave),
    ultimosCaracteres: clave.slice(-4),
  };
}

export function hashearClave(clave: string): string {
  return createHash("sha256").update(clave, "utf8").digest("hex");
}

export function tieneAlcance(
  alcances: readonly string[],
  requerido: AlcanceApi,
): boolean {
  return alcances.includes(requerido);
}
