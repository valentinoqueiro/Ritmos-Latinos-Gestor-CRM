CREATE TYPE "public"."medio_pago" AS ENUM('efectivo', 'transferencia');--> statement-breakpoint
CREATE TABLE "configuracion" (
	"clave" text PRIMARY KEY NOT NULL,
	"valor" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pagos" (
	"id" serial PRIMARY KEY NOT NULL,
	"sede_id" integer NOT NULL,
	"suscripcion_id" integer NOT NULL,
	"monto" numeric(12, 2) NOT NULL,
	"medio" "medio_pago" NOT NULL,
	"fecha_pago" date NOT NULL,
	"vence" date NOT NULL,
	"registrado_por_id" integer,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_sede_id_sedes_id_fk" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_suscripcion_id_suscripciones_id_fk" FOREIGN KEY ("suscripcion_id") REFERENCES "public"."suscripciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_registrado_por_id_usuarios_id_fk" FOREIGN KEY ("registrado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;