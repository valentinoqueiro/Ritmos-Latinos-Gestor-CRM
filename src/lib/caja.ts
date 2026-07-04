import "server-only";
import { and, desc, eq, inArray, isNotNull, isNull, min } from "drizzle-orm";
import { db } from "@/db";
import {
  movimientosCaja,
  pagoEntregas,
  pagos,
  suscripciones,
  turnosCaja,
  type MovimientoCaja,
  type TurnoCaja,
} from "@/db/schema";
import { autorizarSede, type UsuarioSesion } from "./auth/permissions";
import { resumenDeTurno, type ResumenTurno } from "./reglas-caja";

// Consultas de la caja por turnos. El resumen se calcula con las reglas puras
// de src/lib/reglas-caja.ts; acá vive solo el acceso a datos. Las entregas se
// atribuyen al turno por FK (pago_entregas.turnoId), nunca por ventana
// temporal: una entrega sin turno abierto queda explícitamente fuera de turno.

/** Turno abierto de la sede, o null si la caja está cerrada. */
export async function turnoAbierto(sedeId: number): Promise<TurnoCaja | null> {
  const turno = await db.query.turnosCaja.findFirst({
    where: and(eq(turnosCaja.sedeId, sedeId), isNull(turnosCaja.cerradoEn)),
  });
  return turno ?? null;
}

export type DetalleTurno = {
  turno: TurnoCaja;
  resumen: ResumenTurno;
  movimientos: MovimientoCaja[];
};

/**
 * Detalle con resumen de un turno (en vivo si está abierto, final si cerró).
 * Valida el alcance por sede del usuario.
 */
export async function detalleDeTurno(
  usuario: UsuarioSesion,
  turnoId: number,
): Promise<DetalleTurno | null> {
  if (!Number.isInteger(turnoId)) return null;
  const turno = await db.query.turnosCaja.findFirst({
    where: eq(turnosCaja.id, turnoId),
  });
  if (!turno) return null;
  autorizarSede(usuario, turno.sedeId);

  const [entregas, movimientos] = await Promise.all([
    db.select().from(pagoEntregas).where(eq(pagoEntregas.turnoId, turno.id)),
    db
      .select()
      .from(movimientosCaja)
      .where(eq(movimientosCaja.turnoId, turno.id))
      .orderBy(desc(movimientosCaja.creadoEn)),
  ]);

  // Contratos del turno: pagos con alguna entrega acá y registrados durante
  // el turno (una entrega que completa una deuda vieja suma plata pero no
  // cuenta como contrato nuevo/renovado).
  const pagoIds = [...new Set(entregas.map((e) => e.pagoId))];
  let contratos: { esPrimerContratoDelAlumno: boolean }[] = [];
  if (pagoIds.length > 0) {
    const filas = await db
      .select({
        pagoId: pagos.id,
        alumnoId: suscripciones.alumnoId,
        creadoEn: pagos.creadoEn,
      })
      .from(pagos)
      .innerJoin(suscripciones, eq(pagos.suscripcionId, suscripciones.id))
      .where(inArray(pagos.id, pagoIds));
    const hasta = turno.cerradoEn ?? new Date();
    const delTurno = filas.filter(
      (f) => f.creadoEn >= turno.abiertoEn && f.creadoEn <= hasta,
    );

    // "Nuevo" = primer contrato del alumno en la sede (su pago de menor id).
    const alumnoIds = [...new Set(delTurno.map((f) => f.alumnoId))];
    const primeros =
      alumnoIds.length === 0
        ? []
        : await db
            .select({
              alumnoId: suscripciones.alumnoId,
              primerPagoId: min(pagos.id),
            })
            .from(pagos)
            .innerJoin(
              suscripciones,
              eq(pagos.suscripcionId, suscripciones.id),
            )
            .where(inArray(suscripciones.alumnoId, alumnoIds))
            .groupBy(suscripciones.alumnoId);
    const primerPagoDe = new Map(
      primeros.map((p) => [p.alumnoId, p.primerPagoId]),
    );
    contratos = delTurno.map((f) => ({
      esPrimerContratoDelAlumno: primerPagoDe.get(f.alumnoId) === f.pagoId,
    }));
  }

  return {
    turno,
    movimientos,
    resumen: resumenDeTurno({
      efectivoInicial:
        turno.efectivoInicial === null ? null : Number(turno.efectivoInicial),
      contratosDelTurno: contratos,
      entregas: entregas.map((e) => ({ monto: Number(e.monto), medio: e.medio })),
      egresos: movimientos.map((m) => ({ monto: Number(m.monto) })),
    }),
  };
}

export type CierreDeTurno = {
  turno: TurnoCaja;
  totalEfectivo: number;
  totalTransferencia: number;
  egresos: number;
};

/** Cierres pasados de la sede con sus totales, más recientes primero. */
export async function historialDeTurnos(
  usuario: UsuarioSesion,
  sedeId: number,
  limite = 10,
): Promise<CierreDeTurno[]> {
  autorizarSede(usuario, sedeId);
  const cerrados = await db
    .select()
    .from(turnosCaja)
    .where(and(eq(turnosCaja.sedeId, sedeId), isNotNull(turnosCaja.cerradoEn)))
    .orderBy(desc(turnosCaja.abiertoEn))
    .limit(limite);
  if (cerrados.length === 0) return [];
  const ids = cerrados.map((t) => t.id);

  const [entregas, egresos] = await Promise.all([
    db
      .select()
      .from(pagoEntregas)
      .where(inArray(pagoEntregas.turnoId, ids)),
    db
      .select()
      .from(movimientosCaja)
      .where(inArray(movimientosCaja.turnoId, ids)),
  ]);

  return cerrados.map((turno) => {
    const propias = entregas.filter((e) => e.turnoId === turno.id);
    return {
      turno,
      totalEfectivo: propias
        .filter((e) => e.medio === "efectivo")
        .reduce((s, e) => s + Number(e.monto), 0),
      totalTransferencia: propias
        .filter((e) => e.medio === "transferencia")
        .reduce((s, e) => s + Number(e.monto), 0),
      egresos: egresos
        .filter((m) => m.turnoId === turno.id)
        .reduce((s, m) => s + Number(m.monto), 0),
    };
  });
}
