import { sql } from "drizzle-orm";
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

// Contrato de cuota registrado por la secretaría ("contrato" en la jerga de
// la academia). Cada pago habilita hasta `vence` (vencimiento rodante, ver
// src/lib/vencimientos.ts). El dinero REAL recibido vive en pago_entregas:
// un contrato puede cobrarse en varias entregas (parciales) y con distintos
// medios (mixto efectivo + transferencia).
export const pagos = pgTable("pagos", {
  id: serial("id").primaryKey(),
  sedeId: integer("sede_id")
    .notNull()
    .references(() => sedes.id),
  suscripcionId: integer("suscripcion_id")
    .notNull()
    .references(() => suscripciones.id),
  // Monto ACORDADO de la cuota, YA con bonificación/recargo aplicados; si las
  // entregas suman menos, hay deuda. El desglose del ajuste queda al lado.
  monto: numeric("monto", { precision: 12, scale: 2 }).notNull(),
  // Ajustes sobre el precio base de la cuota (solo registro/desglose): la
  // bonificación descuenta y el recargo suma; monto = base − bonif + recargo.
  // Así un pago bonificado queda COMPLETO, no parcial.
  bonificacion: numeric("bonificacion", { precision: 12, scale: 2 }),
  recargo: numeric("recargo", { precision: 12, scale: 2 }),
  ajusteMotivo: text("ajuste_motivo"),
  // Fecha de inicio del contrato: el vencimiento se calcula desde acá.
  // Puede retro-datarse si el alumno empezó antes de registrar el pago.
  fechaPago: date("fecha_pago").notNull(),
  // Hasta cuándo queda habilitado el alumno con este pago.
  vence: date("vence").notNull(),
  // Motivo de una corrección admin (editar vencimiento), si la hubo.
  nota: text("nota"),
  registradoPorId: integer("registrado_por_id").references(() => usuarios.id),
  creadoEn: timestamp("creado_en", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// Caja por turnos (Fase 8)
// ---------------------------------------------------------------------------

// Turno de caja de una sede: la secretaria lo abre al llegar y lo cierra al
// irse (apertura/cierre libre, sin franjas fijas). El resumen del turno
// (renovados, nuevos, efectivo, transferencia, egresos) se deriva de las
// entregas y movimientos vinculados por FK, nunca se guarda.
export const turnosCaja = pgTable(
  "turnos_caja",
  {
    id: serial("id").primaryKey(),
    sedeId: integer("sede_id")
      .notNull()
      .references(() => sedes.id),
    abiertoPorId: integer("abierto_por_id").references(() => usuarios.id),
    abiertoEn: timestamp("abierto_en", { withTimezone: true })
      .notNull()
      .defaultNow(),
    cerradoPorId: integer("cerrado_por_id").references(() => usuarios.id),
    // null = turno abierto.
    cerradoEn: timestamp("cerrado_en", { withTimezone: true }),
    // Efectivo declarado al abrir; null se trata como 0.
    efectivoInicial: numeric("efectivo_inicial", { precision: 12, scale: 2 }),
    notaCierre: text("nota_cierre"),
  },
  // A lo sumo UN turno abierto por sede (protege carreras de doble apertura).
  (tabla) => [
    uniqueIndex("turnos_caja_abierto_unico")
      .on(tabla.sedeId)
      .where(sql`cerrado_en IS NULL`),
  ],
);

// Egreso en efectivo durante el turno (retiros, compras chicas del mostrador).
// Los gastos contables del admin viven aparte en `gastos`.
export const movimientosCaja = pgTable("movimientos_caja", {
  id: serial("id").primaryKey(),
  turnoId: integer("turno_id")
    .notNull()
    .references(() => turnosCaja.id),
  monto: numeric("monto", { precision: 12, scale: 2 }).notNull(),
  concepto: text("concepto").notNull(),
  registradoPorId: integer("registrado_por_id").references(() => usuarios.id),
  creadoEn: timestamp("creado_en", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Entrega de dinero sobre un contrato (pago). El pago mixto son dos entregas
// (una por medio); el pago parcial es una entrega menor al acordado; completar
// la deuda agrega otra entrega al mismo contrato.
export const pagoEntregas = pgTable("pago_entregas", {
  id: serial("id").primaryKey(),
  pagoId: integer("pago_id")
    .notNull()
    .references(() => pagos.id, { onDelete: "cascade" }),
  // Denormalizada de pagos: caja e ingresos suman por sede sin join.
  sedeId: integer("sede_id")
    .notNull()
    .references(() => sedes.id),
  monto: numeric("monto", { precision: 12, scale: 2 }).notNull(),
  medio: medioPagoEnum("medio").notNull(),
  // Cuándo entró la plata (la fecha del contrato es pagos.fechaPago).
  fecha: date("fecha").notNull(),
  // Turno de caja en que se recibió; null = entrega fuera de turno.
  turnoId: integer("turno_id").references(() => turnosCaja.id),
  registradoPorId: integer("registrado_por_id").references(() => usuarios.id),
  creadoEn: timestamp("creado_en", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// Asistencia por clase
// ---------------------------------------------------------------------------

// Cantidad de alumnos que hubo en una clase puntual (horario + fecha). Es un
// conteo simple para tener registro de concurrencia, no un presentismo por
// alumno. Una fila por clase dictada; corregir el número pisa la misma fila.
export const asistenciasClase = pgTable(
  "asistencias_clase",
  {
    id: serial("id").primaryKey(),
    sedeId: integer("sede_id")
      .notNull()
      .references(() => sedes.id),
    horarioId: integer("horario_id")
      .notNull()
      .references(() => horarios.id),
    fecha: date("fecha").notNull(),
    cantidad: integer("cantidad").notNull(),
    registradoPorId: integer("registrado_por_id").references(() => usuarios.id),
    creadoEn: timestamp("creado_en", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (tabla) => [
    uniqueIndex("asistencias_horario_fecha_unico").on(
      tabla.horarioId,
      tabla.fecha,
    ),
  ],
);

export type AsistenciaClase = typeof asistenciasClase.$inferSelect;

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

// ---------------------------------------------------------------------------
// CRM de leads (Fase 6) — solo admin, cross-sede
// ---------------------------------------------------------------------------

// Pipeline (PLAN.md): nuevo → contactado → prueba agendada → convertido / perdido.
// Transiciones válidas en src/lib/reglas-leads.ts.
export const estadoLeadEnum = pgEnum("estado_lead", [
  "nuevo",
  "contactado",
  "prueba_agendada",
  "convertido",
  "perdido",
]);

// Origen TÉCNICO: cómo entró el lead al sistema (una persona o la API).
// El origen de NEGOCIO (Meta Ads, mostrador, referido…) es otra dimensión,
// configurable, en la tabla origenes_negocio (rediseño CRM, fase R1).
export const origenLeadEnum = pgEnum("origen_lead", ["manual", "api"]);

// Catálogo configurable de orígenes de negocio de un lead (de dónde vino el
// interesado). Se desactivan, no se borran (los leads históricos los referencian).
export const origenesNegocio = pgTable(
  "origenes_negocio",
  {
    id: serial("id").primaryKey(),
    nombre: text("nombre").notNull(),
    activo: boolean("activo").notNull().default(true),
  },
  (tabla) => [uniqueIndex("origenes_negocio_nombre_unico").on(tabla.nombre)],
);

// Campañas de captación (ej. anuncios de Meta Lead Ads: "Pole julio",
// "Promo salsa"). NO se administran a mano: la ingesta de la API v1 hace
// find-or-create por nombre (case-insensitive), porque las campañas nacen en
// la plataforma de anuncios y llegan con cada lead. Ortogonal al origen de
// negocio: el origen dice el canal ("Meta Ads"); la campaña, cuál anuncio.
export const campanas = pgTable(
  "campanas",
  {
    id: serial("id").primaryKey(),
    nombre: text("nombre").notNull(),
    creadoEn: timestamp("creado_en", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (tabla) => [uniqueIndex("campanas_nombre_unico").on(tabla.nombre)],
);

export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  nombre: text("nombre").notNull(),
  telefono: text("telefono").notNull(),
  email: text("email"),
  // OBSOLETO (rediseño CRM): la sede se deriva de las disciplinas de interés
  // (lead_disciplinas). Se conserva como dato histórico y por compatibilidad
  // de la API v1; las pantallas nuevas no lo piden.
  sedeInteresId: integer("sede_interes_id").references(() => sedes.id),
  origen: origenLeadEnum("origen").notNull().default("manual"),
  fuente: text("fuente"),
  // De dónde vino el interesado (catálogo configurable); null = sin clasificar.
  origenNegocioId: integer("origen_negocio_id").references(
    () => origenesNegocio.id,
  ),
  // Campaña de captación (llega con el lead por la API v1); null = orgánico
  // o anterior a las campañas.
  campanaId: integer("campana_id").references(() => campanas.id),
  nota: text("nota"),
  estado: estadoLeadEnum("estado").notNull().default("nuevo"),
  // Cuándo entró a la etapa actual: alimenta el "hace cuánto está acá" del
  // kanban y la alerta de lead frío. Se actualiza en cada transición.
  etapaDesde: timestamp("etapa_desde", { withTimezone: true })
    .notNull()
    .defaultNow(),
  // Clase de prueba: fecha + horario existente, sin sobre-ingeniería.
  pruebaFecha: date("prueba_fecha"),
  pruebaHorarioId: integer("prueba_horario_id").references(() => horarios.id),
  motivoPerdida: text("motivo_perdida"),
  // Al convertir queda el vínculo con el alumno creado.
  alumnoId: integer("alumno_id").references(() => alumnos.id),
  creadoEn: timestamp("creado_en", { withTimezone: true })
    .notNull()
    .defaultNow(),
  actualizadoEn: timestamp("actualizado_en", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Disciplinas de interés del lead (multi). Como cada disciplina pertenece a
// exactamente una sede, la(s) sede(s) del lead se DERIVAN de acá: el lead
// nunca elige sede. Sin disciplinas = sin sede = fuera de las métricas por
// disciplina/sede (con contador visible para que la admin lo clasifique).
export const leadDisciplinas = pgTable(
  "lead_disciplinas",
  {
    leadId: integer("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    disciplinaId: integer("disciplina_id")
      .notNull()
      .references(() => disciplinas.id),
  },
  (tabla) => [primaryKey({ columns: [tabla.leadId, tabla.disciplinaId] })],
);

export const tipoActividadLeadEnum = pgEnum("tipo_actividad_lead", [
  "nota", // nota manual de seguimiento (con canal de contacto)
  "sistema", // evento automático: cambio de etapa, prueba, conversión, pérdida
]);

export const canalContactoEnum = pgEnum("canal_contacto", [
  "whatsapp",
  "llamada",
  "presencial",
  "otro",
]);

// Historial de actividad del lead: qué pasó, cuándo y por qué canal. Las
// acciones del pipeline registran eventos "sistema"; la admin agrega "nota".
export const leadActividades = pgTable("lead_actividades", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  tipo: tipoActividadLeadEnum("tipo").notNull(),
  // Solo para notas manuales: por dónde se contactó.
  canal: canalContactoEnum("canal"),
  detalle: text("detalle").notNull(),
  registradoPorId: integer("registrado_por_id").references(() => usuarios.id),
  creadoEn: timestamp("creado_en", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Lead = typeof leads.$inferSelect;
export type OrigenNegocio = typeof origenesNegocio.$inferSelect;
export type Campana = typeof campanas.$inferSelect;
export type LeadActividad = typeof leadActividades.$inferSelect;

// ---------------------------------------------------------------------------
// API pública v1 (Fase 7) — API keys para integraciones externas
// ---------------------------------------------------------------------------

// Alcances posibles de una API key (ver src/lib/auth/api-keys.ts). Se guardan
// como array de texto: agregar un alcance nuevo no requiere migración de enum.
export const apiKeys = pgTable(
  "api_keys",
  {
    id: serial("id").primaryKey(),
    nombre: text("nombre").notNull(),
    // Hash SHA-256 (hex) de la clave completa. Nunca se guarda la clave en
    // claro: se muestra una sola vez al crearla (ver acciones.ts).
    hash: text("hash").notNull(),
    // Últimos 4 caracteres en claro, solo para que el admin la reconozca en
    // la UI sin poder reconstruir la clave completa.
    ultimosCaracteres: text("ultimos_caracteres").notNull(),
    alcances: text("alcances").array().notNull(),
    activa: boolean("activa").notNull().default(true),
    ultimoUso: timestamp("ultimo_uso", { withTimezone: true }),
    creadaPorId: integer("creada_por_id").references(() => usuarios.id),
    creadaEn: timestamp("creada_en", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (tabla) => [uniqueIndex("api_keys_hash_unico").on(tabla.hash)],
);

export type ApiKey = typeof apiKeys.$inferSelect;

export type Sede = typeof sedes.$inferSelect;
export type Usuario = typeof usuarios.$inferSelect;
export type Disciplina = typeof disciplinas.$inferSelect;
export type Horario = typeof horarios.$inferSelect;
export type Plan = typeof planes.$inferSelect;
export type PrecioPlan = typeof preciosPlan.$inferSelect;
export type Alumno = typeof alumnos.$inferSelect;
export type Suscripcion = typeof suscripciones.$inferSelect;
export type Pago = typeof pagos.$inferSelect;
export type PagoEntrega = typeof pagoEntregas.$inferSelect;
export type TurnoCaja = typeof turnosCaja.$inferSelect;
export type MovimientoCaja = typeof movimientosCaja.$inferSelect;
