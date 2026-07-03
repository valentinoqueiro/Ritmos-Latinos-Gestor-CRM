"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { categoriasGasto, gastos } from "@/db/schema";
import { exigirSeccion } from "@/lib/auth/guards";
import { autorizarSede, ErrorAutorizacion } from "@/lib/auth/permissions";
import { hoyISO } from "@/lib/fechas";

// Gastos: SOLO el rol admin (sección "gastos" en la matriz de permisos).
// exigirSeccion lo aplica en el servidor en cada acción.

export type EstadoAccion = { error?: string; ok?: boolean };

function mensajeDeError(error: unknown): EstadoAccion {
  if (error instanceof ErrorAutorizacion) return { error: error.message };
  if (error instanceof z.ZodError)
    return { error: error.issues[0]?.message ?? "Datos inválidos" };
  console.error(error);
  return { error: "Algo salió mal. Probá de nuevo." };
}

const esquemaGasto = z.object({
  sedeId: z.coerce.number().int().positive(),
  tipo: z.enum(["fijo", "variable"], { message: "Elegí el tipo de gasto" }),
  categoriaId: z.coerce
    .number({ message: "Elegí la categoría" })
    .int()
    .positive(),
  monto: z.coerce
    .number({ message: "Poné el monto" })
    .positive("El monto debe ser mayor a cero"),
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha no es válida"),
  descripcion: z
    .string()
    .trim()
    .max(200, "La descripción es muy larga")
    .transform((v) => (v === "" ? null : v)),
});

function datosDeFormulario(formData: FormData) {
  return esquemaGasto.parse({
    sedeId: formData.get("sedeId"),
    tipo: formData.get("tipo"),
    categoriaId: formData.get("categoriaId"),
    monto: formData.get("monto"),
    fecha: formData.get("fecha"),
    descripcion: formData.get("descripcion") ?? "",
  });
}

async function validarDatos(
  usuario: Awaited<ReturnType<typeof exigirSeccion>>,
  datos: ReturnType<typeof datosDeFormulario>,
): Promise<string | null> {
  autorizarSede(usuario, datos.sedeId);
  if (datos.fecha > hoyISO()) return "La fecha no puede ser futura";
  const categoria = await db.query.categoriasGasto.findFirst({
    where: eq(categoriasGasto.id, datos.categoriaId),
  });
  if (!categoria || !categoria.activa) return "La categoría no existe";
  return null;
}

export async function crearGasto(
  _estado: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  try {
    const usuario = await exigirSeccion("gastos");
    const datos = datosDeFormulario(formData);
    const problema = await validarDatos(usuario, datos);
    if (problema) return { error: problema };
    await db.insert(gastos).values({
      ...datos,
      monto: datos.monto.toFixed(2),
      registradoPorId: usuario.id,
    });
    revalidatePath("/gastos");
    return { ok: true };
  } catch (error) {
    return mensajeDeError(error);
  }
}

export async function editarGasto(
  _estado: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  try {
    const usuario = await exigirSeccion("gastos");
    const gastoId = z.coerce.number().int().positive().parse(formData.get("gastoId"));
    const existente = await db.query.gastos.findFirst({
      where: eq(gastos.id, gastoId),
    });
    if (!existente) return { error: "El gasto no existe" };
    autorizarSede(usuario, existente.sedeId);
    const datos = datosDeFormulario(formData);
    const problema = await validarDatos(usuario, datos);
    if (problema) return { error: problema };
    await db
      .update(gastos)
      .set({ ...datos, monto: datos.monto.toFixed(2) })
      .where(eq(gastos.id, gastoId));
    revalidatePath("/gastos");
  } catch (error) {
    return mensajeDeError(error);
  }
  redirect("/gastos");
}

export async function eliminarGasto(formData: FormData): Promise<void> {
  const usuario = await exigirSeccion("gastos");
  const gastoId = z.coerce.number().int().positive().parse(formData.get("gastoId"));
  const existente = await db.query.gastos.findFirst({
    where: eq(gastos.id, gastoId),
  });
  if (!existente) return;
  autorizarSede(usuario, existente.sedeId);
  await db.delete(gastos).where(eq(gastos.id, gastoId));
  revalidatePath("/gastos");
}

// --- Categorías (viven en la configuración del admin) -------------------------

export async function crearCategoria(
  _estado: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  try {
    await exigirSeccion("configuracion");
    const nombre = z
      .string()
      .trim()
      .min(2, "Poné un nombre de al menos 2 letras")
      .parse(formData.get("nombre"));
    const repetida = await db.query.categoriasGasto.findFirst({
      where: eq(categoriasGasto.nombre, nombre),
    });
    if (repetida) return { error: "Ya existe una categoría con ese nombre" };
    await db.insert(categoriasGasto).values({ nombre });
    revalidatePath("/configuracion");
    revalidatePath("/gastos");
    return { ok: true };
  } catch (error) {
    return mensajeDeError(error);
  }
}

export async function alternarCategoria(formData: FormData): Promise<void> {
  await exigirSeccion("configuracion");
  const id = z.coerce.number().int().positive().parse(formData.get("id"));
  const categoria = await db.query.categoriasGasto.findFirst({
    where: eq(categoriasGasto.id, id),
  });
  if (!categoria) return;
  await db
    .update(categoriasGasto)
    .set({ activa: !categoria.activa })
    .where(eq(categoriasGasto.id, id));
  revalidatePath("/configuracion");
  revalidatePath("/gastos");
}
