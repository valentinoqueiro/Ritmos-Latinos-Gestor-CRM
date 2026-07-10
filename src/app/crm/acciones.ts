"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  alumnos,
  configuracion,
  horarios,
  leadActividades,
  leadDisciplinas,
  leads,
  origenesNegocio,
} from "@/db/schema";
import { exigirSeccion } from "@/lib/auth/guards";
import { ErrorAutorizacion } from "@/lib/auth/permissions";
import { formatoFecha, hoyISO } from "@/lib/fechas";
import {
  CLAVE_WEBHOOK_INVITACIONES_TOKEN,
  CLAVE_WEBHOOK_INVITACIONES_URL,
  esquemaInvitacion,
  payloadInvitacion,
  webhookConfigurado,
} from "@/lib/invitaciones";
import {
  ETIQUETA_ESTADO_LEAD,
  puedeTransicionar,
  type EstadoLead,
} from "@/lib/reglas-leads";

// CRM: SOLO admin (sección "crm"), cross-sede. Toda acción valida la
// transición del pipeline en el servidor (src/lib/reglas-leads.ts).

export type EstadoAccion = { error?: string; ok?: boolean };

function mensajeDeError(error: unknown): EstadoAccion {
  if (error instanceof ErrorAutorizacion) return { error: error.message };
  if (error instanceof z.ZodError)
    return { error: error.issues[0]?.message ?? "Datos inválidos" };
  console.error(error);
  return { error: "Algo salió mal. Probá de nuevo." };
}

async function cargarLead(leadId: number) {
  return db.query.leads.findFirst({ where: eq(leads.id, leadId) });
}

async function avanzarEstado(
  leadId: number,
  destino: EstadoLead,
  extras: Partial<typeof leads.$inferInsert> = {},
  opciones: { usuarioId?: number; detalle?: string } = {},
): Promise<EstadoAccion> {
  const lead = await cargarLead(leadId);
  if (!lead) return { error: "El lead no existe" };
  if (!puedeTransicionar(lead.estado, destino)) {
    return {
      error: `No se puede pasar de "${lead.estado}" a "${destino}"`,
    };
  }
  // Reabrir un perdido limpia el motivo de pérdida (queda en el historial) y
  // lo dice explícito en la actividad.
  const reabierto = lead.estado === "perdido";
  // etapaDesde alimenta el "hace cuánto está acá" y la alerta de lead frío;
  // cada transición deja además su rastro en el historial de actividad.
  await db.transaction(async (tx) => {
    await tx
      .update(leads)
      .set({
        estado: destino,
        etapaDesde: new Date(),
        actualizadoEn: new Date(),
        ...(reabierto ? { motivoPerdida: null } : {}),
        ...extras,
      })
      .where(eq(leads.id, leadId));
    await tx.insert(leadActividades).values({
      leadId,
      tipo: "sistema",
      detalle:
        opciones.detalle ??
        `${reabierto ? "Reabierto: pasó" : "Pasó"} a ${ETIQUETA_ESTADO_LEAD[destino]}`,
      registradoPorId: opciones.usuarioId ?? null,
    });
  });
  revalidatePath("/crm");
  revalidatePath(`/crm/${leadId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

// --- Alta manual ---------------------------------------------------------------

// La sede ya no se pide: se deriva de las disciplinas de interés (rediseño CRM).
const esquemaLead = z.object({
  nombre: z.string().trim().min(2, "Poné el nombre"),
  telefono: z
    .string()
    .trim()
    .min(6, "Poné el teléfono/WhatsApp")
    .regex(/^[\d\s+()-]+$/, "El teléfono tiene caracteres inválidos"),
  email: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.string().email("El email no parece válido").nullable()),
  disciplinaIds: z.array(z.coerce.number().int().positive()),
  origenNegocioId: z.preprocess(
    (v) => (v === "" || v === null ? null : v),
    z.coerce.number().int().positive().nullable(),
  ),
  nota: z
    .string()
    .trim()
    .max(300, "La nota es muy larga")
    .transform((v) => (v === "" ? null : v)),
});

export async function crearLead(
  _estado: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  try {
    await exigirSeccion("crm");
    const datos = esquemaLead.parse({
      nombre: formData.get("nombre"),
      telefono: formData.get("telefono"),
      email: formData.get("email") ?? "",
      disciplinaIds: formData.getAll("disciplinaIds"),
      origenNegocioId: formData.get("origenNegocioId") ?? "",
      nota: formData.get("nota") ?? "",
    });
    const { disciplinaIds, ...ficha } = datos;
    await db.transaction(async (tx) => {
      const [lead] = await tx
        .insert(leads)
        .values({ ...ficha, origen: "manual" })
        .returning();
      if (disciplinaIds.length > 0) {
        await tx.insert(leadDisciplinas).values(
          disciplinaIds.map((disciplinaId) => ({
            leadId: lead.id,
            disciplinaId,
          })),
        );
      }
    });
    revalidatePath("/crm");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    return mensajeDeError(error);
  }
}

/**
 * Movimiento directo del kanban entre etapas SIN formulario: contactado y
 * nuevo (retrocesos incluidos). Agendar prueba, perder y convertir tienen
 * sus propias acciones porque piden datos.
 */
export async function moverLead(
  _estado: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  try {
    const usuario = await exigirSeccion("crm");
    const datos = z
      .object({
        leadId: z.coerce.number().int().positive(),
        destino: z.enum(["nuevo", "contactado"]),
      })
      .parse({
        leadId: formData.get("leadId"),
        destino: formData.get("destino"),
      });
    return await avanzarEstado(
      datos.leadId,
      datos.destino,
      {},
      { usuarioId: usuario.id },
    );
  } catch (error) {
    return mensajeDeError(error);
  }
}

/** Nota manual de seguimiento en el historial del lead (con canal). */
export async function agregarNota(
  _estado: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  try {
    const usuario = await exigirSeccion("crm");
    const datos = z
      .object({
        leadId: z.coerce.number().int().positive(),
        canal: z.enum(["whatsapp", "llamada", "presencial", "otro"]),
        detalle: z
          .string()
          .trim()
          .min(2, "Contá qué se habló")
          .max(500, "La nota es muy larga"),
      })
      .parse({
        leadId: formData.get("leadId"),
        canal: formData.get("canal"),
        detalle: formData.get("detalle"),
      });
    const lead = await cargarLead(datos.leadId);
    if (!lead) return { error: "El lead no existe" };
    await db.insert(leadActividades).values({
      leadId: lead.id,
      tipo: "nota",
      canal: datos.canal,
      detalle: datos.detalle,
      registradoPorId: usuario.id,
    });
    revalidatePath(`/crm/${lead.id}`);
    revalidatePath("/crm");
    return { ok: true };
  } catch (error) {
    return mensajeDeError(error);
  }
}

/**
 * Disciplinas de interés y origen de negocio del lead (editable en la ficha:
 * así la admin clasifica los leads que llegaron "sin disciplina").
 */
export async function guardarInteresesLead(
  _estado: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  try {
    await exigirSeccion("crm");
    const datos = z
      .object({
        leadId: z.coerce.number().int().positive(),
        disciplinaIds: z.array(z.coerce.number().int().positive()),
        origenNegocioId: z.preprocess(
          (v) => (v === "" || v === null ? null : v),
          z.coerce.number().int().positive().nullable(),
        ),
      })
      .parse({
        leadId: formData.get("leadId"),
        disciplinaIds: formData.getAll("disciplinaIds"),
        origenNegocioId: formData.get("origenNegocioId") ?? "",
      });
    const lead = await cargarLead(datos.leadId);
    if (!lead) return { error: "El lead no existe" };
    if (datos.origenNegocioId) {
      const origen = await db.query.origenesNegocio.findFirst({
        where: eq(origenesNegocio.id, datos.origenNegocioId),
      });
      if (!origen) return { error: "El origen no existe" };
    }
    await db.transaction(async (tx) => {
      await tx
        .update(leads)
        .set({
          origenNegocioId: datos.origenNegocioId,
          actualizadoEn: new Date(),
        })
        .where(eq(leads.id, lead.id));
      await tx.delete(leadDisciplinas).where(eq(leadDisciplinas.leadId, lead.id));
      if (datos.disciplinaIds.length > 0) {
        await tx.insert(leadDisciplinas).values(
          datos.disciplinaIds.map((disciplinaId) => ({
            leadId: lead.id,
            disciplinaId,
          })),
        );
      }
    });
    revalidatePath(`/crm/${lead.id}`);
    revalidatePath("/crm");
    return { ok: true };
  } catch (error) {
    return mensajeDeError(error);
  }
}

/**
 * Email del lead, editable desde la ficha: hace falta para la invitación a la
 * clase de prueba, y sirve para corregir emails que llegan mal de Meta.
 * Vacío = borrarlo.
 */
export async function guardarEmailLead(
  _estado: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  try {
    await exigirSeccion("crm");
    const datos = z
      .object({
        leadId: z.coerce.number().int().positive(),
        email: z
          .string()
          .trim()
          .transform((v) => (v === "" ? null : v))
          .pipe(z.string().email("El email no parece válido").nullable()),
      })
      .parse({
        leadId: formData.get("leadId"),
        email: formData.get("email") ?? "",
      });
    const lead = await cargarLead(datos.leadId);
    if (!lead) return { error: "El lead no existe" };
    await db
      .update(leads)
      .set({ email: datos.email, actualizadoEn: new Date() })
      .where(eq(leads.id, lead.id));
    revalidatePath(`/crm/${lead.id}`);
    revalidatePath("/crm");
    return { ok: true };
  } catch (error) {
    return mensajeDeError(error);
  }
}

/**
 * Marca que se le mandó el recordatorio de la clase de prueba por WhatsApp
 * (el botón «Recordar» de la tarjeta abre el chat y dispara esto). Queda la
 * marca para el "ya se le recordó" y el rastro en el historial.
 */
export async function marcarPruebaRecordada(
  _estado: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  try {
    const usuario = await exigirSeccion("crm");
    const leadId = z.coerce
      .number()
      .int()
      .positive()
      .parse(formData.get("leadId"));
    const lead = await cargarLead(leadId);
    if (!lead) return { error: "El lead no existe" };
    if (lead.estado !== "prueba_agendada" || !lead.pruebaFecha) {
      return { error: "Este lead no tiene una clase de prueba agendada" };
    }
    const fechaPrueba = lead.pruebaFecha;
    await db.transaction(async (tx) => {
      await tx
        .update(leads)
        .set({ pruebaRecordadaEn: new Date(), actualizadoEn: new Date() })
        .where(eq(leads.id, lead.id));
      await tx.insert(leadActividades).values({
        leadId: lead.id,
        tipo: "sistema",
        detalle: `Recordatorio de la clase de prueba (${formatoFecha(fechaPrueba)}) enviado por WhatsApp`,
        registradoPorId: usuario.id,
      });
    });
    revalidatePath("/crm");
    revalidatePath(`/crm/${lead.id}`);
    return { ok: true };
  } catch (error) {
    return mensajeDeError(error);
  }
}

// --- Invitación a la clase de prueba (webhook a n8n) -----------------------------

/**
 * POST al webhook externo (n8n) que arma y manda el voucher de la clase de
 * prueba. Los datos salen de la previsualización (editables ahí, NO tocan la
 * ficha del lead). Solo se registra el envío si el webhook respondió bien:
 * un fallo deja todo como estaba para poder reintentar.
 *
 * El token de autenticación nunca se loguea ni vuelve al navegador.
 */
export async function enviarInvitacion(
  _estado: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  try {
    const usuario = await exigirSeccion("crm");
    const leadId = z.coerce
      .number()
      .int()
      .positive()
      .parse(formData.get("leadId"));
    const datos = esquemaInvitacion.parse({
      nombre: formData.get("nombre"),
      email: formData.get("email") ?? "",
      disciplina: formData.get("disciplina"),
      sede: formData.get("sede"),
      direccion: formData.get("direccion"),
      fecha: formData.get("fecha"),
      hora: formData.get("hora"),
    });

    const lead = await cargarLead(leadId);
    if (!lead) return { error: "El lead no existe" };
    if (lead.estado !== "prueba_agendada") {
      return {
        error:
          "La invitación se manda con la clase de prueba agendada; este lead ya no está en esa etapa.",
      };
    }

    const [filaUrl, filaToken] = await Promise.all([
      db.query.configuracion.findFirst({
        where: eq(configuracion.clave, CLAVE_WEBHOOK_INVITACIONES_URL),
      }),
      db.query.configuracion.findFirst({
        where: eq(configuracion.clave, CLAVE_WEBHOOK_INVITACIONES_TOKEN),
      }),
    ]);
    if (!webhookConfigurado(filaUrl?.valor, filaToken?.valor)) {
      return {
        error:
          "Falta configurar el envío de invitaciones (URL y token del webhook) en Configuración.",
      };
    }

    // El fallo del webhook NO registra el envío: el error queda a la vista y
    // el botón sigue ahí para reintentar.
    let respuesta: Response;
    try {
      respuesta = await fetch(filaUrl!.valor.trim(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${filaToken!.valor.trim()}`,
        },
        body: JSON.stringify(payloadInvitacion(datos)),
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      });
    } catch {
      return {
        error:
          "No se pudo contactar al sistema de invitaciones (no respondió a tiempo o la URL no está disponible). No se registró el envío: probá de nuevo en un rato.",
      };
    }
    if (!respuesta.ok) {
      return {
        error: `El sistema de invitaciones devolvió un error (código ${respuesta.status}). No se registró el envío: probá de nuevo.`,
      };
    }

    await db.transaction(async (tx) => {
      await tx
        .update(leads)
        .set({ invitacionEnviadaEn: new Date(), actualizadoEn: new Date() })
        .where(eq(leads.id, lead.id));
      await tx.insert(leadActividades).values({
        leadId: lead.id,
        tipo: "sistema",
        detalle: `Invitación a la clase de prueba enviada a ${datos.email}`,
        registradoPorId: usuario.id,
      });
    });
    revalidatePath(`/crm/${lead.id}`);
    revalidatePath("/crm");
    return { ok: true };
  } catch (error) {
    return mensajeDeError(error);
  }
}

// --- Avances del pipeline ---------------------------------------------------------

export async function marcarContactado(formData: FormData): Promise<void> {
  const usuario = await exigirSeccion("crm");
  const leadId = z.coerce.number().int().positive().parse(formData.get("leadId"));
  await avanzarEstado(leadId, "contactado", {}, { usuarioId: usuario.id });
}

export async function agendarPrueba(
  _estado: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  try {
    const usuario = await exigirSeccion("crm");
    const leadId = z.coerce.number().int().positive().parse(formData.get("leadId"));
    const horarioId = z.coerce
      .number({ message: "Elegí el horario de la clase de prueba" })
      .int()
      .positive()
      .parse(formData.get("horarioId"));
    const fecha = z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Poné la fecha de la prueba")
      .parse(formData.get("fecha"));
    if (fecha < hoyISO()) return { error: "La clase de prueba no puede ser en el pasado" };

    const horario = await db.query.horarios.findFirst({
      where: and(eq(horarios.id, horarioId), eq(horarios.activo, true)),
    });
    if (!horario) return { error: "El horario no existe" };

    return await avanzarEstado(
      leadId,
      "prueba_agendada",
      // Agendar (o re-agendar) resetea el recordatorio: la prueba nueva
      // todavía no se le recordó.
      { pruebaFecha: fecha, pruebaHorarioId: horarioId, pruebaRecordadaEn: null },
      {
        usuarioId: usuario.id,
        detalle: `Clase de prueba agendada para el ${formatoFecha(fecha)}`,
      },
    );
  } catch (error) {
    return mensajeDeError(error);
  }
}

export async function marcarPerdido(
  _estado: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  try {
    const usuario = await exigirSeccion("crm");
    const leadId = z.coerce.number().int().positive().parse(formData.get("leadId"));
    // El motivo es obligatorio al perder (PLAN.md).
    const motivo = z
      .string()
      .trim()
      .min(2, "Contá el motivo de la pérdida")
      .parse(formData.get("motivo"));
    return await avanzarEstado(
      leadId,
      "perdido",
      { motivoPerdida: motivo },
      { usuarioId: usuario.id, detalle: `Perdido: ${motivo}` },
    );
  } catch (error) {
    return mensajeDeError(error);
  }
}

// --- Conversión a alumno --------------------------------------------------------

const esquemaConversion = z.object({
  leadId: z.coerce.number().int().positive(),
  sedeId: z.coerce.number({ message: "Elegí la sede" }).int().positive(),
  dni: z
    .string()
    .trim()
    .regex(/^\d{7,9}$/, "El DNI debe tener 7 u 8 números, sin puntos"),
  nombre: z.string().trim().min(2, "Poné el nombre"),
  apellido: z.string().trim().min(2, "Poné el apellido"),
  telefono: z.string().trim().min(6, "Poné el teléfono"),
  email: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.string().email("El email no parece válido").nullable()),
  fechaNacimiento: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .pipe(
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha no es válida").nullable(),
    ),
});

export async function convertirLead(
  _estado: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  let alumnoId: number;
  try {
    const usuario = await exigirSeccion("crm");
    const datos = esquemaConversion.parse({
      leadId: formData.get("leadId"),
      sedeId: formData.get("sedeId"),
      dni: formData.get("dni"),
      nombre: formData.get("nombre"),
      apellido: formData.get("apellido"),
      telefono: formData.get("telefono"),
      email: formData.get("email") ?? "",
      fechaNacimiento: formData.get("fechaNacimiento") ?? "",
    });

    const lead = await cargarLead(datos.leadId);
    if (!lead) return { error: "El lead no existe" };
    if (!puedeTransicionar(lead.estado, "convertido")) {
      return { error: "Este lead no se puede convertir desde su estado actual" };
    }

    const repetido = await db.query.alumnos.findFirst({
      where: and(eq(alumnos.sedeId, datos.sedeId), eq(alumnos.dni, datos.dni)),
    });
    if (repetido) {
      return {
        error: `Ya existe un alumno con ese DNI en esa sede (${repetido.nombre} ${repetido.apellido})`,
      };
    }

    const { leadId, ...ficha } = datos;
    alumnoId = await db.transaction(async (tx) => {
      const [alumno] = await tx.insert(alumnos).values(ficha).returning();
      await tx
        .update(leads)
        .set({
          estado: "convertido",
          alumnoId: alumno.id,
          etapaDesde: new Date(),
          actualizadoEn: new Date(),
        })
        .where(eq(leads.id, leadId));
      await tx.insert(leadActividades).values({
        leadId,
        tipo: "sistema",
        detalle: `Convertido en alumno: ${ficha.nombre} ${ficha.apellido}`,
        registradoPorId: usuario.id,
      });
      return alumno.id;
    });
    revalidatePath("/crm");
    revalidatePath("/alumnos");
    revalidatePath("/dashboard");
  } catch (error) {
    return mensajeDeError(error);
  }
  // El flujo sigue naturalmente en crear la suscripción del alumno nuevo.
  redirect(`/alumnos/${alumnoId}/suscribir`);
}
