import "dotenv/config";
import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "./index";
import {
  alumnos,
  disciplinas,
  horarios,
  planes,
  planesDisciplinas,
  preciosPlan,
  sedes,
  suscripciones,
  suscripcionesHorarios,
  usuarios,
} from "./schema";
import { hashearPassword } from "../lib/auth/password";
import {
  CLAVE_MENSAJE_INTERESADOS,
  CLAVE_MENSAJE_RECONTACTO,
  MENSAJE_INTERESADOS_DEFAULT,
  MENSAJE_RECONTACTO_DEFAULT,
} from "../lib/mensajes";
import { calcularVencimiento } from "../lib/vencimientos";
import { hoyISO } from "../lib/fechas";
import { configuracion } from "./schema";
import {
  categoriasGasto,
  gastos,
  leadDisciplinas,
  leads,
  movimientosCaja,
  pagoEntregas,
  pagos,
  turnosCaja,
} from "./schema";

// Datos semilla: sedes y usuarios (Fase 1) + disciplinas, horarios, planes y
// alumnos ficticios (Fase 2). Idempotente: busca por claves naturales antes de
// insertar, se puede correr las veces que haga falta.
//
// Las disciplinas y horarios son los reales publicados en la web de la academia.
// Los alumnos y precios son ficticios para probar; se reemplazan en la Fase 8.

const PASSWORD_PRUEBA = "ritmos123";

// Días ISO: 1 = lunes … 7 = domingo
const LMV = [1, 3, 5];
const MJ = [2, 4];

async function asegurarSede(datos: {
  nombre: string;
  direccion: string;
  telefono: string;
}) {
  const existente = await db.query.sedes.findFirst({
    where: eq(sedes.nombre, datos.nombre),
  });
  if (existente) return existente;
  const [creada] = await db.insert(sedes).values(datos).returning();
  return creada;
}

async function asegurarUsuario(datos: {
  nombre: string;
  email: string;
  rol: "secretaria" | "admin" | "owner";
  sedeId: number | null;
}) {
  const existente = await db.query.usuarios.findFirst({
    where: eq(usuarios.email, datos.email),
  });
  if (existente) return existente;
  const passwordHash = await hashearPassword(PASSWORD_PRUEBA);
  const [creado] = await db
    .insert(usuarios)
    .values({ ...datos, passwordHash })
    .returning();
  return creado;
}

async function asegurarDisciplina(sedeId: number, nombre: string) {
  const existente = await db.query.disciplinas.findFirst({
    where: and(eq(disciplinas.sedeId, sedeId), eq(disciplinas.nombre, nombre)),
  });
  if (existente) return existente;
  const [creada] = await db
    .insert(disciplinas)
    .values({ sedeId, nombre })
    .returning();
  return creada;
}

async function asegurarHorario(
  disciplina: { id: number; sedeId: number },
  diaSemana: number,
  hora: string,
  opciones: { nota?: string; cupo?: number } = {},
) {
  const existente = await db.query.horarios.findFirst({
    where: and(
      eq(horarios.disciplinaId, disciplina.id),
      eq(horarios.diaSemana, diaSemana),
      eq(horarios.hora, hora),
      ...(opciones.nota ? [eq(horarios.nota, opciones.nota)] : []),
    ),
  });
  if (existente) return existente;
  const [creado] = await db
    .insert(horarios)
    .values({
      sedeId: disciplina.sedeId,
      disciplinaId: disciplina.id,
      diaSemana,
      hora,
      nota: opciones.nota ?? null,
      cupo: opciones.cupo ?? null,
    })
    .returning();
  return creado;
}

async function asegurarPlan(datos: {
  sedeId: number;
  nombre: string;
  tipo: "disciplina" | "pack" | "frecuencia";
  frecuenciaSemanal?: number;
  disciplinaIds: number[];
  precio: number;
}) {
  const existente = await db.query.planes.findFirst({
    where: and(eq(planes.sedeId, datos.sedeId), eq(planes.nombre, datos.nombre)),
  });
  if (existente) return existente;
  const [plan] = await db
    .insert(planes)
    .values({
      sedeId: datos.sedeId,
      nombre: datos.nombre,
      tipo: datos.tipo,
      frecuenciaSemanal: datos.frecuenciaSemanal ?? null,
    })
    .returning();
  await db.insert(planesDisciplinas).values(
    datos.disciplinaIds.map((disciplinaId) => ({
      planId: plan.id,
      disciplinaId,
    })),
  );
  await db
    .insert(preciosPlan)
    .values({ planId: plan.id, monto: datos.precio.toFixed(2) });
  return plan;
}

/** Deja al plan con un aumento registrado (para ver el historial de precios). */
async function asegurarAumento(planId: number, montoNuevo: number) {
  const [{ cantidad }] = await db
    .select({ cantidad: count() })
    .from(preciosPlan)
    .where(eq(preciosPlan.planId, planId));
  if (cantidad >= 2) return;
  await db
    .insert(preciosPlan)
    .values({ planId, monto: montoNuevo.toFixed(2) });
}

async function asegurarAlumno(datos: {
  sedeId: number;
  dni: string;
  nombre: string;
  apellido: string;
  telefono: string;
  email?: string;
  fechaNacimiento?: string;
}) {
  const existente = await db.query.alumnos.findFirst({
    where: and(eq(alumnos.sedeId, datos.sedeId), eq(alumnos.dni, datos.dni)),
  });
  if (existente) return existente;
  const [creado] = await db
    .insert(alumnos)
    .values({
      ...datos,
      email: datos.email ?? null,
      fechaNacimiento: datos.fechaNacimiento ?? null,
    })
    .returning();
  return creado;
}

async function asegurarSuscripcion(
  alumno: { id: number; sedeId: number },
  planId: number,
  horarioIds: number[],
  fechaAlta: string,
) {
  const existente = await db.query.suscripciones.findFirst({
    where: and(
      eq(suscripciones.alumnoId, alumno.id),
      eq(suscripciones.planId, planId),
    ),
  });
  if (existente) return existente;
  const [precio] = await db
    .select()
    .from(preciosPlan)
    .where(eq(preciosPlan.planId, planId))
    .orderBy(desc(preciosPlan.vigenteDesde))
    .limit(1);
  const [sub] = await db
    .insert(suscripciones)
    .values({
      sedeId: alumno.sedeId,
      alumnoId: alumno.id,
      planId,
      fechaAlta,
      montoAlta: precio.monto,
    })
    .returning();
  if (horarioIds.length > 0) {
    await db.insert(suscripcionesHorarios).values(
      horarioIds.map((horarioId) => ({ suscripcionId: sub.id, horarioId })),
    );
  }
  return sub;
}

function restarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  const fecha = new Date(Date.UTC(a, m - 1, d - dias));
  return fecha.toISOString().slice(0, 10);
}

/** Primer pago de una suscripción (si no tiene ninguno), N días atrás. */
async function asegurarPagoInicial(
  sub: { id: number; sedeId: number; montoAlta: string },
  diasAtras: number,
  medio: "efectivo" | "transferencia" = "efectivo",
) {
  const existente = await db.query.pagos.findFirst({
    where: eq(pagos.suscripcionId, sub.id),
  });
  if (existente) return;
  const fechaPago = restarDias(hoyISO(), diasAtras);
  const [pago] = await db
    .insert(pagos)
    .values({
      sedeId: sub.sedeId,
      suscripcionId: sub.id,
      monto: sub.montoAlta,
      fechaPago,
      vence: calcularVencimiento(null, fechaPago),
    })
    .returning();
  // Cobrado completo en una sola entrega, el mismo día del contrato.
  await db.insert(pagoEntregas).values({
    pagoId: pago.id,
    sedeId: sub.sedeId,
    monto: sub.montoAlta,
    medio,
    fecha: fechaPago,
  });
}

/**
 * Contrato de HOY pagado en parte (una sola entrega en efectivo): deja al
 * alumno como deudor para probar saldos, badges y "completar deuda".
 * Solo si la suscripción tiene a lo sumo el pago inicial.
 */
async function asegurarPagoParcial(
  sub: { id: number; sedeId: number },
  acordado: number,
  entregado: number,
) {
  const [{ cantidad }] = await db
    .select({ cantidad: count() })
    .from(pagos)
    .where(eq(pagos.suscripcionId, sub.id));
  if (cantidad >= 2) return;
  const hoy = hoyISO();
  const vigente = await db.query.pagos.findFirst({
    where: eq(pagos.suscripcionId, sub.id),
    orderBy: desc(pagos.vence),
  });
  const [pago] = await db
    .insert(pagos)
    .values({
      sedeId: sub.sedeId,
      suscripcionId: sub.id,
      monto: acordado.toFixed(2),
      fechaPago: hoy,
      vence: calcularVencimiento(vigente?.vence ?? null, hoy),
    })
    .returning();
  await db.insert(pagoEntregas).values({
    pagoId: pago.id,
    sedeId: sub.sedeId,
    monto: entregado.toFixed(2),
    medio: "efectivo",
    fecha: hoy,
  });
}

/**
 * Turno de caja abierto HOY en la sede (si no hay ninguno abierto), con un
 * egreso de ejemplo. Devuelve el turno para vincular entregas.
 */
async function asegurarTurnoAbierto(sedeId: number, abiertoPorId: number) {
  const abierto = await db.query.turnosCaja.findFirst({
    where: and(eq(turnosCaja.sedeId, sedeId), isNull(turnosCaja.cerradoEn)),
  });
  if (abierto) return abierto;
  const [turno] = await db
    .insert(turnosCaja)
    .values({
      sedeId,
      abiertoPorId,
      efectivoInicial: "20000.00",
    })
    .returning();
  await db.insert(movimientosCaja).values({
    turnoId: turno.id,
    monto: "3500.00",
    concepto: "Agua y descartables",
    registradoPorId: abiertoPorId,
  });
  return turno;
}

/**
 * Renovación de HOY cobrada mixta (efectivo + transferencia) dentro del
 * turno: alimenta el resumen de caja. Solo si la suscripción tiene un pago.
 */
async function asegurarPagoMixtoEnTurno(
  sub: { id: number; sedeId: number },
  turnoId: number,
  registradoPorId: number,
) {
  const [{ cantidad }] = await db
    .select({ cantidad: count() })
    .from(pagos)
    .where(eq(pagos.suscripcionId, sub.id));
  if (cantidad >= 2) return;
  const hoy = hoyISO();
  const vigente = await db.query.pagos.findFirst({
    where: eq(pagos.suscripcionId, sub.id),
    orderBy: desc(pagos.vence),
  });
  const [pago] = await db
    .insert(pagos)
    .values({
      sedeId: sub.sedeId,
      suscripcionId: sub.id,
      monto: "28000.00",
      fechaPago: hoy,
      vence: calcularVencimiento(vigente?.vence ?? null, hoy),
      registradoPorId,
    })
    .returning();
  await db.insert(pagoEntregas).values([
    {
      pagoId: pago.id,
      sedeId: sub.sedeId,
      monto: "18000.00",
      medio: "efectivo",
      fecha: hoy,
      turnoId,
      registradoPorId,
    },
    {
      pagoId: pago.id,
      sedeId: sub.sedeId,
      monto: "10000.00",
      medio: "transferencia",
      fecha: hoy,
      turnoId,
      registradoPorId,
    },
  ]);
}

async function main() {
  // --- Sedes y usuarios (Fase 1) ------------------------------------------
  const aconquija = await asegurarSede({
    nombre: "Sede SQ",
    direccion: "Av. Aconquija 946, Unidad Sionista",
    telefono: "5493816332438",
  });
  const yerbaBuena = await asegurarSede({
    nombre: "Sede LS",
    direccion: "Julio Argentino Roca 124, Yerba Buena",
    telefono: "5493815838208",
  });

  const secAconquija = await asegurarUsuario({
    nombre: "Secretaría Aconquija",
    email: "secretaria.aconquija@ritmoslatinos.test",
    rol: "secretaria",
    sedeId: aconquija.id,
  });
  await asegurarUsuario({
    nombre: "Secretaría Yerba Buena",
    email: "secretaria.yerbabuena@ritmoslatinos.test",
    rol: "secretaria",
    sedeId: yerbaBuena.id,
  });
  await asegurarUsuario({
    nombre: "Administración",
    email: "admin@ritmoslatinos.test",
    rol: "admin",
    sedeId: null,
  });
  await asegurarUsuario({
    nombre: "Dueños",
    email: "owner@ritmoslatinos.test",
    rol: "owner",
    sedeId: null,
  });

  // --- Disciplinas y horarios reales (Fase 2) ------------------------------
  // Sede Aconquija
  const zumba = await asegurarDisciplina(aconquija.id, "Zumba");
  const mixRitmos = await asegurarDisciplina(aconquija.id, "Mix de Ritmos");
  const reggaeton = await asegurarDisciplina(aconquija.id, "Reggaetón");
  const jazz = await asegurarDisciplina(aconquija.id, "Jazz");
  const coreoKids = await asegurarDisciplina(aconquija.id, "Coreo Kids");

  for (const dia of LMV) await asegurarHorario(zumba, dia, "09:00");
  for (const dia of MJ) await asegurarHorario(mixRitmos, dia, "09:00");
  for (const dia of LMV) await asegurarHorario(reggaeton, dia, "15:30");
  for (const dia of MJ) await asegurarHorario(jazz, dia, "20:00");
  for (const dia of MJ)
    await asegurarHorario(coreoKids, dia, "19:00", { cupo: 15 });

  // Sede Yerba Buena
  const pole = await asegurarDisciplina(yerbaBuena.id, "Pole Sport");
  const fullBody = await asegurarDisciplina(yerbaBuena.id, "Full Body & Dance");
  const stretching = await asegurarDisciplina(yerbaBuena.id, "Stretching");
  const salsa = await asegurarDisciplina(yerbaBuena.id, "Salsa y Bachata");
  const telas = await asegurarDisciplina(yerbaBuena.id, "Telas");

  const horariosPole: { id: number }[] = [];
  for (const dia of LMV)
    horariosPole.push(await asegurarHorario(pole, dia, "17:00", { cupo: 8 }));
  for (const dia of LMV)
    horariosPole.push(await asegurarHorario(pole, dia, "18:00", { cupo: 8 }));
  for (const dia of MJ)
    horariosPole.push(await asegurarHorario(pole, dia, "14:30", { cupo: 8 }));
  for (const dia of MJ)
    horariosPole.push(await asegurarHorario(pole, dia, "21:00", { cupo: 8 }));

  for (const dia of LMV) await asegurarHorario(fullBody, dia, "09:00");
  for (const dia of MJ) await asegurarHorario(fullBody, dia, "18:00");
  for (const dia of MJ) await asegurarHorario(stretching, dia, "10:00");
  for (const dia of [3, 5])
    await asegurarHorario(salsa, dia, "19:00", { nota: "Principiantes" });
  for (const dia of [3, 5])
    await asegurarHorario(salsa, dia, "20:00", { nota: "Intermedios" });
  const horariosTelas: { id: number }[] = [];
  for (const dia of MJ)
    horariosTelas.push(
      await asegurarHorario(telas, dia, "18:00", { nota: "6 a 11 años", cupo: 10 }),
    );
  for (const dia of MJ)
    horariosTelas.push(
      await asegurarHorario(telas, dia, "19:00", { nota: "6 a 11 años", cupo: 10 }),
    );
  for (const dia of MJ)
    horariosTelas.push(
      await asegurarHorario(telas, dia, "20:00", { nota: "12 años en adelante", cupo: 10 }),
    );

  // --- Planes (precios ficticios) -------------------------------------------
  const planZumba = await asegurarPlan({
    sedeId: aconquija.id,
    nombre: "Zumba",
    tipo: "disciplina",
    disciplinaIds: [zumba.id],
    precio: 25000,
  });
  await asegurarAumento(planZumba.id, 28000);
  await asegurarPlan({
    sedeId: aconquija.id,
    nombre: "Mix de Ritmos",
    tipo: "disciplina",
    disciplinaIds: [mixRitmos.id],
    precio: 28000,
  });
  await asegurarPlan({
    sedeId: aconquija.id,
    nombre: "Reggaetón",
    tipo: "disciplina",
    disciplinaIds: [reggaeton.id],
    precio: 28000,
  });
  await asegurarPlan({
    sedeId: aconquija.id,
    nombre: "Jazz",
    tipo: "disciplina",
    disciplinaIds: [jazz.id],
    precio: 28000,
  });
  const planKids = await asegurarPlan({
    sedeId: aconquija.id,
    nombre: "Coreo Kids",
    tipo: "disciplina",
    disciplinaIds: [coreoKids.id],
    precio: 24000,
  });
  await asegurarPlan({
    sedeId: aconquija.id,
    nombre: "Pack Zumba + Mix de Ritmos",
    tipo: "pack",
    disciplinaIds: [zumba.id, mixRitmos.id],
    precio: 42000,
  });

  const pole2x = await asegurarPlan({
    sedeId: yerbaBuena.id,
    nombre: "Pole 2x semana",
    tipo: "frecuencia",
    frecuenciaSemanal: 2,
    disciplinaIds: [pole.id],
    precio: 36000,
  });
  await asegurarAumento(pole2x.id, 40000);
  const pole3x = await asegurarPlan({
    sedeId: yerbaBuena.id,
    nombre: "Pole 3x semana",
    tipo: "frecuencia",
    frecuenciaSemanal: 3,
    disciplinaIds: [pole.id],
    precio: 46000,
  });
  await asegurarAumento(pole3x.id, 52000);
  await asegurarPlan({
    sedeId: yerbaBuena.id,
    nombre: "Pole 4x semana",
    tipo: "frecuencia",
    frecuenciaSemanal: 4,
    disciplinaIds: [pole.id],
    precio: 60000,
  });
  const telas2x = await asegurarPlan({
    sedeId: yerbaBuena.id,
    nombre: "Telas 2x semana",
    tipo: "frecuencia",
    frecuenciaSemanal: 2,
    disciplinaIds: [telas.id],
    precio: 36000,
  });
  const planSalsa = await asegurarPlan({
    sedeId: yerbaBuena.id,
    nombre: "Salsa y Bachata",
    tipo: "disciplina",
    disciplinaIds: [salsa.id],
    precio: 26000,
  });
  await asegurarPlan({
    sedeId: yerbaBuena.id,
    nombre: "Full Body & Dance",
    tipo: "disciplina",
    disciplinaIds: [fullBody.id],
    precio: 28000,
  });
  await asegurarPlan({
    sedeId: yerbaBuena.id,
    nombre: "Stretching",
    tipo: "disciplina",
    disciplinaIds: [stretching.id],
    precio: 22000,
  });

  // --- Alumnos ficticios con suscripciones ----------------------------------
  const horariosZumba = await db.query.horarios.findMany({
    where: eq(horarios.disciplinaId, zumba.id),
  });
  const horariosKids = await db.query.horarios.findMany({
    where: eq(horarios.disciplinaId, coreoKids.id),
  });
  const horariosSalsa = await db.query.horarios.findMany({
    where: eq(horarios.disciplinaId, salsa.id),
  });

  const lucia = await asegurarAlumno({
    sedeId: aconquija.id,
    dni: "38123456",
    nombre: "Lucía",
    apellido: "Medina",
    telefono: "381 555 1001",
    email: "lucia.medina@mail.test",
    fechaNacimiento: "1994-07-15",
  });
  const subLucia = await asegurarSuscripcion(
    lucia,
    planZumba.id,
    horariosZumba.map((h) => h.id),
    "2026-06-10",
  );
  await asegurarPagoInicial(subLucia, 35); // renovó hoy en el turno (abajo)

  // --- Caja (Fase 8): turno abierto hoy con un egreso y un pago mixto ------
  const turnoAconquija = await asegurarTurnoAbierto(
    aconquija.id,
    secAconquija.id,
  );
  await asegurarPagoMixtoEnTurno(subLucia, turnoAconquija.id, secAconquija.id);

  const valentina = await asegurarAlumno({
    sedeId: aconquija.id,
    dni: "45678901",
    nombre: "Valentina",
    apellido: "Suárez",
    telefono: "381 555 1002",
    fechaNacimiento: "2016-07-22",
  });
  const subValentina = await asegurarSuscripcion(
    valentina,
    planKids.id,
    horariosKids.map((h) => h.id),
    "2026-06-15",
  );
  await asegurarPagoInicial(subValentina, 33, "transferencia"); // vencida hace días

  await asegurarAlumno({
    sedeId: aconquija.id,
    dni: "33456789",
    nombre: "Patricia",
    apellido: "Sosa",
    telefono: "381 555 1003",
    fechaNacimiento: "1988-01-30",
  });

  const camila = await asegurarAlumno({
    sedeId: yerbaBuena.id,
    dni: "40111222",
    nombre: "Camila",
    apellido: "Rodríguez",
    telefono: "381 555 2001",
    email: "cami.rodriguez@mail.test",
    fechaNacimiento: "1999-07-08",
  });
  const subCamila = await asegurarSuscripcion(
    camila,
    pole3x.id,
    [horariosPole[0].id, horariosPole[1].id, horariosPole[2].id],
    "2026-05-20",
  );
  await asegurarPagoInicial(subCamila, 10, "transferencia"); // al día

  const florencia = await asegurarAlumno({
    sedeId: yerbaBuena.id,
    dni: "41333444",
    nombre: "Florencia",
    apellido: "Torres",
    telefono: "381 555 2002",
    fechaNacimiento: "2001-11-03",
  });
  const subFlorencia = await asegurarSuscripcion(
    florencia,
    pole2x.id,
    [horariosPole[6].id, horariosPole[7].id],
    "2026-06-02",
  );
  await asegurarPagoInicial(subFlorencia, 28); // por vencer (vence en ~2 días)
  // Renovó hoy pagando el 60 %: queda deudora del resto (pagos parciales).
  await asegurarPagoParcial(subFlorencia, 40000, 24000);

  const marina = await asegurarAlumno({
    sedeId: yerbaBuena.id,
    dni: "46555666",
    nombre: "Marina",
    apellido: "Paz",
    telefono: "381 555 2003",
    fechaNacimiento: "2015-03-12",
  });
  const subMarina = await asegurarSuscripcion(
    marina,
    telas2x.id,
    [horariosTelas[0].id, horariosTelas[1].id],
    "2026-06-20",
  );
  await asegurarPagoInicial(subMarina, 45); // vencida hace ~15 días

  const pablo = await asegurarAlumno({
    sedeId: yerbaBuena.id,
    dni: "35777888",
    nombre: "Pablo",
    apellido: "González",
    telefono: "381 555 2004",
    email: "pablo.g@mail.test",
    fechaNacimiento: "1990-12-01",
  });
  await asegurarSuscripcion(
    pablo,
    planSalsa.id,
    horariosSalsa.map((h) => h.id),
    "2026-06-25",
  );

  await asegurarAlumno({
    sedeId: yerbaBuena.id,
    dni: "39999000",
    nombre: "Andrea",
    apellido: "López",
    telefono: "381 555 2005",
    fechaNacimiento: "1996-07-28",
  });

  // --- Gastos (Fase 4): categorías y dos meses de ejemplo --------------------
  async function asegurarCategoria(nombre: string) {
    const existente = await db.query.categoriasGasto.findFirst({
      where: eq(categoriasGasto.nombre, nombre),
    });
    if (existente) return existente;
    const [creada] = await db
      .insert(categoriasGasto)
      .values({ nombre })
      .returning();
    return creada;
  }

  const alquiler = await asegurarCategoria("Alquiler");
  const sueldos = await asegurarCategoria("Sueldos");
  const servicios = await asegurarCategoria("Servicios");
  const limpieza = await asegurarCategoria("Limpieza");
  const publicidad = await asegurarCategoria("Publicidad");
  await asegurarCategoria("Mantenimiento");

  const hayGastos = await db.query.gastos.findFirst();
  if (!hayGastos) {
    const hoy = hoyISO();
    const mesActual = `${hoy.slice(0, 7)}-05`;
    const mesPasado = restarDias(`${hoy.slice(0, 7)}-05`, 30);
    const filas: (typeof gastos.$inferInsert)[] = [];
    for (const [sedeId, factor] of [
      [aconquija.id, 1],
      [yerbaBuena.id, 1.3],
    ] as const) {
      for (const fecha of [mesPasado, mesActual]) {
        filas.push(
          { sedeId, tipo: "fijo", categoriaId: alquiler.id, monto: (350000 * factor).toFixed(2), fecha, descripcion: "Alquiler del local" },
          { sedeId, tipo: "fijo", categoriaId: sueldos.id, monto: (420000 * factor).toFixed(2), fecha, descripcion: "Sueldos profes" },
          { sedeId, tipo: "variable", categoriaId: servicios.id, monto: (85000 * factor).toFixed(2), fecha, descripcion: "Luz y agua" },
          { sedeId, tipo: "variable", categoriaId: limpieza.id, monto: (40000 * factor).toFixed(2), fecha },
        );
      }
      filas.push({
        sedeId,
        tipo: "variable",
        categoriaId: publicidad.id,
        monto: (60000 * factor).toFixed(2),
        fecha: mesActual,
        descripcion: "Meta Ads",
      });
    }
    await db.insert(gastos).values(filas);
  }

  // --- Leads del CRM (Fase 6) ------------------------------------------------
  const hayLeads = await db.query.leads.findFirst();
  if (!hayLeads) {
    const horarioPrueba = await db.query.horarios.findFirst({
      where: eq(horarios.disciplinaId, pole.id),
    });
    await db.insert(leads).values([
      {
        nombre: "Sofía Aguirre",
        telefono: "381 555 3001",
        sedeInteresId: yerbaBuena.id,
        origen: "manual",
        nota: "Preguntó por pole para principiantes",
        estado: "nuevo",
      },
      {
        nombre: "Martina Vega",
        telefono: "381 555 3002",
        sedeInteresId: aconquija.id,
        origen: "api",
        fuente: "Meta Ads",
        estado: "contactado",
      },
      {
        nombre: "Josefina Ríos",
        telefono: "381 555 3003",
        sedeInteresId: yerbaBuena.id,
        origen: "manual",
        estado: "prueba_agendada",
        pruebaFecha: restarDias(hoyISO(), -7),
        pruebaHorarioId: horarioPrueba?.id ?? null,
      },
      {
        nombre: "Carla Núñez",
        telefono: "381 555 3004",
        origen: "api",
        fuente: "Formulario web",
        estado: "perdido",
        motivoPerdida: "Le quedaba lejos",
      },
    ]);
  }

  // Interesados cargados HOY desde el mostrador (Fase 8).
  const hayMostrador = await db.query.leads.findFirst({
    where: eq(leads.fuente, "mostrador"),
  });
  if (!hayMostrador) {
    await db.insert(leads).values([
      {
        nombre: "Rocío Fernández",
        telefono: "381 555 3005",
        email: "rocio.f@mail.test",
        sedeInteresId: aconquija.id,
        origen: "manual",
        fuente: "mostrador",
        nota: "Vino a averiguar por zumba a la mañana",
        estado: "nuevo",
      },
      {
        nombre: "Julieta Paz",
        telefono: "381 555 3006",
        sedeInteresId: aconquija.id,
        origen: "manual",
        fuente: "mostrador",
        estado: "nuevo",
      },
    ]);
  }

  // Disciplinas de interés de los leads y un lead frío (rediseño CRM R2):
  // la sede del lead se deriva de la disciplina; Sofía queda quieta hace
  // 5 días para ver la alerta de frío en el kanban.
  const interesDe = async (telefono: string, disciplinaId: number) => {
    const lead = await db.query.leads.findFirst({
      where: eq(leads.telefono, telefono),
    });
    if (!lead) return;
    await db
      .insert(leadDisciplinas)
      .values({ leadId: lead.id, disciplinaId })
      .onConflictDoNothing();
  };
  await interesDe("381 555 3001", pole.id); // Sofía → Pole (Sede LS)
  await interesDe("381 555 3005", zumba.id); // Rocío → Zumba (Sede SQ)
  await db
    .update(leads)
    .set({ etapaDesde: new Date(Date.now() - 5 * 86_400_000) })
    .where(eq(leads.telefono, "381 555 3001"));

  // Clasificar el origen de negocio de los leads semilla por su fuente
  // (mismo criterio que el backfill de la migración 0008; idempotente).
  await db.execute(sql`
    update leads set origen_negocio_id = o.id
    from origenes_negocio o
    where lower(leads.fuente) = lower(o.nombre)
      and leads.origen_negocio_id is null
  `);

  // Plantillas de WhatsApp (editables en Configuración): interesados y recontacto.
  await db
    .insert(configuracion)
    .values([
      { clave: CLAVE_MENSAJE_INTERESADOS, valor: MENSAJE_INTERESADOS_DEFAULT },
      { clave: CLAVE_MENSAJE_RECONTACTO, valor: MENSAJE_RECONTACTO_DEFAULT },
    ])
    .onConflictDoNothing();

  console.log("Seed listo.");
  console.log("Usuarios de prueba (contraseña: %s):", PASSWORD_PRUEBA);
  console.log("  secretaria.aconquija@ritmoslatinos.test  (secretaria, Sede Aconquija)");
  console.log("  secretaria.yerbabuena@ritmoslatinos.test (secretaria, Sede Yerba Buena)");
  console.log("  admin@ritmoslatinos.test                 (admin, todas las sedes)");
  console.log("  owner@ritmoslatinos.test                 (owner, solo dashboard)");
  process.exit(0);
}

main().catch((error) => {
  console.error("Error corriendo el seed:", error);
  process.exit(1);
});
