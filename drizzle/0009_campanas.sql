CREATE TABLE "campanas" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "campana_id" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "campanas_nombre_unico" ON "campanas" USING btree ("nombre");--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_campana_id_campanas_id_fk" FOREIGN KEY ("campana_id") REFERENCES "public"."campanas"("id") ON DELETE no action ON UPDATE no action;