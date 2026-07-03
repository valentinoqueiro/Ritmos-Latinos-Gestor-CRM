CREATE TYPE "public"."estado_lead" AS ENUM('nuevo', 'contactado', 'prueba_agendada', 'convertido', 'perdido');--> statement-breakpoint
CREATE TYPE "public"."origen_lead" AS ENUM('manual', 'api');--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"telefono" text NOT NULL,
	"sede_interes_id" integer,
	"origen" "origen_lead" DEFAULT 'manual' NOT NULL,
	"fuente" text,
	"nota" text,
	"estado" "estado_lead" DEFAULT 'nuevo' NOT NULL,
	"prueba_fecha" date,
	"prueba_horario_id" integer,
	"motivo_perdida" text,
	"alumno_id" integer,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_sede_interes_id_sedes_id_fk" FOREIGN KEY ("sede_interes_id") REFERENCES "public"."sedes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_prueba_horario_id_horarios_id_fk" FOREIGN KEY ("prueba_horario_id") REFERENCES "public"."horarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_alumno_id_alumnos_id_fk" FOREIGN KEY ("alumno_id") REFERENCES "public"."alumnos"("id") ON DELETE no action ON UPDATE no action;