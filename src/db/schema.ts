import {
  boolean,
  date,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Roles internos del sistema. La matriz de permisos vive en src/lib/auth/permissions.ts
export const rolUsuarioEnum = pgEnum("rol_usuario", [
  "secretaria",
  "admin",
  "owner",
]);

// Toda entidad operativa del sistema referencia a una sede (multi-tenant por sede).
export const sedes = pgTable("sedes", {
  id: serial("id").primaryKey(),
  nombre: text("nombre").notNull(),
  direccion: text("direccion"),
  telefono: text("telefono"),
  activa: boolean("activa").notNull().default(true),
  creadaEn: timestamp("creada_en", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const usuarios = pgTable(
  "usuarios",
  {
    id: serial("id").primaryKey(),
    nombre: text("nombre").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    rol: rolUsuarioEnum("rol").notNull(),
    // Solo obligatoria para secretarias: define la única sede que pueden operar.
    // Admin y owner alcanzan todas las sedes (sedeId nulo).
    sedeId: integer("sede_id").references(() => sedes.id),
    activo: boolean("activo").notNull().default(true),
    creadoEn: timestamp("creado_en", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (tabla) => [uniqueIndex("usuarios_email_unico").on(tabla.email)],
);

// ---------------------------------------------------------------------------
// Núcleo operativo (Fase 2)
// ---------------------------------------------------------------------------

// Actividad que se dicta en una sede (Pole, Telas, Salsa…). Los horarios
// cuelgan de la disciplina, no del plan (decisión abierta 1 del PLAN.md):
// "Pole 2x" y "Pole 3x" comparten los mismos horarios de Pole.
export const disciplinas = pgTable("disciplinas", {
  id: serial("id").primaryKey(),
  sedeId: integer("sede_id")
    .notNull()
    .references(() => sedes.id),
  nombre: text("nombre").notNull(),
  activa: boolean("activa").notNull().default(true),
  creadaEn: timestamp("creada_en", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Clase semanal fija: día + hora, con cupo opcional. Se repite igual cada semana.
export const horarios = pgTable("horarios", {
  id: serial("id").primaryKey(),
  sedeId: integer("sede_id")
    .notNull()
    .references(() => sedes.id),
  disciplinaId: integer("disciplina_id")
    .notNull()
    .references(() => disciplinas.id),
  // 1 = lunes … 7 = domingo (ISO)
  diaSemana: smallint("dia_semana").notNull(),
  hora: time("hora").notNull(),
  // Texto libre opcional que distingue comisiones ("Principiantes", "6 a 11 años").
  nota: text("nota"),
  // Máximo de inscriptos; null = sin límite.
  cupo: integer("cupo"),
  activo: boolean("activo").notNull().default(true),
  creadoEn: timestamp("creado_en", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const tipoPlanEnum = pgEnum("tipo_plan", [
  "disciplina", // una disciplina, el alumno va a todos sus horarios
  "pack", // varias disciplinas completas
  "frecuencia", // N veces por semana de una disciplina, eligiendo horarios
]);

export const planes = pgTable("planes", {
  id: serial("id").primaryKey(),
  sedeId: integer("sede_id")
    .notNull()
    .references(() => sedes.id),
  nombre: text("nombre").notNull(),
  tipo: tipoPlanEnum("tipo").notNull(),
  // Solo para tipo "frecuencia": cuántos horarios semanales elige el alumno.
  frecuenciaSemanal: integer("frecuencia_semanal"),
  // Los planes con historia no se borran: se desactivan.
  activo: boolean("activo").notNull().default(true),
  creadoEn: timestamp("creado_en", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const planesDisciplinas = pgTable(
  "planes_disciplinas",
  {
    planId: integer("plan_id")
      .notNull()
      .references(() => planes.id),
    disciplinaId: integer("disciplina_id")
      .notNull()
      .references(() => disciplinas.id),
  },
  (tabla) => [primaryKey({ columns: [tabla.planId, tabla.disciplinaId] })],
);

// Historial de precios: cada actualización agrega una fila; nunca se pisa.
// El precio vigente es el de vigente_desde más reciente.
export const preciosPlan = pgTable("precios_plan", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id")
    .notNull()
    .references(() => planes.id),
  monto: numeric("monto", { precision: 12, scale: 2 }).notNull(),
  vigenteDesde: timestamp("vigente_desde", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Ficha mínima definitiva (PLAN.md §2).
export const alumnos = pgTable(
  "alumnos",
  {
    id: serial("id").primaryKey(),
    sedeId: integer("sede_id")
      .notNull()
      .references(() => sedes.id),
    dni: text("dni").notNull(),
    nombre: text("nombre").notNull(),
    apellido: text("apellido").notNull(),
    email: text("email"),
    fechaNacimiento: date("fecha_nacimiento"),
    telefono: text("telefono").notNull(),
    creadoEn: timestamp("creado_en", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  // Las sedes operan por separado: el DNI es único dentro de cada sede.
  (tabla) => [uniqueIndex("alumnos_sede_dni_unico").on(tabla.sedeId, tabla.dni)],
);

// "vencida" NO se guarda: se deriva del estado de pago (llega en la Fase 3).
export const estadoSuscripcionEnum = pgEnum("estado_suscripcion", [
  "activa",
  "baja",
]);

export const suscripciones = pgTable("suscripciones", {
  id: serial("id").primaryKey(),
  sedeId: integer("sede_id")
    .notNull()
    .references(() => sedes.id),
  alumnoId: integer("alumno_id")
    .notNull()
    .references(() => alumnos.id),
  planId: integer("plan_id")
    .notNull()
    .references(() => planes.id),
  fechaAlta: date("fecha_alta").notNull(),
  // Precio vigente del plan al momento del alta (informativo; cada pago
  // guardará su monto real en la Fase 3).
  montoAlta: numeric("monto_alta", { precision: 12, scale: 2 }).notNull(),
  // Estructura de descuento preparada (sin UI compleja en v1).
  descuentoPorcentaje: numeric("descuento_porcentaje", {
    precision: 5,
    scale: 2,
  }),
  descuentoNota: text("descuento_nota"),
  estado: estadoSuscripcionEnum("estado").notNull().default("activa"),
  // La baja es siempre explícita, con fecha (y motivo opcional).
  fechaBaja: date("fecha_baja"),
  motivoBaja: text("motivo_baja"),
  creadaEn: timestamp("creada_en", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Horarios elegidos/asignados de la suscripción.
export const suscripcionesHorarios = pgTable(
  "suscripciones_horarios",
  {
    suscripcionId: integer("suscripcion_id")
      .notNull()
      .references(() => suscripciones.id),
    horarioId: integer("horario_id")
      .notNull()
      .references(() => horarios.id),
  },
  (tabla) => [
    primaryKey({ columns: [tabla.suscripcionId, tabla.horarioId] }),
  ],
);

// ---------------------------------------------------------------------------
// Cobros (Fase 3)
// ---------------------------------------------------------------------------

export const medioPagoEnum = pgEnum("medio_pago", [
  "efectivo",
  "transferencia",
]);

// Pago manual registrado por la secretaría. Cada pago habilita hasta `vence`
// (vencimiento rodante, ver src/lib/vencimientos.ts). El monto es el REAL
// cobrado, aunque el precio del plan cambie después. El diseño admite sumar
// otros medios (pasarela online) sin cambiar la estructura.
export const pagos = pgTable("pagos", {
  id: serial("id").primaryKey(),
  sedeId: integer("sede_id")
    .notNull()
    .references(() => sedes.id),
  suscripcionId: integer("suscripcion_id")
    .notNull()
    .references(() => suscripciones.id),
  monto: numeric("monto", { precision: 12, scale: 2 }).notNull(),
  medio: medioPagoEnum("medio").notNull(),
  fechaPago: date("fecha_pago").notNull(),
  // Hasta cuándo queda habilitado el alumno con este pago.
  vence: date("vence").notNull(),
  registradoPorId: integer("registrado_por_id").references(() => usuarios.id),
  creadoEn: timestamp("creado_en", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Parámetros editables sin tocar código (ej.: umbral de "por vencer").
export const configuracion = pgTable("configuracion", {
  clave: text("clave").primaryKey(),
  valor: text("valor").notNull(),
});

// ---------------------------------------------------------------------------
// Gastos (Fase 4) — solo admin
// ---------------------------------------------------------------------------

// Categorías compartidas entre sedes (Alquiler, Sueldos…), configurables.
// Se desactivan, no se borran (los gastos históricos las referencian).
export const categoriasGasto = pgTable(
  "categorias_gasto",
  {
    id: serial("id").primaryKey(),
    nombre: text("nombre").notNull(),
    activa: boolean("activa").notNull().default(true),
  },
  (tabla) => [uniqueIndex("categorias_gasto_nombre_unico").on(tabla.nombre)],
);

export const tipoGastoEnum = pgEnum("tipo_gasto", ["fijo", "variable"]);

export const gastos = pgTable("gastos", {
  id: serial("id").primaryKey(),
  sedeId: integer("sede_id")
    .notNull()
    .references(() => sedes.id),
  tipo: tipoGastoEnum("tipo").notNull(),
  categoriaId: integer("categoria_id")
    .notNull()
    .references(() => categoriasGasto.id),
  monto: numeric("monto", { precision: 12, scale: 2 }).notNull(),
  fecha: date("fecha").notNull(),
  descripcion: text("descripcion"),
  registradoPorId: integer("registrado_por_id").references(() => usuarios.id),
  creadoEn: timestamp("creado_en", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type CategoriaGasto = typeof categoriasGasto.$inferSelect;
export type Gasto = typeof gastos.$inferSelect;

export type Sede = typeof sedes.$inferSelect;
export type Usuario = typeof usuarios.$inferSelect;
export type Disciplina = typeof disciplinas.$inferSelect;
export type Horario = typeof horarios.$inferSelect;
export type Plan = typeof planes.$inferSelect;
export type PrecioPlan = typeof preciosPlan.$inferSelect;
export type Alumno = typeof alumnos.$inferSelect;
export type Suscripcion = typeof suscripciones.$inferSelect;
export type Pago = typeof pagos.$inferSelect;
