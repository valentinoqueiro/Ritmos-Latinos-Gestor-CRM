import "server-only";
import { and, countDistinct, eq, gte, inArray, lte, sql, sum } from "drizzle-orm";
import { db } from "@/db";
import { alumnos, gastos, pagos, suscripciones } from "@/db/schema";
import { autorizarSeccion, type UsuarioSesion } from "./auth/permissions";
import { hoyISO, ultimosMeses } from "./fechas";

// KPIs del dashboard (Fase 5). Los cálculos usan las MISMAS reglas derivadas
// que la operatoria (cobros, ocupación): un moroso del dashboard es el mismo
// moroso del listado de la secretaria. Mes = mes calendario en hora argentina.

export type PuntoFinanciero = {
  mes: string; // YYYY-MM
  ingresos: number;
  gastos: number;
  resultado: number;
};

/** Ingresos (pagos), gastos y resultado por mes, para las sedes indicadas. */
export async function serieFinanciera(
  usuario: UsuarioSesion,
  sedeIds: number[],
  cantidadMeses = 6,
): Promise<PuntoFinanciero[]> {
  autorizarSeccion(usuario, "dashboard");
  const meses = ultimosMeses(cantidadMeses);
  const desde = `${meses[0]}-01`;

  const mesDePago = sql<string>`to_char(${pagos.fechaPago}, 'YYYY-MM')`;
  const mesDeGasto = sql<string>`to_char(${gastos.fecha}, 'YYYY-MM')`;

  const [ingresosPorMes, gastosPorMes] = await Promise.all([
    db
      .select({ mes: mesDePago, total: sum(pagos.monto) })
      .from(pagos)
      .where(and(inArray(pagos.sedeId, sedeIds), gte(pagos.fechaPago, desde)))
      .groupBy(mesDePago),
    db
      .select({ mes: mesDeGasto, total: sum(gastos.monto) })
      .from(gastos)
      .where(and(inArray(gastos.sedeId, sedeIds), gte(gastos.fecha, desde)))
      .groupBy(mesDeGasto),
  ]);

  const ingresos = new Map(ingresosPorMes.map((f) => [f.mes, Number(f.total)]));
  const egresos = new Map(gastosPorMes.map((f) => [f.mes, Number(f.total)]));
  return meses.map((mes) => {
    const i = ingresos.get(mes) ?? 0;
    const g = egresos.get(mes) ?? 0;
    return { mes, ingresos: i, gastos: g, resultado: i - g };
  });
}

export type KpisAlumnos = {
  activos: number;
  altasDelMes: number;
  bajasDelMes: number;
};

/**
 * Alumno activo = tiene al menos una suscripción activa (derivado).
 * Altas/bajas del mes = suscripciones creadas / dadas de baja explícitamente
 * en el mes calendario actual (PLAN.md, decisión 4).
 */
export async function kpisAlumnos(
  usuario: UsuarioSesion,
  sedeIds: number[],
): Promise<KpisAlumnos> {
  autorizarSeccion(usuario, "dashboard");
  const mes = hoyISO().slice(0, 7);
  const desde = `${mes}-01`;
  const hasta = `${mes}-31`;

  const [[activos], [altas], [bajas]] = await Promise.all([
    db
      .select({ n: countDistinct(suscripciones.alumnoId) })
      .from(suscripciones)
      .where(
        and(
          inArray(suscripciones.sedeId, sedeIds),
          eq(suscripciones.estado, "activa"),
        ),
      ),
    db
      .select({ n: countDistinct(suscripciones.id) })
      .from(suscripciones)
      .where(
        and(
          inArray(suscripciones.sedeId, sedeIds),
          gte(suscripciones.fechaAlta, desde),
          lte(suscripciones.fechaAlta, hasta),
        ),
      ),
    db
      .select({ n: countDistinct(suscripciones.id) })
      .from(suscripciones)
      .where(
        and(
          inArray(suscripciones.sedeId, sedeIds),
          eq(suscripciones.estado, "baja"),
          gte(suscripciones.fechaBaja, desde),
          lte(suscripciones.fechaBaja, hasta),
        ),
      ),
  ]);
  return {
    activos: activos.n,
    altasDelMes: altas.n,
    bajasDelMes: bajas.n,
  };
}

export type Cumpleanero = {
  alumnoId: number;
  nombre: string;
  dia: number;
  cumpleAnios: number;
  telefono: string;
  sedeId: number;
};

/** Cumpleaños del mes actual, de alumnos con alguna suscripción activa. */
export async function cumpleanosDelMes(
  usuario: UsuarioSesion,
  sedeIds: number[],
): Promise<Cumpleanero[]> {
  autorizarSeccion(usuario, "dashboard");
  const hoy = hoyISO();
  const mesActual = Number(hoy.slice(5, 7));
  const anioActual = Number(hoy.slice(0, 4));

  const filas = await db
    .selectDistinct({
      alumnoId: alumnos.id,
      nombre: alumnos.nombre,
      apellido: alumnos.apellido,
      fechaNacimiento: alumnos.fechaNacimiento,
      telefono: alumnos.telefono,
      sedeId: alumnos.sedeId,
    })
    .from(alumnos)
    .innerJoin(suscripciones, eq(suscripciones.alumnoId, alumnos.id))
    .where(
      and(
        inArray(alumnos.sedeId, sedeIds),
        eq(suscripciones.estado, "activa"),
        sql`extract(month from ${alumnos.fechaNacimiento}) = ${mesActual}`,
      ),
    );

  return filas
    .map((f) => ({
      alumnoId: f.alumnoId,
      nombre: `${f.nombre} ${f.apellido}`,
      dia: Number(f.fechaNacimiento!.slice(8, 10)),
      cumpleAnios: anioActual - Number(f.fechaNacimiento!.slice(0, 4)),
      telefono: f.telefono,
      sedeId: f.sedeId,
    }))
    .sort((a, b) => a.dia - b.dia);
}
