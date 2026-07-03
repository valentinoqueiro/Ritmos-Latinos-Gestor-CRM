CREATE TYPE "public"."estado_suscripcion" AS ENUM('activa', 'baja');--> statement-breakpoint
CREATE TYPE "public"."tipo_plan" AS ENUM('disciplina', 'pack', 'frecuencia');--> statement-breakpoint
CREATE TABLE "alumnos" (
	"id" serial PRIMARY KEY NOT NULL,
	"sede_id" integer NOT NULL,
	"dni" text NOT NULL,
	"nombre" text NOT NULL,
	"apellido" text NOT NULL,
	"email" text,
	"fecha_nacimiento" date,
	"telefono" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disciplinas" (
	"id" serial PRIMARY KEY NOT NULL,
	"sede_id" integer NOT NULL,
	"nombre" text NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "horarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"sede_id" integer NOT NULL,
	"disciplina_id" integer NOT NULL,
	"dia_semana" smallint NOT NULL,
	"hora" time NOT NULL,
	"nota" text,
	"cupo" integer,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planes" (
	"id" serial PRIMARY KEY NOT NULL,
	"sede_id" integer NOT NULL,
	"nombre" text NOT NULL,
	"tipo" "tipo_plan" NOT NULL,
	"frecuencia_semanal" integer,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planes_disciplinas" (
	"plan_id" integer NOT NULL,
	"disciplina_id" integer NOT NULL,
	CONSTRAINT "planes_disciplinas_plan_id_disciplina_id_pk" PRIMARY KEY("plan_id","disciplina_id")
);
--> statement-breakpoint
CREATE TABLE "precios_plan" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_id" integer NOT NULL,
	"monto" numeric(12, 2) NOT NULL,
	"vigente_desde" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suscripciones" (
	"id" serial PRIMARY KEY NOT NULL,
	"sede_id" integer NOT NULL,
	"alumno_id" integer NOT NULL,
	"plan_id" integer NOT NULL,
	"fecha_alta" date NOT NULL,
	"monto_alta" numeric(12, 2) NOT NULL,
	"descuento_porcentaje" numeric(5, 2),
	"descuento_nota" text,
	"estado" "estado_suscripcion" DEFAULT 'activa' NOT NULL,
	"fecha_baja" date,
	"motivo_baja" text,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suscripciones_horarios" (
	"suscripcion_id" integer NOT NULL,
	"horario_id" integer NOT NULL,
	CONSTRAINT "suscripciones_horarios_suscripcion_id_horario_id_pk" PRIMARY KEY("suscripcion_id","horario_id")
);
--> statement-breakpoint
ALTER TABLE "alumnos" ADD CONSTRAINT "alumnos_sede_id_sedes_id_fk" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disciplinas" ADD CONSTRAINT "disciplinas_sede_id_sedes_id_fk" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "horarios" ADD CONSTRAINT "horarios_sede_id_sedes_id_fk" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "horarios" ADD CONSTRAINT "horarios_disciplina_id_disciplinas_id_fk" FOREIGN KEY ("disciplina_id") REFERENCES "public"."disciplinas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planes" ADD CONSTRAINT "planes_sede_id_sedes_id_fk" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planes_disciplinas" ADD CONSTRAINT "planes_disciplinas_plan_id_planes_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."planes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planes_disciplinas" ADD CONSTRAINT "planes_disciplinas_disciplina_id_disciplinas_id_fk" FOREIGN KEY ("disciplina_id") REFERENCES "public"."disciplinas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "precios_plan" ADD CONSTRAINT "precios_plan_plan_id_planes_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."planes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suscripciones" ADD CONSTRAINT "suscripciones_sede_id_sedes_id_fk" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suscripciones" ADD CONSTRAINT "suscripciones_alumno_id_alumnos_id_fk" FOREIGN KEY ("alumno_id") REFERENCES "public"."alumnos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suscripciones" ADD CONSTRAINT "suscripciones_plan_id_planes_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."planes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suscripciones_horarios" ADD CONSTRAINT "suscripciones_horarios_suscripcion_id_suscripciones_id_fk" FOREIGN KEY ("suscripcion_id") REFERENCES "public"."suscripciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suscripciones_horarios" ADD CONSTRAINT "suscripciones_horarios_horario_id_horarios_id_fk" FOREIGN KEY ("horario_id") REFERENCES "public"."horarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "alumnos_sede_dni_unico" ON "alumnos" USING btree ("sede_id","dni");