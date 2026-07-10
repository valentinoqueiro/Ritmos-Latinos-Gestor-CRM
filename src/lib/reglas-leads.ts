// Reglas puras del pipeline de leads (PLAN.md §2):
// nuevo → contactado → prueba agendada → convertido / perdido.

export type EstadoLead =
  | "nuevo"
  | "contactado"
  | "prueba_agendada"
  | "convertido"
  | "perdido";

export const ETIQUETA_ESTADO_LEAD: Record<EstadoLead, string> = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  prueba_agendada: "Prueba agendada",
  convertido: "Convertido",
  perdido: "Perdido",
};

// Desde cada estado, a dónde se puede mover. Entre etapas ABIERTAS se puede
// ir y volver libremente (decisión del cliente 2026-07-04 para el kanban:
// corregir un arrastre errado o retroceder una prueba que se cayó). "Perdido"
// es posible desde cualquier estado abierto; convertir requiere haberlo
// contactado al menos. Un lead perdido se puede REABRIR a cualquier etapa
// abierta (decisión del cliente 2026-07-10: a veces vuelven); al reabrirse
// pierde el motivo de pérdida (queda en el historial). "Convertido" sí es
// final: ya es alumno.
const TRANSICIONES: Record<EstadoLead, ReadonlySet<EstadoLead>> = {
  nuevo: new Set(["contactado", "prueba_agendada", "perdido"]),
  contactado: new Set(["nuevo", "prueba_agendada", "convertido", "perdido"]),
  prueba_agendada: new Set(["nuevo", "contactado", "convertido", "perdido"]),
  convertido: new Set(),
  perdido: new Set(["nuevo", "contactado", "prueba_agendada"]),
};

export function puedeTransicionar(de: EstadoLead, a: EstadoLead): boolean {
  return TRANSICIONES[de].has(a);
}

/**
 * Desenlaces del pipeline (columnas "cerradas" del kanban). Ojo: perdido es
 * un desenlace pero desde 2026-07-10 se puede REABRIR (ver TRANSICIONES).
 */
export function esEstadoFinal(estado: EstadoLead): boolean {
  return estado === "convertido" || estado === "perdido";
}

/**
 * Tasa de conversión: convertidos sobre leads con desenlace
 * (convertidos + perdidos). Los que siguen en el pipeline no cuentan.
 * Devuelve null si todavía no hay desenlaces.
 */
export function tasaDeConversion(
  porEstado: Partial<Record<EstadoLead, number>>,
): number | null {
  const convertidos = porEstado.convertido ?? 0;
  const perdidos = porEstado.perdido ?? 0;
  const cerrados = convertidos + perdidos;
  if (cerrados === 0) return null;
  return convertidos / cerrados;
}
