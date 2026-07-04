"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  alumnos,
  pagoEntregas,
  pagos,
  planes,
  planesDisciplinas,
  preciosPlan,
  suscripciones,
  suscripcionesHorarios,
} from "@/db/schema";
import { exigirSeccion } from "@/lib/auth/guards";
import { autorizarSede, ErrorAutorizacion } from "@/lib/auth/permissions";
import { turnoAbierto } from "@/lib/caja";
import { venceVigente } from "@/lib/cobros";
import { esDeudor, saldoPendiente, totalEntregado, validarReparto } from "@/lib/deuda";
import { hoyISO } from "@/lib/fechas";
import { horariosConOcupacion } from "@/lib/operativa";
import { resolverHorariosDeSuscripcion } from "@/lib/reglas-suscripcion";
import { calcularVencimiento } from "@/lib/vencimientos";

export type EstadoAccion = { error?: string; ok?: boolean };

// Regla de negocio que aborta una transacción con mensaje para el usuario
// (p. ej. doble submit que completaría dos veces la misma deuda).
class ErrorDeNegocio extends Error {}

function mensajeDeError(error: unknown): EstadoAccion {
  if (error instanceof ErrorAutorizacion) return { error: error.message };
  if (error instanceof ErrorDeNegocio) return { error: error.message };
  if (error instanceof z.ZodError)
    return { error: error.issues[0]?.message ?? "Datos inválidos" };
  console.error(error);
  return { error: "Algo salió mal. Probá de nuevo." };
}

// --- Alumnos -----------------------------------------------------------------

const esquemaAlumno = z.object({
  sedeId: z.coerce.number().int().positive(),
  dni: z
    .string()
    .trim()
    .regex(/^\d{7,9}$/, "El DNI debe tener 7 u 8 números, sin puntos"),
  nombre: z.string().trim().min(2, "Poné el nombre"),
  apellido: z.string().trim().min(2, "Poné el apellido"),
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
  fechaNacimiento: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .pipe(
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha de nacimiento no es válida")
        .nullable(),
    ),
});

function datosDeFormulario(formData: FormData) {
  return esquemaAlumno.parse({
    sedeId: formData.get("sedeId"),
    dni: formData.get("dni"),
    nombre: formData.get("nombre"),
    apellido: formData.get("apellido"),
    telefono: formData.get("telefono"),
    email: formData.get("email") ?? "",
    fechaNacimiento: formData.get("fechaNacimiento") ?? "",
  });
}

export async function crearAlumno(
  _estado: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  let alumnoId: number;
  try {
    const usuario = await exigirSeccion("operativa");
    const datos = datosDeFormulario(formData);
    autorizarSede(usuario, datos.sedeId);

    const repetido = await db.query.alumnos.findFirst({
      where: and(eq(alumnos.sedeId, datos.sedeId), eq(alumnos.dni, datos.dni)),
    });
    if (repetido) {
      return {
        error: `Ya existe un alumno con ese DNI en esta sede (${repetido.nombre} ${repetido.apellido})`,
      };
    }
    const [creado] = await db.insert(alumnos).values(datos).returning();
    alumnoId = creado.id;
    revalidatePath("/alumnos");
  } catch (error) {
    return mensajeDeError(error);
  }
  redirect(`/alumnos/${alumnoId}`);
}

export async function editarAlumno(
  _estado: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  let alumnoId: number;
  try {
    const usuario = await exigirSeccion("operativa");
    alumnoId = z.coerce.number().int().positive().parse(formData.get("alumnoId"));
    const existente = await db.query.alumnos.findFirst({
      where: eq(alumnos.id, alumnoId),
    });
    if (!existente) return { error: "El alumno no existe" };
    // La sede del alumno no se cambia desde este formulario: se valida la real.
    autorizarSede(usuario, existente.sedeId);
    const datos = datosDeFormulario(formData);
    if (datos.sedeId !== existente.sedeId) {
      return { error: "No se puede cambiar la sede de un alumno desde acá" };
    }
    const repetido = await db.query.alumnos.findFirst({
      where: and(
        eq(alumnos.sedeId, existente.sedeId),
        eq(alumnos.dni, datos.dni),
      ),
    });
    if (repetido && repetido.id !== alumnoId) {
      return { error: "Ya existe otro alumno con ese DNI en esta sede" };
    }
    await db.update(alumnos).set(datos).where(eq(alumnos.id, alumnoId));
    revalidatePath("/alumnos");
    revalidatePath(`/alumnos/${alumnoId}`);
  } catch (error) {
    return mensajeDeError(error);
  }
  redirect(`/alumnos/${alumnoId}`);
}

// --- Suscripciones -------------------------------------------------------------

export async function crearSuscripcion(
  _estado: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  let alumnoId: number;
  try {
    const usuario = await exigirSeccion("operativa");
    alumnoId = z.coerce.number().int().positive().parse(formData.get("alumnoId"));
    const planId = z.coerce.number().int().positive().parse(formData.get("planId"));
    const horariosElegidos = z
      .array(z.coerce.number().int().positive())
      .parse(formData.getAll("horarioIds"));

    const alumno = await db.query.alumnos.findFirst({
      where: eq(alumnos.id, alumnoId),
    });
    if (!alumno) return { error: "El alumno no existe" };
    autorizarSede(usuario, alumno.sedeId);

    const plan = await db.query.planes.findFirst({
      where: and(
        eq(planes.id, planId),
        eq(planes.sedeId, alumno.sedeId),
        eq(planes.activo, true),
      ),
    });
    if (!plan) return { error: "El plan no existe o no está disponible" };

    // Precio vigente del plan al momento del alta.
    const [precio] = await db
      .select()
      .from(preciosPlan)
      .where(eq(preciosPlan.planId, plan.id))
      .orderBy(desc(preciosPlan.vigenteDesde))
      .limit(1);
    if (!precio) return { error: "El plan no tiene precio cargado" };

    // Horarios disponibles: los activos de las disciplinas del plan, con ocupación.
    const vinculos = await db
      .select({ disciplinaId: planesDisciplinas.disciplinaId })
      .from(planesDisciplinas)
      .where(eq(planesDisciplinas.planId, plan.id));
    const disciplinaIds = vinculos.map((v) => v.disciplinaId);
    const todos = await horariosConOcupacion(usuario, alumno.sedeId);
    const disponibles = todos.filter((h) =>
      disciplinaIds.includes(h.disciplinaId),
    );

    const resultado = resolverHorariosDeSuscripcion(
      { tipo: plan.tipo, frecuenciaSemanal: plan.frecuenciaSemanal },
      disponibles.map((h) => ({
        id: h.id,
        cupo: h.cupo,
        inscriptos: h.inscriptos,
      })),
      horariosElegidos,
    );
    if (!resultado.ok) return { error: resultado.error };

    await db.transaction(async (tx) => {
      const [sub] = await tx
        .insert(suscripciones)
        .values({
          sedeId: alumno.sedeId,
          alumnoId: alumno.id,
          planId: plan.id,
          fechaAlta: hoyISO(),
          montoAlta: precio.monto,
        })
        .returning();
      if (resultado.horarioIds.length > 0) {
        await tx.insert(suscripcionesHorarios).values(
          resultado.horarioIds.map((horarioId) => ({
            suscripcionId: sub.id,
            horarioId,
          })),
        );
      }
    });
    revalidatePath(`/alumnos/${alumnoId}`);
    revalidatePath("/horarios");
  } catch (error) {
    return mensajeDeError(error);
  }
  redirect(`/alumnos/${alumnoId}`);
}

// --- Pagos (Fase 3) -------------------------------------------------------------

// Cobro repartido entre medios: los campos vacíos cuentan como 0.
const montoDeMedio = z.preprocess(
  (v) => (v === "" || v === null ? 0 : v),
  z.coerce.number().min(0, "Los montos no pueden ser negativos"),
);

const esquemaPago = z.object({
  suscripcionId: z.coerce.number().int().positive(),
  montoAcordado: z.coerce
    .number({ message: "Poné el monto de la cuota" })
    .positive("El monto de la cuota debe ser mayor a cero"),
  efectivo: montoDeMedio,
  transferencia: montoDeMedio,
  fechaContrato: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha de inicio del contrato no es válida"),
});

export async function registrarPago(
  _estado: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  let alumnoId: number;
  let saldo: number;
  try {
    const usuario = await exigirSeccion("operativa");
    const datos = esquemaPago.parse({
      suscripcionId: formData.get("suscripcionId"),
      montoAcordado: formData.get("montoAcordado"),
      efectivo: formData.get("efectivo"),
      transferencia: formData.get("transferencia"),
      fechaContrato: formData.get("fechaContrato"),
    });
    if (datos.fechaContrato > hoyISO()) {
      return { error: "La fecha de inicio del contrato no puede ser futura" };
    }
    const reparto = validarReparto(
      datos.montoAcordado,
      datos.efectivo,
      datos.transferencia,
    );
    if (!reparto.ok) return { error: reparto.error };
    saldo = reparto.saldo;

    const sub = await db.query.suscripciones.findFirst({
      where: eq(suscripciones.id, datos.suscripcionId),
    });
    if (!sub) return { error: "La suscripción no existe" };
    autorizarSede(usuario, sub.sedeId);
    if (sub.estado !== "activa") {
      return { error: "La suscripción está dada de baja; reactivala creando una nueva" };
    }
    alumnoId = sub.alumnoId;

    // Vencimiento rodante DESDE LA FECHA DEL CONTRATO (no desde que entra la
    // plata): registrar el pago una semana tarde no corre el vencimiento.
    const vigente = await venceVigente(sub.id);
    const vence = calcularVencimiento(vigente, datos.fechaContrato);
    const turno = await turnoAbierto(sub.sedeId);
    const hoy = hoyISO();

    await db.transaction(async (tx) => {
      const [pago] = await tx
        .insert(pagos)
        .values({
          sedeId: sub.sedeId,
          suscripcionId: sub.id,
          monto: datos.montoAcordado.toFixed(2),
          fechaPago: datos.fechaContrato,
          vence,
          registradoPorId: usuario.id,
        })
        .returning();
      // Una entrega por medio con plata; las entregas se fechan HOY (cuándo
      // entró el dinero), aunque el contrato esté retro-datado.
      await tx.insert(pagoEntregas).values(
        entregasDelReparto(datos.efectivo, datos.transferencia).map((e) => ({
          pagoId: pago.id,
          sedeId: sub.sedeId,
          monto: e.monto.toFixed(2),
          medio: e.medio,
          fecha: hoy,
          turnoId: turno?.id ?? null,
          registradoPorId: usuario.id,
        })),
      );
    });
    revalidatePath(`/alumnos/${sub.alumnoId}`);
    revalidatePath("/inicio");
    revalidatePath("/cobros");
    revalidatePath("/caja");
    revalidatePath("/dashboard");
  } catch (error) {
    return mensajeDeError(error);
  }
  redirect(
    saldo > 0
      ? `/alumnos/${alumnoId}?pago=deudor&saldo=${saldo}`
      : `/alumnos/${alumnoId}?pago=ok`,
  );
}

function entregasDelReparto(efectivo: number, transferencia: number) {
  return [
    { medio: "efectivo" as const, monto: efectivo },
    { medio: "transferencia" as const, monto: transferencia },
  ].filter((e) => e.monto > 0);
}

/**
 * Entrega suelta sobre un contrato con saldo (completar una deuda).
 * No toca el vencimiento: el contrato ya habilitó hasta su `vence`.
 */
export async function registrarEntrega(
  _estado: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  let alumnoId: number;
  try {
    const usuario = await exigirSeccion("operativa");
    const datos = z
      .object({
        pagoId: z.coerce.number().int().positive(),
        efectivo: montoDeMedio,
        transferencia: montoDeMedio,
      })
      .parse({
        pagoId: formData.get("pagoId"),
        efectivo: formData.get("efectivo"),
        transferencia: formData.get("transferencia"),
      });

    const pago = await db.query.pagos.findFirst({
      where: eq(pagos.id, datos.pagoId),
    });
    if (!pago) return { error: "El contrato no existe" };
    autorizarSede(usuario, pago.sedeId);
    const sub = await db.query.suscripciones.findFirst({
      where: eq(suscripciones.id, pago.suscripcionId),
    });
    if (!sub) return { error: "La suscripción no existe" };
    alumnoId = sub.alumnoId;

    const turno = await turnoAbierto(pago.sedeId);
    const hoy = hoyISO();

    await db.transaction(async (tx) => {
      // El saldo se relee DENTRO de la transacción: un doble submit no
      // puede completar la misma deuda dos veces.
      const previas = await tx
        .select()
        .from(pagoEntregas)
        .where(eq(pagoEntregas.pagoId, pago.id));
      const saldo = saldoPendiente(Number(pago.monto), totalEntregado(previas));
      if (!esDeudor(saldo)) {
        throw new ErrorDeNegocio("Este contrato no tiene deuda pendiente");
      }
      const reparto = validarReparto(saldo, datos.efectivo, datos.transferencia);
      if (!reparto.ok) throw new ErrorDeNegocio(reparto.error);

      await tx.insert(pagoEntregas).values(
        entregasDelReparto(datos.efectivo, datos.transferencia).map((e) => ({
          pagoId: pago.id,
          sedeId: pago.sedeId,
          monto: e.monto.toFixed(2),
          medio: e.medio,
          fecha: hoy,
          turnoId: turno?.id ?? null,
          registradoPorId: usuario.id,
        })),
      );
    });
    revalidatePath(`/alumnos/${alumnoId}`);
    revalidatePath("/inicio");
    revalidatePath("/cobros");
    revalidatePath("/caja");
    revalidatePath("/dashboard");
  } catch (error) {
    return mensajeDeError(error);
  }
  redirect(`/alumnos/${alumnoId}?pago=ok`);
}

export async function darDeBajaSuscripcion(
  _estado: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  try {
    const usuario = await exigirSeccion("operativa");
    const suscripcionId = z.coerce
      .number()
      .int()
      .positive()
      .parse(formData.get("suscripcionId"));
    const motivo = String(formData.get("motivo") ?? "").trim() || null;

    const sub = await db.query.suscripciones.findFirst({
      where: eq(suscripciones.id, suscripcionId),
    });
    if (!sub) return { error: "La suscripción no existe" };
    autorizarSede(usuario, sub.sedeId);
    if (sub.estado === "baja") return { error: "Ya estaba dada de baja" };

    await db
      .update(suscripciones)
      .set({ estado: "baja", fechaBaja: hoyISO(), motivoBaja: motivo })
      .where(eq(suscripciones.id, suscripcionId));

    // Libera los cupos que ocupaba (la ocupación cuenta solo suscripciones activas,
    // así que basta el cambio de estado; se conservan los horarios como historial).
    revalidatePath(`/alumnos/${sub.alumnoId}`);
    revalidatePath("/horarios");
    return { ok: true };
  } catch (error) {
    return mensajeDeError(error);
  }
}
