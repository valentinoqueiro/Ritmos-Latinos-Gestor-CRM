import "server-only";
import { and, asc, count, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import {
  alumnos,
  disciplinas,
  horarios,
  planes,
  planesDisciplinas,
  preciosPlan,
  suscripciones,
  suscripcionesHorarios,
} from "@/db/schema";
import {
  autorizarSede,
  sedesPermitidas,
  type UsuarioSesion,
} from "./auth/permissions";

// Consultas del núcleo operativo. TODAS reciben al usuario autenticado y una
// sede, y validan el alcance con autorizarSede antes de tocar la base.

export const DIAS = [
  "",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
] as const;

export function formatoHora(hora: string): string {
  return hora.slice(0, 5);
}

export function formatoMonto(monto: string | number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(Number(monto));
}

// --- Disciplinas y horarios ---------------------------------------------

export async function disciplinasDeSede(
  usuario: UsuarioSesion,
  sedeId: number,
  opciones: { incluirInactivas?: boolean } = {},
) {
  autorizarSede(usuario, sedeId);
  return db.query.disciplinas.findMany({
    where: opciones.incluirInactivas
      ? eq(disciplinas.sedeId, sedeId)
      : and(eq(disciplinas.sedeId, sedeId), eq(disciplinas.activa, true)),
    orderBy: asc(disciplinas.nombre),
  });
}

export type HorarioConOcupacion = {
  id: number;
  disciplinaId: number;
  disciplina: string;
  diaSemana: number;
  hora: string;
  nota: string | null;
  cupo: number | null;
  inscriptos: number;
  activo: boolean;
};

/** Horarios de la sede con su ocupación (suscripciones activas por horario). */
export async function horariosConOcupacion(
  usuario: UsuarioSesion,
  sedeId: number,
  opciones: { incluirInactivos?: boolean } = {},
): Promise<HorarioConOcupacion[]> {
  autorizarSede(usuario, sedeId);
  const filas = await db
    .select({
      id: horarios.id,
      disciplinaId: horarios.disciplinaId,
      disciplina: disciplinas.nombre,
      diaSemana: horarios.diaSemana,
      hora: horarios.hora,
      nota: horarios.nota,
      cupo: horarios.cupo,
      activo: horarios.activo,
    })
    .from(horarios)
    .innerJoin(disciplinas, eq(horarios.disciplinaId, disciplinas.id))
    .where(
      opciones.incluirInactivos
        ? eq(horarios.sedeId, sedeId)
        : and(eq(horarios.sedeId, sedeId), eq(horarios.activo, true)),
    )
    .orderBy(asc(horarios.diaSemana), asc(horarios.hora));

  if (filas.length === 0) return [];

  const ocupacion = await db
    .select({
      horarioId: suscripcionesHorarios.horarioId,
      inscriptos: count(),
    })
    .from(suscripcionesHorarios)
    .innerJoin(
      suscripciones,
      eq(suscripcionesHorarios.suscripcionId, suscripciones.id),
    )
    .where(
      and(
        eq(suscripciones.estado, "activa"),
        inArray(
          suscripcionesHorarios.horarioId,
          filas.map((f) => f.id),
        ),
      ),
    )
    .groupBy(suscripcionesHorarios.horarioId);

  const porHorario = new Map(ocupacion.map((o) => [o.horarioId, o.inscriptos]));
  return filas.map((f) => ({ ...f, inscriptos: porHorario.get(f.id) ?? 0 }));
}

// --- Planes y precios -----------------------------------------------------

export type PlanConPrecio = {
  id: number;
  nombre: string;
  tipo: "disciplina" | "pack" | "frecuencia";
  frecuenciaSemanal: number | null;
  activo: boolean;
  precioVigente: string | null;
  historialPrecios: { monto: string; vigenteDesde: Date }[];
  disciplinas: { id: number; nombre: string }[];
};

export async function planesDeSede(
  usuario: UsuarioSesion,
  sedeId: number,
  opciones: { incluirInactivos?: boolean } = {},
): Promise<PlanConPrecio[]> {
  autorizarSede(usuario, sedeId);
  const lista = await db.query.planes.findMany({
    where: opciones.incluirInactivos
      ? eq(planes.sedeId, sedeId)
      : and(eq(planes.sedeId, sedeId), eq(planes.activo, true)),
    orderBy: asc(planes.nombre),
  });
  if (lista.length === 0) return [];
  const ids = lista.map((p) => p.id);

  const [precios, vinculos] = await Promise.all([
    db
      .select()
      .from(preciosPlan)
      .where(inArray(preciosPlan.planId, ids))
      .orderBy(desc(preciosPlan.vigenteDesde)),
    db
      .select({
        planId: planesDisciplinas.planId,
        disciplinaId: disciplinas.id,
        nombre: disciplinas.nombre,
      })
      .from(planesDisciplinas)
      .innerJoin(
        disciplinas,
        eq(planesDisciplinas.disciplinaId, disciplinas.id),
      )
      .where(inArray(planesDisciplinas.planId, ids)),
  ]);

  const precioVigente = new Map<number, string>();
  for (const p of precios) {
    if (!precioVigente.has(p.planId)) precioVigente.set(p.planId, p.monto);
  }
  return lista.map((plan) => ({
    id: plan.id,
    nombre: plan.nombre,
    tipo: plan.tipo,
    frecuenciaSemanal: plan.frecuenciaSemanal,
    activo: plan.activo,
    precioVigente: precioVigente.get(plan.id) ?? null,
    historialPrecios: precios
      .filter((p) => p.planId === plan.id)
      .map((p) => ({ monto: p.monto, vigenteDesde: p.vigenteDesde })),
    disciplinas: vinculos
      .filter((v) => v.planId === plan.id)
      .map((v) => ({ id: v.disciplinaId, nombre: v.nombre })),
  }));
}

export async function historialDePrecios(
  usuario: UsuarioSesion,
  planId: number,
) {
  const plan = await db.query.planes.findFirst({ where: eq(planes.id, planId) });
  if (!plan) return null;
  autorizarSede(usuario, plan.sedeId);
  const precios = await db
    .select()
    .from(preciosPlan)
    .where(eq(preciosPlan.planId, planId))
    .orderBy(desc(preciosPlan.vigenteDesde));
  return { plan, precios };
}

// --- Alumnos ---------------------------------------------------------------

export async function buscarAlumnos(
  usuario: UsuarioSesion,
  sedeId: number,
  termino: string,
) {
  autorizarSede(usuario, sedeId);
  const filtroSede = eq(alumnos.sedeId, sedeId);
  const limpio = termino.trim();
  return db.query.alumnos.findMany({
    where: limpio
      ? and(
          filtroSede,
          or(
            ilike(alumnos.nombre, `%${limpio}%`),
            ilike(alumnos.apellido, `%${limpio}%`),
            ilike(alumnos.dni, `%${limpio}%`),
          ),
        )
      : filtroSede,
    orderBy: [asc(alumnos.apellido), asc(alumnos.nombre)],
    limit: 100,
  });
}

/**
 * Ficha completa: alumno + suscripciones con plan y horarios.
 * Si el alumno es de una sede fuera del alcance del usuario devuelve null
 * (mismo resultado que "no existe": no filtramos qué hay en otras sedes).
 */
export async function fichaDeAlumno(usuario: UsuarioSesion, alumnoId: number) {
  if (!Number.isInteger(alumnoId)) return null;
  const alumno = await db.query.alumnos.findFirst({
    where: eq(alumnos.id, alumnoId),
  });
  if (!alumno) return null;
  const permitidas = sedesPermitidas(usuario);
  if (permitidas !== "todas" && !permitidas.includes(alumno.sedeId)) {
    return null;
  }

  const subs = await db
    .select({
      id: suscripciones.id,
      estado: suscripciones.estado,
      fechaAlta: suscripciones.fechaAlta,
      fechaBaja: suscripciones.fechaBaja,
      motivoBaja: suscripciones.motivoBaja,
      montoAlta: suscripciones.montoAlta,
      planId: planes.id,
      plan: planes.nombre,
      tipoPlan: planes.tipo,
    })
    .from(suscripciones)
    .innerJoin(planes, eq(suscripciones.planId, planes.id))
    .where(eq(suscripciones.alumnoId, alumnoId))
    .orderBy(desc(suscripciones.creadaEn));

  const horariosPorSub =
    subs.length === 0
      ? []
      : await db
          .select({
            suscripcionId: suscripcionesHorarios.suscripcionId,
            diaSemana: horarios.diaSemana,
            hora: horarios.hora,
            nota: horarios.nota,
            disciplina: disciplinas.nombre,
          })
          .from(suscripcionesHorarios)
          .innerJoin(horarios, eq(suscripcionesHorarios.horarioId, horarios.id))
          .innerJoin(disciplinas, eq(horarios.disciplinaId, disciplinas.id))
          .where(
            inArray(
              suscripcionesHorarios.suscripcionId,
              subs.map((s) => s.id),
            ),
          )
          .orderBy(asc(horarios.diaSemana), asc(horarios.hora));

  return {
    alumno,
    suscripciones: subs.map((s) => ({
      ...s,
      horarios: horariosPorSub.filter((h) => h.suscripcionId === s.id),
    })),
  };
}
