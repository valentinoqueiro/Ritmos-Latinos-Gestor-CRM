import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { alumnos, sedes, suscripciones, leads } from "@/db/schema";
import { cumpleanosEnMes, type Cumpleanero } from "./kpis";
import { cobrosPorSedes, type CobroDeSuscripcion } from "./cobros";

// Consultas y mutaciones de la API pública v1 (Fase 7, PLAN.md §3). Autorizada
// por alcance de API key (src/lib/auth/api-publica-guard.ts), no por rol de
// usuario interno — por eso NO reciben UsuarioSesion. Reutilizan la MISMA
// lógica derivada que usa el panel (cobros, cumpleaños): un moroso acá es el
// mismo moroso que ve la secretaria.

async function sedeIdsValidos(sedeId?: number): Promise<number[]> {
  if (sedeId === undefined) {
    const todas = await db.query.sedes.findMany({
      where: eq(sedes.activa, true),
    });
    return todas.map((s) => s.id);
  }
  const existe = await db.query.sedes.findFirst({ where: eq(sedes.id, sedeId) });
  return existe ? [existe.id] : [];
}

// --- Alumnos (lectura) -------------------------------------------------------

export type AlumnoPublico = {
  id: number;
  nombre: string;
  apellido: string;
  dni: string;
  telefono: string;
  sedeId: number;
  activo: boolean;
};

/** Datos básicos + estado (activo = alguna suscripción activa). Cross-sede, filtro opcional. */
export async function alumnosPublicos(sedeId?: number): Promise<AlumnoPublico[]> {
  const sedeIds = await sedeIdsValidos(sedeId);
  if (sedeIds.length === 0) return [];

  const filas = await db
    .select({
      id: alumnos.id,
      nombre: alumnos.nombre,
      apellido: alumnos.apellido,
      dni: alumnos.dni,
      telefono: alumnos.telefono,
      sedeId: alumnos.sedeId,
    })
    .from(alumnos)
    .where(inArray(alumnos.sedeId, sedeIds));
  if (filas.length === 0) return [];

  const activos = await db
    .selectDistinct({ alumnoId: suscripciones.alumnoId })
    .from(suscripciones)
    .where(
      and(
        eq(suscripciones.estado, "activa"),
        inArray(
          suscripciones.alumnoId,
          filas.map((f) => f.id),
        ),
      ),
    );
  const idsActivos = new Set(activos.map((a) => a.alumnoId));
  return filas.map((f) => ({ ...f, activo: idsActivos.has(f.id) }));
}

// --- Vencimientos (lectura) --------------------------------------------------

/** Cuotas por vencer y vencidas con datos de contacto. Cross-sede, filtro opcional. */
export async function vencimientosPublicos(
  sedeId?: number,
): Promise<CobroDeSuscripcion[]> {
  const sedeIds = await sedeIdsValidos(sedeId);
  if (sedeIds.length === 0) return [];
  const todos = await cobrosPorSedes(sedeIds);
  return todos.filter((c) => c.estado === "por_vencer" || c.estado === "vencida");
}

// --- Cumpleaños (lectura) -----------------------------------------------------

/** Cumpleaños que faltan en lo que resta del mes actual, con contacto. Cross-sede, filtro opcional. */
export async function cumpleanosProximos(sedeId?: number): Promise<Cumpleanero[]> {
  const sedeIds = await sedeIdsValidos(sedeId);
  if (sedeIds.length === 0) return [];
  return cumpleanosEnMes(sedeIds, { soloRestantes: true });
}

// --- Leads (escritura) --------------------------------------------------------

export const esquemaLeadPublico = z.object({
  nombre: z.string().trim().min(2, "Poné el nombre"),
  telefono: z
    .string()
    .trim()
    .min(6, "Poné el teléfono/WhatsApp")
    .regex(/^[\d\s+()-]+$/, "El teléfono tiene caracteres inválidos"),
  sedeInteresId: z.number().int().positive().nullable().optional(),
  fuente: z
    .string()
    .trim()
    .min(2, "Identificá la fuente (qué sistema envía el lead)")
    .max(80, "La fuente es muy larga"),
  nota: z
    .string()
    .trim()
    .max(300, "La nota es muy larga")
    .nullable()
    .optional(),
});

export type DatosLeadPublico = z.infer<typeof esquemaLeadPublico>;

/** Crea un lead con origen "api": entra al pipeline como "nuevo". */
export async function crearLeadPublico(datos: DatosLeadPublico) {
  if (datos.sedeInteresId) {
    const sede = await db.query.sedes.findFirst({
      where: eq(sedes.id, datos.sedeInteresId),
    });
    if (!sede) throw new Error("La sede de interés no existe");
  }
  const [creado] = await db
    .insert(leads)
    .values({
      nombre: datos.nombre,
      telefono: datos.telefono,
      sedeInteresId: datos.sedeInteresId ?? null,
      nota: datos.nota ?? null,
      origen: "api",
      fuente: datos.fuente,
    })
    .returning({ id: leads.id, estado: leads.estado });
  return creado;
}
