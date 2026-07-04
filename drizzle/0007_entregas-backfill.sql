-- Backfill: cada pago existente estaba cobrado completo en un solo medio →
-- una entrega por pago con su monto/medio, fechada el día del pago.
-- Debe correr ANTES de eliminar pagos.medio.
INSERT INTO "pago_entregas" ("pago_id", "sede_id", "monto", "medio", "fecha", "registrado_por_id", "creado_en")
SELECT "id", "sede_id", "monto", "medio", "fecha_pago", "registrado_por_id", "creado_en" FROM "pagos";--> statement-breakpoint
ALTER TABLE "pagos" DROP COLUMN "medio";
