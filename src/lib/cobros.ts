import "server-only";
import { cache } from "react";
import { and, asc, desc, eq, inArray, max, sum } from "drizzle-orm";
import { db } from "@/db";
import {
  alumnos,
  configuracion,
  pagoEntregas,
  pagos,
  planes,
  preciosPlan,
  suscripciones,
} from "@/db/schema";
import { autorizarSede, type UsuarioSesion } from "./auth/permissions";
import { saldoPendiente, totalEntregado } from "./deuda";
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

// cache(): varias consultas del mismo request (ficha, cobros por sede, KPIs)
// necesitan el umbral; con esto la config se lee una sola vez por request.
export const umbralPorVencer = cache(async (): Promise<number> => {
  const fila = await db.query.configuracion.findFirst({
    where: eq(configuracion.clave, CLAVE_UMBRAL),
  });
  const valor = Number(fila?.valor);
  return Number.isInteger(valor) && valor >= 0
    ? valor
    : UMBRAL_POR_VENCER_DEFAULT;
});

export type CobroDeSuscripcion = {
  suscripcionId: number;
  sedeId: number;
  alumnoId: number;
  alumno: string;
  telefono: string;
  plan: string;
  vence: string | null; // null = nunca pagó
  estado: EstadoCuota;
  diasRestantes: number | null; // negativo si venció; null si nunca pagó
  precioVigente: string | null;
  // Deuda de pagos parciales: acordado - entregado de todos sus contratos.
  saldoPendiente: number;
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
  return cobrosPorSedes([sedeId]);
}

/**
 * Cobros de varias sedes en UNA sola consulta (dashboard consolidado):
 * antes se consultaba sede por sede y los tiempos se sumaban.
 */
export async function cobrosDeSedes(
  usuario: UsuarioSesion,
  sedeIds: number[],
): Promise<CobroDeSuscripcion[]> {
  for (const sedeId of sedeIds) autorizarSede(usuario, sedeId);
  return cobrosPorSedes(sedeIds);
}

/**
 * Misma consulta que `cobrosDeSede`, sin autorización de usuario interno:
 * la reutiliza la API pública v1 (src/lib/api-publica.ts), que autoriza por
 * alcance de API key en vez de rol+sede.
 */
export async function cobrosPorSedes(
  sedeIds: number[],
): Promise<CobroDeSuscripcion[]> {
  if (sedeIds.length === 0) return [];
  const hoy = hoyISO();
  const umbral = await umbralPorVencer();

  const filas = await db
    .select({
      suscripcionId: suscripciones.id,
      sedeId: suscripciones.sedeId,
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
      and(
        inArray(suscripciones.sedeId, sedeIds),
        eq(suscripciones.estado, "activa"),
      ),
    )
    .groupBy(
      suscripciones.id,
      suscripciones.sedeId,
      alumnos.id,
      alumnos.nombre,
      alumnos.apellido,
      alumnos.telefono,
      planes.nombre,
      planes.id,
    )
    .orderBy(asc(alumnos.apellido), asc(alumnos.nombre));

  if (filas.length === 0) return [];

  const subIds = filas.map((f) => f.suscripcionId);
  // Acordado y entregado se suman en queries separadas: un join único entre
  // pagos y entregas duplicaría los montos de pagos con varias entregas.
  const [precios, acordados, entregados] = await Promise.all([
    db
      .select()
      .from(preciosPlan)
      .where(
        inArray(preciosPlan.planId, [...new Set(filas.map((f) => f.planId))]),
      )
      .orderBy(desc(preciosPlan.vigenteDesde)),
    db
      .select({ suscripcionId: pagos.suscripcionId, total: sum(pagos.monto) })
      .from(pagos)
      .where(inArray(pagos.suscripcionId, subIds))
      .groupBy(pagos.suscripcionId),
    db
      .select({
        suscripcionId: pagos.suscripcionId,
        total: sum(pagoEntregas.monto),
      })
      .from(pagoEntregas)
      .innerJoin(pagos, eq(pagoEntregas.pagoId, pagos.id))
      .where(inArray(pagos.suscripcionId, subIds))
      .groupBy(pagos.suscripcionId),
  ]);
  const precioVigente = new Map<number, string>();
  for (const p of precios) {
    if (!precioVigente.has(p.planId)) precioVigente.set(p.planId, p.monto);
  }
  const acordadoPorSub = new Map(
    acordados.map((a) => [a.suscripcionId, Number(a.total)]),
  );
  const entregadoPorSub = new Map(
    entregados.map((e) => [e.suscripcionId, Number(e.total)]),
  );

  return filas.map((f) => ({
    suscripcionId: f.suscripcionId,
    sedeId: f.sedeId,
    alumnoId: f.alumnoId,
    alumno: `${f.apellido}, ${f.nombre}`,
    telefono: f.telefono,
    plan: f.plan,
    vence: f.vence,
    estado: estadoCuota(f.vence, hoy, umbral),
    diasRestantes: f.vence === null ? null : diasParaVencer(f.vence, hoy),
    precioVigente: precioVigente.get(f.planId) ?? null,
    saldoPendiente: saldoPendiente(
      acordadoPorSub.get(f.suscripcionId) ?? 0,
      entregadoPorSub.get(f.suscripcionId) ?? 0,
    ),
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

/**
 * Historial de contratos de un conjunto de suscripciones (para la ficha),
 * cada uno con sus entregas y el saldo que falta completar.
 */
export async function pagosDeSuscripciones(suscripcionIds: number[]) {
  if (suscripcionIds.length === 0) return [];
  const filas = await db
    .select()
    .from(pagos)
    .where(inArray(pagos.suscripcionId, suscripcionIds))
    .orderBy(desc(pagos.fechaPago), desc(pagos.creadoEn));
  if (filas.length === 0) return [];

  const entregas = await db
    .select()
    .from(pagoEntregas)
    .where(
      inArray(
        pagoEntregas.pagoId,
        filas.map((f) => f.id),
      ),
    )
    .orderBy(asc(pagoEntregas.fecha), asc(pagoEntregas.creadoEn));

  return filas.map((pago) => {
    const propias = entregas.filter((e) => e.pagoId === pago.id);
    return {
      ...pago,
      entregas: propias,
      saldoPendiente: saldoPendiente(Number(pago.monto), totalEntregado(propias)),
    };
  });
}
