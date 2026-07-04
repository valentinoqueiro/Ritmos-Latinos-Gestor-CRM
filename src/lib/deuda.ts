// Reglas de deuda sobre contratos (pagos): un contrato tiene un monto
// ACORDADO (pagos.monto) y una o más ENTREGAS (pago_entregas). Si las
// entregas suman menos que lo acordado, el alumno es deudor por el saldo.
// Módulo PURO: trabaja con números; los numeric de la base llegan como string
// y se convierten en los bordes.

// Tolerancia de centavos para comparar montos que pasaron por numeric/string.
const TOLERANCIA = 0.009;

/** Total entregado a partir de filas de entregas (numeric llega como string). */
export function totalEntregado(entregas: { monto: string | number }[]): number {
  return entregas.reduce((suma, e) => suma + Number(e.monto), 0);
}

/** Saldo que falta entregar de un contrato (nunca negativo). */
export function saldoPendiente(
  montoAcordado: number,
  entregado: number,
): number {
  const saldo = montoAcordado - entregado;
  return saldo > TOLERANCIA ? Math.round(saldo * 100) / 100 : 0;
}

export function esDeudor(saldo: number): boolean {
  return saldo > TOLERANCIA;
}

export type Reparto =
  | { ok: true; total: number; saldo: number }
  | { ok: false; error: string };

/**
 * Valida un cobro repartido entre efectivo y transferencia contra un objetivo
 * (el monto acordado al crear el contrato, o el saldo pendiente al completar
 * una deuda). Cobrar de menos es válido (pago parcial → queda saldo);
 * cobrar de más o no cobrar nada, no.
 */
export function validarReparto(
  montoObjetivo: number,
  efectivo: number,
  transferencia: number,
): Reparto {
  if (!Number.isFinite(efectivo) || efectivo < 0) {
    return { ok: false, error: "El efectivo no puede ser negativo" };
  }
  if (!Number.isFinite(transferencia) || transferencia < 0) {
    return { ok: false, error: "La transferencia no puede ser negativa" };
  }
  const total = Math.round((efectivo + transferencia) * 100) / 100;
  if (total <= 0) {
    return { ok: false, error: "Tenés que cobrar algo en al menos un medio" };
  }
  if (total > montoObjetivo + TOLERANCIA) {
    return {
      ok: false,
      error: "Lo cobrado no puede superar el monto a cobrar",
    };
  }
  return { ok: true, total, saldo: saldoPendiente(montoObjetivo, total) };
}
