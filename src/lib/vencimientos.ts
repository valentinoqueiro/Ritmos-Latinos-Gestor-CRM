// Vencimiento rodante (regla central del negocio, PLAN.md §2) — lógica PURA
// sobre fechas ISO (YYYY-MM-DD), sin base de datos ni zona horaria: el "hoy"
// en hora argentina lo provee el caller (src/lib/fechas.ts).
//
// Regla: cada pago habilita hasta el mismo número de día del mes siguiente,
// con manejo de fin de mes (31/01 → 28/02 o 29/02 en bisiesto).
//
// Pagos anticipados (decisión abierta 2, confirmada por el cliente el
// 2026-07-03): si la suscripción está al día, el nuevo período corre DESDE EL
// VENCIMIENTO VIGENTE (no se pierden días); si está vencida o nunca pagó,
// desde la fecha de pago.

export type EstadoCuota = "al_dia" | "por_vencer" | "vencida";

export const UMBRAL_POR_VENCER_DEFAULT = 5;

function aPartes(iso: string): [number, number, number] {
  const [a, m, d] = iso.split("-").map(Number);
  return [a, m, d];
}

function aISO(anio: number, mes: number, dia: number): string {
  return `${String(anio).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function diasDelMes(anio: number, mes: number): number {
  // Día 0 del mes siguiente = último día de este mes. UTC para evitar DST.
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

/** Mismo día del mes siguiente, con tope en fin de mes (31/01 → 28/02). */
export function sumarUnMes(fechaISO: string): string {
  const [anio, mes, dia] = aPartes(fechaISO);
  const mesSiguiente = mes === 12 ? 1 : mes + 1;
  const anioSiguiente = mes === 12 ? anio + 1 : anio;
  const diaTope = Math.min(dia, diasDelMes(anioSiguiente, mesSiguiente));
  return aISO(anioSiguiente, mesSiguiente, diaTope);
}

/**
 * Vencimiento que habilita un pago nuevo.
 * @param venceVigente vencimiento del último pago de la suscripción (o null si nunca pagó)
 * @param fechaPago fecha en que se registra el pago
 */
export function calcularVencimiento(
  venceVigente: string | null,
  fechaPago: string,
): string {
  const alDia = venceVigente !== null && venceVigente >= fechaPago;
  return sumarUnMes(alDia ? venceVigente : fechaPago);
}

/** Días de diferencia (b - a) entre dos fechas ISO. */
export function diasEntre(a: string, b: string): number {
  const [aa, am, ad] = aPartes(a);
  const [ba, bm, bd] = aPartes(b);
  const msPorDia = 24 * 60 * 60 * 1000;
  return Math.round(
    (Date.UTC(ba, bm - 1, bd) - Date.UTC(aa, am - 1, ad)) / msPorDia,
  );
}

/**
 * Estado de cuota derivado — NUNCA se guarda, siempre se calcula.
 * Sin pagos (vence null) la suscripción está vencida.
 */
export function estadoCuota(
  vence: string | null,
  hoy: string,
  umbralPorVencer: number = UMBRAL_POR_VENCER_DEFAULT,
): EstadoCuota {
  if (vence === null || vence < hoy) return "vencida";
  const diasRestantes = diasEntre(hoy, vence);
  return diasRestantes <= umbralPorVencer ? "por_vencer" : "al_dia";
}

/** Días restantes hasta el vencimiento (negativo si ya venció). */
export function diasParaVencer(vence: string, hoy: string): number {
  return diasEntre(hoy, vence);
}
