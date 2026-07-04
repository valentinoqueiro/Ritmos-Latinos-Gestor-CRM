"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { alumnos, horarios, leads } from "@/db/schema";
import { exigirSeccion } from "@/lib/auth/guards";
import { ErrorAutorizacion } from "@/lib/auth/permissions";
import { hoyISO } from "@/lib/fechas";
import { puedeTransicionar, type EstadoLead } from "@/lib/reglas-leads";

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
): Promise<EstadoAccion> {
  const lead = await cargarLead(leadId);
  if (!lead) return { error: "El lead no existe" };
  if (!puedeTransicionar(lead.estado, destino)) {
    return {
      error: `No se puede pasar de "${lead.estado}" a "${destino}"`,
    };
  }
  await db
    .update(leads)
    .set({ estado: destino, actualizadoEn: new Date(), ...extras })
    .where(eq(leads.id, leadId));
  revalidatePath("/crm");
  revalidatePath("/dashboard");
  return { ok: true };
}

// --- Alta manual ---------------------------------------------------------------

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
  sedeInteresId: z
    .string()
    .transform((v) => (v === "" ? null : Number(v)))
    .pipe(z.number().int().positive().nullable()),
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
      sedeInteresId: formData.get("sedeInteresId") ?? "",
      nota: formData.get("nota") ?? "",
    });
    await db.insert(leads).values({ ...datos, origen: "manual" });
    revalidatePath("/crm");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    return mensajeDeError(error);
  }
}

// --- Avances del pipeline ---------------------------------------------------------

export async function marcarContactado(formData: FormData): Promise<void> {
  await exigirSeccion("crm");
  const leadId = z.coerce.number().int().positive().parse(formData.get("leadId"));
  await avanzarEstado(leadId, "contactado");
}

export async function agendarPrueba(
  _estado: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  try {
    await exigirSeccion("crm");
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

    return await avanzarEstado(leadId, "prueba_agendada", {
      pruebaFecha: fecha,
      pruebaHorarioId: horarioId,
    });
  } catch (error) {
    return mensajeDeError(error);
  }
}

export async function marcarPerdido(
  _estado: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  try {
    await exigirSeccion("crm");
    const leadId = z.coerce.number().int().positive().parse(formData.get("leadId"));
    // El motivo es obligatorio al perder (PLAN.md).
    const motivo = z
      .string()
      .trim()
      .min(2, "Contá el motivo de la pérdida")
      .parse(formData.get("motivo"));
    return await avanzarEstado(leadId, "perdido", { motivoPerdida: motivo });
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
    await exigirSeccion("crm");
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
          actualizadoEn: new Date(),
        })
        .where(eq(leads.id, leadId));
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
