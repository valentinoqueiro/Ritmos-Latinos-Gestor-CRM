import "server-only";
import { and, asc, desc, eq, inArray, max } from "drizzle-orm";
import { db } from "@/db";
import {
  alumnos,
  configuracion,
  pagos,
  planes,
  preciosPlan,
  suscripciones,
} from "@/db/schema";
import { autorizarSede, type UsuarioSesion } from "./auth/permissions";
import { hoyISO } from "./fechas";
import {
  diasParaVencer,
  estadoCuota,
  UMBRAL_POR_VENCER_DEFAULT,
  type EstadoCuota,
} from "./vencimientos";

// Estado de cobro SIEMPRE derivado de los pagos — acá vive la única consulta
// que lo calcula; pantallas, listados y (más adelante) KPIs la reutilizan.

export const CLAVE_UMBRAL = "umbral_por_vencer_dias";

export async function umbralPorVencer(): Promise<number> {
  const fila = await db.query.configuracion.findFirst({
    where: eq(configuracion.clave, CLAVE_UMBRAL),
  });
  const valor = Number(fila?.valor);
  return Number.isInteger(valor) && valor >= 0
    ? valor
    : UMBRAL_POR_VENCER_DEFAULT;
}

export type CobroDeSuscripcion = {
  suscripcionId: number;
  alumnoId: number;
  alumno: string;
  telefono: string;
  plan: string;
  vence: string | null; // null = nunca pagó
  estado: EstadoCuota;
  diasRestantes: number | null; // negativo si venció; null si nunca pagó
  precioVigente: string | null;
};

/**
 * Estado de cobro de TODAS las suscripciones activas de una sede.
 * Valida el alcance por sede del usuario.
 */
export async function cobrosDeSede(
  usuario: UsuarioSesion,
  sedeId: number,
): Promise<CobroDeSuscripcion[]> {
  autorizarSede(usuario, sedeId);
  const hoy = hoyISO();
  const umbral = await umbralPorVencer();

  const filas = await db
    .select({
      suscripcionId: suscripciones.id,
      alumnoId: alumnos.id,
      nombre: alumnos.nombre,
      apellido: alumnos.apellido,
      telefono: alumnos.telefono,
      plan: planes.nombre,
      planId: planes.id,
      vence: max(pagos.vence),
    })
    .from(suscripciones)
    .innerJoin(alumnos, eq(suscripciones.alumnoId, alumnos.id))
    .innerJoin(planes, eq(suscripciones.planId, planes.id))
    .leftJoin(pagos, eq(pagos.suscripcionId, suscripciones.id))
    .where(
      and(eq(suscripciones.sedeId, sedeId), eq(suscripciones.estado, "activa")),
    )
    .groupBy(
      suscripciones.id,
      alumnos.id,
      alumnos.nombre,
      alumnos.apellido,
      alumnos.telefono,
      planes.nombre,
      planes.id,
    )
    .orderBy(asc(alumnos.apellido), asc(alumnos.nombre));

  if (filas.length === 0) return [];

  const precios = await db
    .select()
    .from(preciosPlan)
    .where(inArray(preciosPlan.planId, [...new Set(filas.map((f) => f.planId))]))
    .orderBy(desc(preciosPlan.vigenteDesde));
  const precioVigente = new Map<number, string>();
  for (const p of precios) {
    if (!precioVigente.has(p.planId)) precioVigente.set(p.planId, p.monto);
  }

  return filas.map((f) => ({
    suscripcionId: f.suscripcionId,
    alumnoId: f.alumnoId,
    alumno: `${f.apellido}, ${f.nombre}`,
    telefono: f.telefono,
    plan: f.plan,
    vence: f.vence,
    estado: estadoCuota(f.vence, hoy, umbral),
    diasRestantes: f.vence === null ? null : diasParaVencer(f.vence, hoy),
    precioVigente: precioVigente.get(f.planId) ?? null,
  }));
}

/** Última fecha de vencimiento habilitada de una suscripción (o null). */
export async function venceVigente(
  suscripcionId: number,
): Promise<string | null> {
  const [fila] = await db
    .select({ vence: max(pagos.vence) })
    .from(pagos)
    .where(eq(pagos.suscripcionId, suscripcionId));
  return fila?.vence ?? null;
}

/** Historial de pagos de un conjunto de suscripciones (para la ficha). */
export async function pagosDeSuscripciones(suscripcionIds: number[]) {
  if (suscripcionIds.length === 0) return [];
  return db
    .select()
    .from(pagos)
    .where(inArray(pagos.suscripcionId, suscripcionIds))
    .orderBy(desc(pagos.fechaPago), desc(pagos.creadoEn));
}
