"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { asistenciasClase, horarios } from "@/db/schema";
import { exigirSeccion } from "@/lib/auth/guards";
import { autorizarSede, ErrorAutorizacion } from "@/lib/auth/permissions";
import { diaSemanaISO, hoyISO } from "@/lib/fechas";

export type EstadoAccion = { error?: string; ok?: boolean };

const esquemaAsistencia = z.object({
  horarioId: z.coerce.number().int().positive(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha no es válida"),
  cantidad: z.coerce
    .number({ message: "Poné cuántos alumnos hubo" })
    .int("La cantidad debe ser un número entero")
    .min(0, "La cantidad no puede ser negativa")
    .max(999, "La cantidad no parece real"),
});

/**
 * Registra (o corrige) cuántos alumnos hubo en una clase puntual. Una fila
 * por horario+fecha: volver a guardar pisa el número anterior.
 */
export async function registrarAsistencia(
  _estado: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  try {
    const usuario = await exigirSeccion("operativa");
    const datos = esquemaAsistencia.parse({
      horarioId: formData.get("horarioId"),
      fecha: formData.get("fecha"),
      cantidad: formData.get("cantidad"),
    });
    if (datos.fecha > hoyISO()) {
      return { error: "No se puede registrar asistencia de una clase futura" };
    }

    const horario = await db.query.horarios.findFirst({
      where: eq(horarios.id, datos.horarioId),
    });
    if (!horario) return { error: "La clase no existe" };
    autorizarSede(usuario, horario.sedeId);
    if (horario.diaSemana !== diaSemanaISO(datos.fecha)) {
      return { error: "Esa fecha no cae en el día de esta clase" };
    }

    await db
      .insert(asistenciasClase)
      .values({
        sedeId: horario.sedeId,
        horarioId: horario.id,
        fecha: datos.fecha,
        cantidad: datos.cantidad,
        registradoPorId: usuario.id,
      })
      .onConflictDoUpdate({
        target: [asistenciasClase.horarioId, asistenciasClase.fecha],
        set: { cantidad: datos.cantidad, registradoPorId: usuario.id },
      });

    revalidatePath("/asistencia");
    return { ok: true };
  } catch (error) {
    if (error instanceof ErrorAutorizacion) return { error: error.message };
    if (error instanceof z.ZodError) {
      return { error: error.issues[0]?.message ?? "Datos inválidos" };
    }
    console.error(error);
    return { error: "Algo salió mal. Probá de nuevo." };
  }
}
