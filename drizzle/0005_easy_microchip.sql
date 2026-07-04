CREATE TABLE "api_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"hash" text NOT NULL,
	"ultimos_caracteres" text NOT NULL,
	"alcances" text[] NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"ultimo_uso" timestamp with time zone,
	"creada_por_id" integer,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_creada_por_id_usuarios_id_fk" FOREIGN KEY ("creada_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_hash_unico" ON "api_keys" USING btree ("hash");