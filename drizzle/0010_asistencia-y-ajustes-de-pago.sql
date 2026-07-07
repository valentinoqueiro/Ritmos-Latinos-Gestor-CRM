CREATE TABLE "asistencias_clase" (
	"id" serial PRIMARY KEY NOT NULL,
	"sede_id" integer NOT NULL,
	"horario_id" integer NOT NULL,
	"fecha" date NOT NULL,
	"cantidad" integer NOT NULL,
	"registrado_por_id" integer,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pagos" ADD COLUMN "bonificacion" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "pagos" ADD COLUMN "recargo" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "pagos" ADD COLUMN "ajuste_motivo" text;--> statement-breakpoint
ALTER TABLE "asistencias_clase" ADD CONSTRAINT "asistencias_clase_sede_id_sedes_id_fk" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asistencias_clase" ADD CONSTRAINT "asistencias_clase_horario_id_horarios_id_fk" FOREIGN KEY ("horario_id") REFERENCES "public"."horarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asistencias_clase" ADD CONSTRAINT "asistencias_clase_registrado_por_id_usuarios_id_fk" FOREIGN KEY ("registrado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "asistencias_horario_fecha_unico" ON "asistencias_clase" USING btree ("horario_id","fecha");