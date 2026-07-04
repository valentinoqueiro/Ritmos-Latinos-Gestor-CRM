CREATE TABLE "movimientos_caja" (
	"id" serial PRIMARY KEY NOT NULL,
	"turno_id" integer NOT NULL,
	"monto" numeric(12, 2) NOT NULL,
	"concepto" text NOT NULL,
	"registrado_por_id" integer,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pago_entregas" (
	"id" serial PRIMARY KEY NOT NULL,
	"pago_id" integer NOT NULL,
	"sede_id" integer NOT NULL,
	"monto" numeric(12, 2) NOT NULL,
	"medio" "medio_pago" NOT NULL,
	"fecha" date NOT NULL,
	"turno_id" integer,
	"registrado_por_id" integer,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "turnos_caja" (
	"id" serial PRIMARY KEY NOT NULL,
	"sede_id" integer NOT NULL,
	"abierto_por_id" integer,
	"abierto_en" timestamp with time zone DEFAULT now() NOT NULL,
	"cerrado_por_id" integer,
	"cerrado_en" timestamp with time zone,
	"efectivo_inicial" numeric(12, 2),
	"nota_cierre" text
);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "pagos" ADD COLUMN "nota" text;--> statement-breakpoint
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_turno_id_turnos_caja_id_fk" FOREIGN KEY ("turno_id") REFERENCES "public"."turnos_caja"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_registrado_por_id_usuarios_id_fk" FOREIGN KEY ("registrado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pago_entregas" ADD CONSTRAINT "pago_entregas_pago_id_pagos_id_fk" FOREIGN KEY ("pago_id") REFERENCES "public"."pagos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pago_entregas" ADD CONSTRAINT "pago_entregas_sede_id_sedes_id_fk" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pago_entregas" ADD CONSTRAINT "pago_entregas_turno_id_turnos_caja_id_fk" FOREIGN KEY ("turno_id") REFERENCES "public"."turnos_caja"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pago_entregas" ADD CONSTRAINT "pago_entregas_registrado_por_id_usuarios_id_fk" FOREIGN KEY ("registrado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turnos_caja" ADD CONSTRAINT "turnos_caja_sede_id_sedes_id_fk" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turnos_caja" ADD CONSTRAINT "turnos_caja_abierto_por_id_usuarios_id_fk" FOREIGN KEY ("abierto_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turnos_caja" ADD CONSTRAINT "turnos_caja_cerrado_por_id_usuarios_id_fk" FOREIGN KEY ("cerrado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "turnos_caja_abierto_unico" ON "turnos_caja" USING btree ("sede_id") WHERE cerrado_en IS NULL;