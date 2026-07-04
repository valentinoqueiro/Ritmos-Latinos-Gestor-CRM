// Reglas puras del rediseño del CRM (fase R1): derivación de sede desde las
// disciplinas de interés y detección de leads fríos. Sin dependencias de
// Next ni de la base; las pantallas y acciones las consumen.

import { esEstadoFinal, type EstadoLead } from "./reglas-leads";

export const CLAVE_UMBRAL_LEAD_FRIO = "umbral_lead_frio_dias";
// Días sin cambiar de etapa a partir de los cuales un lead abierto se marca
// frío (decisión del cliente 2026-07-04; configurable desde Configuración).
export const UMBRAL_LEAD_FRIO_DEFAULT = 3;

/**
 * Sedes de interés de un lead, DERIVADAS de sus disciplinas (cada disciplina
 * pertenece a exactamente una sede). Sin disciplinas = sin sede: el lead
 * queda fuera de las métricas por sede/disciplina pero visible con contador.
 */
export function sedesDeInteres(
  disciplinas: { sedeId: number }[],
): number[] {
  return [...new Set(disciplinas.map((d) => d.sedeId))].sort((a, b) => a - b);
}

/** Días completos que el lead lleva en su etapa actual. */
export function diasEnEtapa(etapaDesde: Date, ahora: Date): number {
  const ms = ahora.getTime() - etapaDesde.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/**
 * Un lead está frío cuando lleva más días que el umbral sin cambiar de etapa
 * y todavía está abierto (los convertidos/perdidos ya tuvieron desenlace).
 */
export function esLeadFrio(
  estado: EstadoLead,
  etapaDesde: Date,
  ahora: Date,
  umbralDias: number,
): boolean {
  if (esEstadoFinal(estado)) return false;
  return diasEnEtapa(etapaDesde, ahora) > umbralDias;
}
