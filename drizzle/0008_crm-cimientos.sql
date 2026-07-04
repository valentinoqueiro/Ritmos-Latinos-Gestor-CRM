CREATE TYPE "public"."canal_contacto" AS ENUM('whatsapp', 'llamada', 'presencial', 'otro');--> statement-breakpoint
CREATE TYPE "public"."tipo_actividad_lead" AS ENUM('nota', 'sistema');--> statement-breakpoint
CREATE TABLE "lead_actividades" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"tipo" "tipo_actividad_lead" NOT NULL,
	"canal" "canal_contacto",
	"detalle" text NOT NULL,
	"registrado_por_id" integer,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_disciplinas" (
	"lead_id" integer NOT NULL,
	"disciplina_id" integer NOT NULL,
	CONSTRAINT "lead_disciplinas_lead_id_disciplina_id_pk" PRIMARY KEY("lead_id","disciplina_id")
);
--> statement-breakpoint
CREATE TABLE "origenes_negocio" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "origen_negocio_id" integer;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "etapa_desde" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "lead_actividades" ADD CONSTRAINT "lead_actividades_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_actividades" ADD CONSTRAINT "lead_actividades_registrado_por_id_usuarios_id_fk" FOREIGN KEY ("registrado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_disciplinas" ADD CONSTRAINT "lead_disciplinas_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_disciplinas" ADD CONSTRAINT "lead_disciplinas_disciplina_id_disciplinas_id_fk" FOREIGN KEY ("disciplina_id") REFERENCES "public"."disciplinas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "origenes_negocio_nombre_unico" ON "origenes_negocio" USING btree ("nombre");--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_origen_negocio_id_origenes_negocio_id_fk" FOREIGN KEY ("origen_negocio_id") REFERENCES "public"."origenes_negocio"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Backfill: los leads existentes entraron a su etapa actual (aprox.) cuando
-- se actualizaron por última vez; el default now() solo vale para los nuevos.
UPDATE "leads" SET "etapa_desde" = "actualizado_en";--> statement-breakpoint
-- Catálogo inicial de orígenes de negocio (configurable por la admin).
INSERT INTO "origenes_negocio" ("nombre") VALUES
	('Meta Ads'), ('Instagram'), ('Mostrador'), ('Web'), ('Referido'), ('Otro')
	ON CONFLICT DO NOTHING;--> statement-breakpoint
-- Los leads históricos cuya fuente coincide con un origen del catálogo se
-- clasifican solos (ej.: fuente "mostrador" → origen Mostrador).
UPDATE "leads" SET "origen_negocio_id" = o."id"
	FROM "origenes_negocio" o
	WHERE lower("leads"."fuente") = lower(o."nombre")
	  AND "leads"."origen_negocio_id" IS NULL;
