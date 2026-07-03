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

// Desde cada estado, a dónde se puede avanzar. "Perdido" es posible desde
// cualquier estado abierto (un lead se puede perder en cualquier momento);
// convertir requiere haberlo contactado al menos. Los estados finales
// (convertido / perdido) no se mueven más.
const TRANSICIONES: Record<EstadoLead, ReadonlySet<EstadoLead>> = {
  nuevo: new Set(["contactado", "prueba_agendada", "perdido"]),
  contactado: new Set(["prueba_agendada", "convertido", "perdido"]),
  prueba_agendada: new Set(["convertido", "perdido"]),
  convertido: new Set(),
  perdido: new Set(),
};

export function puedeTransicionar(de: EstadoLead, a: EstadoLead): boolean {
  return TRANSICIONES[de].has(a);
}

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
