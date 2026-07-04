"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { leads, origenesNegocio } from "@/db/schema";
import { exigirSeccion } from "@/lib/auth/guards";
import { autorizarSede, ErrorAutorizacion } from "@/lib/auth/permissions";
import { esEstadoFinal, ETIQUETA_ESTADO_LEAD } from "@/lib/reglas-leads";

// Interesados del mostrador: la secretaria carga a quien viene a averiguar y
// el lead entra al CRM (que sigue siendo solo del admin) con fuente
// "mostrador" y la sede de la secretaria como sede de interés.

export type EstadoAccion = { error?: string; ok?: boolean };

function mensajeDeError(error: unknown): EstadoAccion {
  if (error instanceof ErrorAutorizacion) return { error: error.message };
  if (error instanceof z.ZodError)
    return { error: error.issues[0]?.message ?? "Datos inválidos" };
  console.error(error);
  return { error: "Algo salió mal. Probá de nuevo." };
}

const esquemaInteresado = z.object({
  sedeId: z.coerce.number().int().positive(),
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
  nota: z
    .string()
    .trim()
    .max(300, "La nota es muy larga")
    .transform((v) => (v === "" ? null : v)),
});

export async function crearInteresado(
  _estado: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  try {
    const usuario = await exigirSeccion("interesados");
    const datos = esquemaInteresado.parse({
      sedeId: formData.get("sedeId"),
      nombre: formData.get("nombre"),
      telefono: formData.get("telefono"),
      email: formData.get("email") ?? "",
      nota: formData.get("nota") ?? "",
    });
    autorizarSede(usuario, datos.sedeId);

    // Mismo teléfono con un lead abierto = ya está cargado (evita duplicados
    // cuando la persona vuelve a preguntar a los pocos días).
    const telefonoNormalizado = datos.telefono.replace(/\D/g, "");
    const coincidentes = await db
      .select()
      .from(leads)
      .where(
        sql`regexp_replace(${leads.telefono}, '\\D', '', 'g') = ${telefonoNormalizado}`,
      );
    const abierto = coincidentes.find((l) => !esEstadoFinal(l.estado));
    if (abierto) {
      return {
        error: `Ya está cargado como interesado (${ETIQUETA_ESTADO_LEAD[abierto.estado]})`,
      };
    }

    // La captura del mostrador se clasifica sola en el catálogo de orígenes
    // de negocio (rediseño CRM R1); si el origen no existiera, queda null.
    const origenMostrador = await db.query.origenesNegocio.findFirst({
      where: eq(origenesNegocio.nombre, "Mostrador"),
    });

    await db.insert(leads).values({
      nombre: datos.nombre,
      telefono: datos.telefono,
      email: datos.email,
      nota: datos.nota,
      sedeInteresId: datos.sedeId,
      origen: "manual",
      fuente: "mostrador",
      origenNegocioId: origenMostrador?.id ?? null,
    });
    revalidatePath("/interesados");
    revalidatePath("/inicio");
    revalidatePath("/crm");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    return mensajeDeError(error);
  }
}
