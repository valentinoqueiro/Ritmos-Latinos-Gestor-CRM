"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  apiKeys,
  configuracion,
  disciplinas,
  horarios,
  planes,
  planesDisciplinas,
  preciosPlan,
  sedes,
} from "@/db/schema";
import { esAlcanceValido, generarClave } from "@/lib/auth/api-keys";
import { exigirSeccion } from "@/lib/auth/guards";
import { autorizarSede, ErrorAutorizacion } from "@/lib/auth/permissions";
import { CLAVE_UMBRAL } from "@/lib/cobros";
import {
  CLAVE_WEBHOOK_INVITACIONES_TOKEN,
  CLAVE_WEBHOOK_INVITACIONES_URL,
  esquemaUrlWebhook,
} from "@/lib/invitaciones";
import {
  CLAVE_MENSAJE_INTERESADOS,
  CLAVE_MENSAJE_RECONTACTO,
  CLAVE_MENSAJE_RECORDATORIO_PRUEBA,
} from "@/lib/mensajes";
import { CLAVE_UMBRAL_LEAD_FRIO } from "@/lib/reglas-crm";

// Acciones de configuración (solo admin). Toda acción valida sección y sede
// en el servidor y revalida las pantallas afectadas.

export type EstadoAccion = { error?: string; ok?: boolean };

function mensajeDeError(error: unknown): EstadoAccion {
  if (error instanceof ErrorAutorizacion) return { error: error.message };
  if (error instanceof z.ZodError)
    return { error: error.issues[0]?.message ?? "Datos inválidos" };
  console.error(error);
  return { error: "Algo salió mal. Probá de nuevo." };
}

// --- Disciplinas -----------------------------------------------------------

const esquemaDisciplina = z.object({
  sedeId: z.coerce.number().int().positive(),
  nombre: z.string().trim().min(2, "Poné un nombre de al menos 2 letras"),
});

export async function crearDisciplina(
  _estado: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  try {
    const usuario = await exigirSeccion("configuracion");
    const datos = esquemaDisciplina.parse({
      sedeId: formData.get("sedeId"),
      nombre: formData.get("nombre"),
    });
    autorizarSede(usuario, datos.sedeId);
    await db.insert(disciplinas).values(datos);
    revalidatePath("/configuracion");
    return { ok: true };
  } catch (error) {
    return mensajeDeError(error);
  }
}

export async function alternarDisciplina(formData: FormData): Promise<void> {
  const usuario = await exigirSeccion("configuracion");
  const id = z.coerce.number().int().positive().parse(formData.get("id"));
  const disciplina = await db.query.disciplinas.findFirst({
    where: eq(disciplinas.id, id),
  });
  if (!disciplina) return;
  autorizarSede(usuario, disciplina.sedeId);
  await db
    .update(disciplinas)
    .set({ activa: !disciplina.activa })
    .where(eq(disciplinas.id, id));
  revalidatePath("/configuracion");
}

// --- Horarios ---------------------------------------------------------------

const esquemaHorario = z.object({
  disciplinaId: z.coerce.number().int().positive(),
  diaSemana: z.coerce
    .number()
    .int()
    .min(1, "Elegí un día")
    .max(7, "Elegí un día"),
  hora: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Poné una hora válida (ej. 19:00)"),
  nota: z
    .string()
    .trim()
    .max(60, "La nota es muy larga")
    .transform((v) => (v === "" ? null : v)),
  cupo: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .pipe(
      z
        .number()
        .int("El cupo debe ser un número entero")
        .min(1, "El cupo mínimo es 1")
        .nullable(),
    ),
});

export async function crearHorario(
  _estado: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  try {
    const usuario = await exigirSeccion("configuracion");
    const datos = esquemaHorario.parse({
      disciplinaId: formData.get("disciplinaId"),
      diaSemana: formData.get("diaSemana"),
      hora: formData.get("hora"),
      nota: formData.get("nota") ?? "",
      cupo: formData.get("cupo") ?? "",
    });
    const disciplina = await db.query.disciplinas.findFirst({
      where: eq(disciplinas.id, datos.disciplinaId),
    });
    if (!disciplina) return { error: "La disciplina no existe" };
    autorizarSede(usuario, disciplina.sedeId);
    await db.insert(horarios).values({
      sedeId: disciplina.sedeId,
      disciplinaId: datos.disciplinaId,
      diaSemana: datos.diaSemana,
      hora: datos.hora,
      nota: datos.nota,
      cupo: datos.cupo,
    });
    revalidatePath("/configuracion");
    revalidatePath("/horarios");
    return { ok: true };
  } catch (error) {
    return mensajeDeError(error);
  }
}

export async function alternarHorario(formData: FormData): Promise<void> {
  const usuario = await exigirSeccion("configuracion");
  const id = z.coerce.number().int().positive().parse(formData.get("id"));
  const horario = await db.query.horarios.findFirst({
    where: eq(horarios.id, id),
  });
  if (!horario) return;
  autorizarSede(usuario, horario.sedeId);
  await db
    .update(horarios)
    .set({ activo: !horario.activo })
    .where(eq(horarios.id, id));
  revalidatePath("/configuracion");
  revalidatePath("/horarios");
}

export async function editarCupo(formData: FormData): Promise<void> {
  const usuario = await exigirSeccion("configuracion");
  const id = z.coerce.number().int().positive().parse(formData.get("id"));
  const cupoCrudo = String(formData.get("cupo") ?? "").trim();
  const cupo = cupoCrudo === "" ? null : Number(cupoCrudo);
  if (cupo !== null && (!Number.isInteger(cupo) || cupo < 1)) return;
  const horario = await db.query.horarios.findFirst({
    where: eq(horarios.id, id),
  });
  if (!horario) return;
  autorizarSede(usuario, horario.sedeId);
  await db.update(horarios).set({ cupo }).where(eq(horarios.id, id));
  revalidatePath("/configuracion");
  revalidatePath("/horarios");
}

// --- Sedes (dirección) --------------------------------------------------------

/**
 * Dirección de la sede, editable por el admin. Se usa en la invitación a la
 * clase de prueba (y donde haga falta mostrar dónde queda la sede).
 */
export async function guardarDireccionSede(
  _estado: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  try {
    const usuario = await exigirSeccion("configuracion");
    const datos = z
      .object({
        sedeId: z.coerce.number().int().positive(),
        direccion: z
          .string()
          .trim()
          .min(5, "La dirección es muy corta")
          .max(160, "La dirección es muy larga"),
      })
      .parse({
        sedeId: formData.get("sedeId"),
        direccion: formData.get("direccion"),
      });
    const sede = await db.query.sedes.findFirst({
      where: eq(sedes.id, datos.sedeId),
    });
    if (!sede) return { error: "La sede no existe" };
    autorizarSede(usuario, sede.id);
    await db
      .update(sedes)
      .set({ direccion: datos.direccion })
      .where(eq(sedes.id, sede.id));
    revalidatePath("/configuracion");
    return { ok: true };
  } catch (error) {
    return mensajeDeError(error);
  }
}

// --- Webhook de invitaciones (n8n) ---------------------------------------------

/**
 * URL y token del webhook externo que manda las invitaciones a la clase de
 * prueba. El token es un SECRETO: se guarda y nunca vuelve al navegador ni a
 * los logs — la UI solo muestra si está configurado. Dejar el token en blanco
 * conserva el guardado; la URL vacía desconfigura todo (URL y token).
 */
export async function guardarWebhookInvitaciones(
  _estado: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  try {
    await exigirSeccion("configuracion");
    const urlCruda = String(formData.get("url") ?? "").trim();
    const token = String(formData.get("token") ?? "").trim();

    if (urlCruda === "") {
      // Desconfigurar: sin URL no hay envío posible; el token guardado ya no
      // sirve para nada y no se deja dando vueltas.
      await db
        .delete(configuracion)
        .where(
          inArray(configuracion.clave, [
            CLAVE_WEBHOOK_INVITACIONES_URL,
            CLAVE_WEBHOOK_INVITACIONES_TOKEN,
          ]),
        );
      revalidatePath("/configuracion");
      return { ok: true };
    }

    const url = esquemaUrlWebhook.parse(urlCruda);
    await db.transaction(async (tx) => {
      await tx
        .insert(configuracion)
        .values({ clave: CLAVE_WEBHOOK_INVITACIONES_URL, valor: url })
        .onConflictDoUpdate({
          target: configuracion.clave,
          set: { valor: url },
        });
      if (token !== "") {
        await tx
          .insert(configuracion)
          .values({ clave: CLAVE_WEBHOOK_INVITACIONES_TOKEN, valor: token })
          .onConflictDoUpdate({
            target: configuracion.clave,
            set: { valor: token },
          });
      }
    });
    revalidatePath("/configuracion");
    return { ok: true };
  } catch (error) {
    return mensajeDeError(error);
  }
}

// --- Mensaje de recontacto (retencion, CRM) --------------------------------------

export async function guardarMensajeRecontacto(
  _estado: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  try {
    await exigirSeccion("configuracion");
    const mensaje = z
      .string()
      .trim()
      .min(10, "El mensaje es muy corto")
      .max(600, "El mensaje es muy largo")
      .parse(formData.get("mensaje"));
    await db
      .insert(configuracion)
      .values({ clave: CLAVE_MENSAJE_RECONTACTO, valor: mensaje })
      .onConflictDoUpdate({
        target: configuracion.clave,
        set: { valor: mensaje },
      });
    revalidatePath("/configuracion");
    revalidatePath("/crm/recontactar");
    return { ok: true };
  } catch (error) {
    return mensajeDeError(error);
  }
}

// --- Recordatorio de clase de prueba (CRM) ---------------------------------------

export async function guardarMensajeRecordatorioPrueba(
  _estado: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  try {
    await exigirSeccion("configuracion");
    const mensaje = z
      .string()
      .trim()
      .min(10, "El mensaje es muy corto")
      .max(600, "El mensaje es muy largo")
      .parse(formData.get("mensaje"));
    await db
      .insert(configuracion)
      .values({ clave: CLAVE_MENSAJE_RECORDATORIO_PRUEBA, valor: mensaje })
      .onConflictDoUpdate({
        target: configuracion.clave,
        set: { valor: mensaje },
      });
    revalidatePath("/configuracion");
    revalidatePath("/crm");
    return { ok: true };
  } catch (error) {
    return mensajeDeError(error);
  }
}

// --- Umbral de lead frio (CRM) --------------------------------------------------

export async function guardarUmbralLeadFrio(
  _estado: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  try {
    await exigirSeccion("configuracion");
    const dias = z.coerce
      .number({ message: "Pone una cantidad de dias" })
      .int("Debe ser un numero entero")
      .min(1, "Al menos 1 dia")
      .max(30, "Como mucho 30 dias")
      .parse(formData.get("dias"));
    await db
      .insert(configuracion)
      .values({ clave: CLAVE_UMBRAL_LEAD_FRIO, valor: String(dias) })
      .onConflictDoUpdate({
        target: configuracion.clave,
        set: { valor: String(dias) },
      });
    revalidatePath("/configuracion");
    revalidatePath("/crm");
    return { ok: true };
  } catch (error) {
    return mensajeDeError(error);
  }
}

// --- Mensaje a interesados (plantilla de WhatsApp del mostrador) ---------------

export async function guardarMensajeInteresados(
  _estado: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  try {
    await exigirSeccion("configuracion");
    const mensaje = z
      .string()
      .trim()
      .min(10, "El mensaje es muy corto")
      .max(600, "El mensaje es muy largo")
      .parse(formData.get("mensaje"));
    await db
      .insert(configuracion)
      .values({ clave: CLAVE_MENSAJE_INTERESADOS, valor: mensaje })
      .onConflictDoUpdate({
        target: configuracion.clave,
        set: { valor: mensaje },
      });
    revalidatePath("/configuracion");
    revalidatePath("/interesados");
    return { ok: true };
  } catch (error) {
    return mensajeDeError(error);
  }
}

// --- Parámetros (umbral de "por vencer") --------------------------------------

export async function guardarUmbral(
  _estado: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  try {
    await exigirSeccion("configuracion");
    const dias = z.coerce
      .number({ message: "Poné una cantidad de días" })
      .int("Debe ser un número entero")
      .min(0, "No puede ser negativo")
      .max(30, "Como mucho 30 días")
      .parse(formData.get("dias"));
    await db
      .insert(configuracion)
      .values({ clave: CLAVE_UMBRAL, valor: String(dias) })
      .onConflictDoUpdate({
        target: configuracion.clave,
        set: { valor: String(dias) },
      });
    revalidatePath("/configuracion");
    revalidatePath("/inicio");
    revalidatePath("/cobros");
    return { ok: true };
  } catch (error) {
    return mensajeDeError(error);
  }
}

// --- Planes y precios --------------------------------------------------------

const esquemaPlan = z
  .object({
    sedeId: z.coerce.number().int().positive(),
    nombre: z.string().trim().min(2, "Poné un nombre de al menos 2 letras"),
    tipo: z.enum(["disciplina", "pack", "frecuencia"]),
    frecuenciaSemanal: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : Number(v)))
      .pipe(z.number().int().min(1).max(7).nullable()),
    disciplinaIds: z.array(z.coerce.number().int().positive()),
    precio: z.coerce
      .number({ message: "Poné el precio del plan" })
      .positive("El precio debe ser mayor a cero"),
  })
  .refine(
    (d) => d.tipo !== "frecuencia" || d.frecuenciaSemanal !== null,
    { message: "Los planes por frecuencia necesitan cuántas veces por semana" },
  )
  .refine((d) => d.disciplinaIds.length > 0, {
    message: "Elegí al menos una disciplina",
  })
  .refine((d) => d.tipo === "pack" || d.disciplinaIds.length === 1, {
    message: "Solo los packs pueden tener más de una disciplina",
  });

export async function crearPlan(
  _estado: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  try {
    const usuario = await exigirSeccion("configuracion");
    const datos = esquemaPlan.parse({
      sedeId: formData.get("sedeId"),
      nombre: formData.get("nombre"),
      tipo: formData.get("tipo"),
      frecuenciaSemanal: formData.get("frecuenciaSemanal") ?? "",
      disciplinaIds: formData.getAll("disciplinaIds"),
      precio: formData.get("precio"),
    });
    autorizarSede(usuario, datos.sedeId);

    // Las disciplinas del plan deben ser de la misma sede.
    for (const disciplinaId of datos.disciplinaIds) {
      const d = await db.query.disciplinas.findFirst({
        where: and(
          eq(disciplinas.id, disciplinaId),
          eq(disciplinas.sedeId, datos.sedeId),
        ),
      });
      if (!d) return { error: "Elegiste una disciplina de otra sede" };
    }

    await db.transaction(async (tx) => {
      const [plan] = await tx
        .insert(planes)
        .values({
          sedeId: datos.sedeId,
          nombre: datos.nombre,
          tipo: datos.tipo,
          frecuenciaSemanal:
            datos.tipo === "frecuencia" ? datos.frecuenciaSemanal : null,
        })
        .returning();
      await tx.insert(planesDisciplinas).values(
        datos.disciplinaIds.map((disciplinaId) => ({
          planId: plan.id,
          disciplinaId,
        })),
      );
      await tx.insert(preciosPlan).values({
        planId: plan.id,
        monto: datos.precio.toFixed(2),
      });
    });
    revalidatePath("/configuracion");
    return { ok: true };
  } catch (error) {
    return mensajeDeError(error);
  }
}

// Editar los datos de un plan ya creado (nombre, tipo, frecuencia, disciplinas).
// El precio NO se toca acá: tiene su propio historial vía `actualizarPrecio`.
const esquemaEditarPlan = z
  .object({
    planId: z.coerce.number().int().positive(),
    nombre: z.string().trim().min(2, "Poné un nombre de al menos 2 letras"),
    tipo: z.enum(["disciplina", "pack", "frecuencia"]),
    frecuenciaSemanal: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : Number(v)))
      .pipe(z.number().int().min(1).max(7).nullable()),
    disciplinaIds: z.array(z.coerce.number().int().positive()),
  })
  .refine(
    (d) => d.tipo !== "frecuencia" || d.frecuenciaSemanal !== null,
    { message: "Los planes por frecuencia necesitan cuántas veces por semana" },
  )
  .refine((d) => d.disciplinaIds.length > 0, {
    message: "Elegí al menos una disciplina",
  })
  .refine((d) => d.tipo === "pack" || d.disciplinaIds.length === 1, {
    message: "Solo los packs pueden tener más de una disciplina",
  });

export async function editarPlan(
  _estado: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  try {
    const usuario = await exigirSeccion("configuracion");
    const datos = esquemaEditarPlan.parse({
      planId: formData.get("planId"),
      nombre: formData.get("nombre"),
      tipo: formData.get("tipo"),
      frecuenciaSemanal: formData.get("frecuenciaSemanal") ?? "",
      disciplinaIds: formData.getAll("disciplinaIds"),
    });
    const plan = await db.query.planes.findFirst({
      where: eq(planes.id, datos.planId),
    });
    if (!plan) return { error: "El plan no existe" };
    autorizarSede(usuario, plan.sedeId);

    // Las disciplinas del plan deben ser de la misma sede.
    for (const disciplinaId of datos.disciplinaIds) {
      const d = await db.query.disciplinas.findFirst({
        where: and(
          eq(disciplinas.id, disciplinaId),
          eq(disciplinas.sedeId, plan.sedeId),
        ),
      });
      if (!d) return { error: "Elegiste una disciplina de otra sede" };
    }

    await db.transaction(async (tx) => {
      await tx
        .update(planes)
        .set({
          nombre: datos.nombre,
          tipo: datos.tipo,
          frecuenciaSemanal:
            datos.tipo === "frecuencia" ? datos.frecuenciaSemanal : null,
        })
        .where(eq(planes.id, plan.id));
      // Reescribe el set de disciplinas del plan.
      await tx
        .delete(planesDisciplinas)
        .where(eq(planesDisciplinas.planId, plan.id));
      await tx.insert(planesDisciplinas).values(
        datos.disciplinaIds.map((disciplinaId) => ({
          planId: plan.id,
          disciplinaId,
        })),
      );
    });
    revalidatePath("/configuracion");
    return { ok: true };
  } catch (error) {
    return mensajeDeError(error);
  }
}

export async function actualizarPrecio(
  _estado: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  try {
    const usuario = await exigirSeccion("configuracion");
    const planId = z.coerce.number().int().positive().parse(formData.get("planId"));
    const monto = z.coerce
      .number({ message: "Poné el precio nuevo" })
      .positive("El precio debe ser mayor a cero")
      .parse(formData.get("monto"));
    const plan = await db.query.planes.findFirst({
      where: eq(planes.id, planId),
    });
    if (!plan) return { error: "El plan no existe" };
    autorizarSede(usuario, plan.sedeId);
    // Historial: siempre una fila nueva, nunca se pisa el precio anterior.
    await db.insert(preciosPlan).values({ planId, monto: monto.toFixed(2) });
    revalidatePath("/configuracion");
    return { ok: true };
  } catch (error) {
    return mensajeDeError(error);
  }
}

export async function alternarPlan(formData: FormData): Promise<void> {
  const usuario = await exigirSeccion("configuracion");
  const id = z.coerce.number().int().positive().parse(formData.get("id"));
  const plan = await db.query.planes.findFirst({ where: eq(planes.id, id) });
  if (!plan) return;
  autorizarSede(usuario, plan.sedeId);
  await db.update(planes).set({ activo: !plan.activo }).where(eq(planes.id, id));
  revalidatePath("/configuracion");
}

// --- API keys (Fase 7 — API pública v1) --------------------------------------

export type EstadoCrearApiKey = EstadoAccion & { clave?: string };

const esquemaApiKey = z.object({
  nombre: z.string().trim().min(2, "Poné un nombre descriptivo (ej.: n8n cumpleaños)"),
  alcances: z
    .array(z.string())
    .min(1, "Elegí al menos un alcance")
    .refine((lista) => lista.every(esAlcanceValido), {
      message: "Alcance inválido",
    }),
});

/**
 * Crea una API key nueva. La clave completa solo viaja en el `return` de esta
 * acción (mostrada una única vez en la UI): en la base solo queda su hash.
 */
export async function crearApiKey(
  _estado: EstadoCrearApiKey,
  formData: FormData,
): Promise<EstadoCrearApiKey> {
  try {
    const usuario = await exigirSeccion("configuracion");
    const datos = esquemaApiKey.parse({
      nombre: formData.get("nombre"),
      alcances: formData.getAll("alcances"),
    });
    const { clave, hash, ultimosCaracteres } = generarClave();
    await db.insert(apiKeys).values({
      nombre: datos.nombre,
      hash,
      ultimosCaracteres,
      alcances: datos.alcances,
      creadaPorId: usuario.id,
    });
    revalidatePath("/configuracion/api-keys");
    return { ok: true, clave };
  } catch (error) {
    return mensajeDeError(error);
  }
}

export async function revocarApiKey(formData: FormData): Promise<void> {
  await exigirSeccion("configuracion");
  const id = z.coerce.number().int().positive().parse(formData.get("id"));
  await db.update(apiKeys).set({ activa: false }).where(eq(apiKeys.id, id));
  revalidatePath("/configuracion/api-keys");
}
