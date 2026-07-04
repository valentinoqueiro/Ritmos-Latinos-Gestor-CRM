import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { turnosCaja, type TurnoCaja } from "@/db/schema";

// Consultas de la caja por turnos. El resumen se calcula con las reglas puras
// de src/lib/reglas-caja.ts; acá vive solo el acceso a datos.

/** Turno abierto de la sede, o null si la caja está cerrada. */
export async function turnoAbierto(sedeId: number): Promise<TurnoCaja | null> {
  const turno = await db.query.turnosCaja.findFirst({
    where: and(eq(turnosCaja.sedeId, sedeId), isNull(turnosCaja.cerradoEn)),
  });
  return turno ?? null;
}
