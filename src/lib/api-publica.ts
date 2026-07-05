import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  alumnos,
  disciplinas,
  leadDisciplinas,
  leads,
  origenesNegocio,
  sedes,
  suscripciones,
} from "@/db/schema";
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

// Error de negocio de la ingesta pública: la ruta lo devuelve como 400 con
// el mensaje tal cual (sin filtrar detalles internos).
export class ErrorDeIngesta extends Error {}

export const esquemaLeadPublico = z.object({
  nombre: z.string().trim().min(2, "Poné el nombre"),
  telefono: z
    .string()
    .trim()
    .min(6, "Poné el teléfono/WhatsApp")
    .regex(/^[\d\s+()-]+$/, "El teléfono tiene caracteres inválidos"),
  email: z
    .string()
    .trim()
    .email("El email no parece válido")
    .nullable()
    .optional(),
  // OBSOLETO: la sede se deriva de las disciplinas de interés. Se sigue
  // aceptando por compatibilidad con integraciones existentes.
  sedeInteresId: z.number().int().positive().nullable().optional(),
  // Disciplinas de interés por NOMBRE (case-insensitive contra el catálogo
  // activo). Si un nombre existe en varias sedes, el lead queda en todas.
  disciplinas: z
    .array(z.string().trim().min(1))
    .max(10, "Demasiadas disciplinas")
    .optional(),
  // Origen de negocio por nombre (catálogo configurable: "Meta Ads",
  // "Instagram", "Web"...). Desconocido = error con los valores válidos.
  origenNegocio: z.string().trim().max(80).nullable().optional(),
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
    if (!sede) throw new ErrorDeIngesta("La sede de interés no existe");
  }

  // Disciplinas por nombre contra el catálogo activo (case-insensitive).
  let disciplinaIds: number[] = [];
  if (datos.disciplinas && datos.disciplinas.length > 0) {
    const catalogo = await db.query.disciplinas.findMany({
      where: eq(disciplinas.activa, true),
    });
    const idsPorNombre = new Map<string, number[]>();
    for (const d of catalogo) {
      const clave = d.nombre.toLowerCase();
      idsPorNombre.set(clave, [...(idsPorNombre.get(clave) ?? []), d.id]);
    }
    const ids = new Set<number>();
    for (const nombre of datos.disciplinas) {
      const encontradas = idsPorNombre.get(nombre.toLowerCase());
      if (!encontradas) {
        throw new ErrorDeIngesta(
          `Disciplina desconocida: "${nombre}". Válidas: ${[...new Set(catalogo.map((d) => d.nombre))].join(", ")}`,
        );
      }
      for (const id of encontradas) ids.add(id);
    }
    disciplinaIds = [...ids];
  }

  // Origen de negocio por nombre contra el catálogo configurable.
  let origenNegocioId: number | null = null;
  if (datos.origenNegocio) {
    const origenes = await db.query.origenesNegocio.findMany({
      where: eq(origenesNegocio.activo, true),
    });
    const origen = origenes.find(
      (o) => o.nombre.toLowerCase() === datos.origenNegocio!.toLowerCase(),
    );
    if (!origen) {
      throw new ErrorDeIngesta(
        `Origen desconocido: "${datos.origenNegocio}". Válidos: ${origenes.map((o) => o.nombre).join(", ")}`,
      );
    }
    origenNegocioId = origen.id;
  }

  return db.transaction(async (tx) => {
    const [creado] = await tx
      .insert(leads)
      .values({
        nombre: datos.nombre,
        telefono: datos.telefono,
        email: datos.email ?? null,
        sedeInteresId: datos.sedeInteresId ?? null,
        origenNegocioId,
        nota: datos.nota ?? null,
        origen: "api",
        fuente: datos.fuente,
      })
      .returning({ id: leads.id, estado: leads.estado });
    if (disciplinaIds.length > 0) {
      await tx.insert(leadDisciplinas).values(
        disciplinaIds.map((disciplinaId) => ({
          leadId: creado.id,
          disciplinaId,
        })),
      );
    }
    return creado;
  });
}

// --- Leads (lectura, para automatizaciones externas) ---------------------------

export const ESTADOS_LEAD_PUBLICOS = [
  "nuevo",
  "contactado",
  "prueba_agendada",
  "convertido",
  "perdido",
] as const;

export type LeadPublico = {
  id: number;
  nombre: string;
  telefono: string;
  email: string | null;
  estado: string;
  etapaDesde: string; // ISO: desde cuándo está en la etapa actual
  origen: string; // técnico: manual | api
  fuente: string | null;
  origenNegocio: string | null;
  disciplinas: { id: number; nombre: string; sedeId: number }[];
  sedeIds: number[]; // derivadas de las disciplinas
  pruebaFecha: string | null;
  motivoPerdida: string | null;
  alumnoId: number | null;
  creadoEn: string;
};

/**
 * Pipeline de leads en solo lectura (alcance leads:read): la vía para que
 * automatizaciones externas (recordatorios, seguimiento) lean el CRM.
 * Filtros opcionales: estado y desde (fecha de creación mínima, YYYY-MM-DD).
 */
export async function leadsPublicos(filtros: {
  estado?: (typeof ESTADOS_LEAD_PUBLICOS)[number];
  desde?: string;
}): Promise<LeadPublico[]> {
  const lista = await db.query.leads.findMany({
    where: filtros.estado ? eq(leads.estado, filtros.estado) : undefined,
  });
  const desde = filtros.desde ? new Date(`${filtros.desde}T00:00:00-03:00`) : null;
  const filtrados = desde ? lista.filter((l) => l.creadoEn >= desde) : lista;
  if (filtrados.length === 0) return [];

  const [intereses, origenes] = await Promise.all([
    db
      .select({
        leadId: leadDisciplinas.leadId,
        id: disciplinas.id,
        nombre: disciplinas.nombre,
        sedeId: disciplinas.sedeId,
      })
      .from(leadDisciplinas)
      .innerJoin(disciplinas, eq(leadDisciplinas.disciplinaId, disciplinas.id))
      .where(
        inArray(
          leadDisciplinas.leadId,
          filtrados.map((l) => l.id),
        ),
      ),
    db.query.origenesNegocio.findMany(),
  ]);

  return filtrados
    .sort((a, b) => b.creadoEn.getTime() - a.creadoEn.getTime())
    .map((l) => {
      const propias = intereses.filter((i) => i.leadId === l.id);
      return {
        id: l.id,
        nombre: l.nombre,
        telefono: l.telefono,
        email: l.email,
        estado: l.estado,
        etapaDesde: l.etapaDesde.toISOString(),
        origen: l.origen,
        fuente: l.fuente,
        origenNegocio:
          origenes.find((o) => o.id === l.origenNegocioId)?.nombre ?? null,
        disciplinas: propias.map(({ id, nombre, sedeId }) => ({
          id,
          nombre,
          sedeId,
        })),
        sedeIds: [...new Set(propias.map((i) => i.sedeId))].sort((a, b) => a - b),
        pruebaFecha: l.pruebaFecha,
        motivoPerdida: l.motivoPerdida,
        alumnoId: l.alumnoId,
        creadoEn: l.creadoEn.toISOString(),
      };
    });
}
