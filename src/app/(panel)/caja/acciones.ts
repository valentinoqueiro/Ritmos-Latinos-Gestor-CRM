"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { movimientosCaja, turnosCaja } from "@/db/schema";
import { exigirSeccion } from "@/lib/auth/guards";
import { autorizarSede, ErrorAutorizacion } from "@/lib/auth/permissions";
import { turnoAbierto } from "@/lib/caja";
import type { EstadoAccion } from "../alumnos/acciones";

function mensajeDeError(error: unknown): EstadoAccion {
  if (error instanceof ErrorAutorizacion) return { error: error.message };
  if (error instanceof z.ZodError)
    return { error: error.issues[0]?.message ?? "Datos inválidos" };
  console.error(error);
  return { error: "Algo salió mal. Probá de nuevo." };
}

export async function abrirTurno(
  _estado: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  try {
    const usuario = await exigirSeccion("operativa");
    const datos = z
      .object({
        sedeId: z.coerce.number().int().positive(),
        efectivoInicial: z.preprocess(
          (v) => (v === "" || v === null ? 0 : v),
          z.coerce.number().min(0, "El efectivo inicial no puede ser negativo"),
        ),
      })
      .parse({
        sedeId: formData.get("sedeId"),
        efectivoInicial: formData.get("efectivoInicial"),
      });
    autorizarSede(usuario, datos.sedeId);

    if (await turnoAbierto(datos.sedeId)) {
      return { error: "Ya hay un turno abierto en esta sede" };
    }
    try {
      await db.insert(turnosCaja).values({
        sedeId: datos.sedeId,
        abiertoPorId: usuario.id,
        efectivoInicial: datos.efectivoInicial.toFixed(2),
      });
    } catch (error) {
      // Carrera de doble apertura: la corta el índice único parcial.
      if (String(error).includes("turnos_caja_abierto_unico")) {
        return { error: "Ya hay un turno abierto en esta sede" };
      }
      throw error;
    }
    revalidatePath("/caja");
    revalidatePath("/inicio");
    return { ok: true };
  } catch (error) {
    return mensajeDeError(error);
  }
}

export async function cerrarTurno(
  _estado: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  let turnoId: number;
  try {
    const usuario = await exigirSeccion("operativa");
    turnoId = z.coerce.number().int().positive().parse(formData.get("turnoId"));
    const notaCierre =
      String(formData.get("notaCierre") ?? "").trim() || null;

    const turno = await db.query.turnosCaja.findFirst({
      where: eq(turnosCaja.id, turnoId),
    });
    if (!turno) return { error: "El turno no existe" };
    autorizarSede(usuario, turno.sedeId);
    if (turno.cerradoEn) return { error: "El turno ya estaba cerrado" };

    // El where con cerrado_en IS NULL evita cerrar dos veces por doble submit.
    await db
      .update(turnosCaja)
      .set({ cerradoEn: new Date(), cerradoPorId: usuario.id, notaCierre })
      .where(and(eq(turnosCaja.id, turnoId), isNull(turnosCaja.cerradoEn)));
    revalidatePath("/caja");
    revalidatePath("/inicio");
  } catch (error) {
    return mensajeDeError(error);
  }
  redirect(`/caja?cierre=${turnoId}`);
}

export async function registrarMovimientoCaja(
  _estado: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  try {
    const usuario = await exigirSeccion("operativa");
    const datos = z
      .object({
        turnoId: z.coerce.number().int().positive(),
        monto: z.coerce
          .number({ message: "Poné el monto del egreso" })
          .positive("El monto debe ser mayor a cero"),
        concepto: z.string().trim().min(2, "Contá en qué se usó la plata"),
      })
      .parse({
        turnoId: formData.get("turnoId"),
        monto: formData.get("monto"),
        concepto: formData.get("concepto"),
      });

    const turno = await db.query.turnosCaja.findFirst({
      where: eq(turnosCaja.id, datos.turnoId),
    });
    if (!turno) return { error: "El turno no existe" };
    autorizarSede(usuario, turno.sedeId);
    if (turno.cerradoEn) {
      return { error: "El turno ya cerró: no se pueden cargar egresos" };
    }

    await db.insert(movimientosCaja).values({
      turnoId: turno.id,
      monto: datos.monto.toFixed(2),
      concepto: datos.concepto,
      registradoPorId: usuario.id,
    });
    revalidatePath("/caja");
    revalidatePath("/inicio");
    return { ok: true };
  } catch (error) {
    return mensajeDeError(error);
  }
}
