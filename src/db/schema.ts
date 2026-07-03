import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
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

export type Sede = typeof sedes.$inferSelect;
export type Usuario = typeof usuarios.$inferSelect;
