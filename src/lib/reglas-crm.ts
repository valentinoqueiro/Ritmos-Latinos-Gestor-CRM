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

// --- Métricas del CRM (fase R5) ---------------------------------------------

export type LeadParaMetricas = {
  estado: EstadoLead;
  // Nombre del origen de negocio ya resuelto (null = sin clasificar).
  origen: string | null;
  // Nombre de la campaña de captación ya resuelto (null = orgánico).
  campana: string | null;
  disciplinas: { nombre: string; sedeId: number }[];
};

export type FilaMetrica = {
  clave: string;
  total: number;
  convertidos: number;
  perdidos: number;
  // convertidos / (convertidos + perdidos); null sin desenlaces.
  tasa: number | null;
};

export type MetricasCrm = {
  porEtapa: Record<EstadoLead, number>;
  tasaGlobal: number | null;
  // Un lead con 2 disciplinas cuenta en AMBAS (criterio explícito del plan);
  // ídem por sede. Por eso las filas no suman el total de leads.
  porDisciplina: FilaMetrica[];
  porSede: (FilaMetrica & { sedeId: number })[];
  porOrigen: FilaMetrica[];
  // Por campaña de anuncios: la comparación que decide dónde invertir.
  // «Orgánico» agrupa a los leads sin campaña (visible, misma filosofía que
  // «Sin clasificar» en origen).
  porCampana: FilaMetrica[];
  // Sin disciplina = sin sede: fuera de las métricas por disciplina/sede,
  // pero SIEMPRE visible para que la admin los clasifique (decisión cliente).
  sinDisciplina: number;
};

function tasaDe(convertidos: number, perdidos: number): number | null {
  const cerrados = convertidos + perdidos;
  return cerrados === 0 ? null : convertidos / cerrados;
}

export function metricasDeLeads(lista: LeadParaMetricas[]): MetricasCrm {
  const porEtapa: Record<EstadoLead, number> = {
    nuevo: 0,
    contactado: 0,
    prueba_agendada: 0,
    convertido: 0,
    perdido: 0,
  };
  const disciplina = new Map<string, { c: number; p: number; t: number }>();
  const sede = new Map<number, { c: number; p: number; t: number }>();
  const origen = new Map<string, { c: number; p: number; t: number }>();
  const campana = new Map<string, { c: number; p: number; t: number }>();
  let sinDisciplina = 0;

  const acumular = <K,>(
    mapa: Map<K, { c: number; p: number; t: number }>,
    clave: K,
    estado: EstadoLead,
  ) => {
    const fila = mapa.get(clave) ?? { c: 0, p: 0, t: 0 };
    fila.t += 1;
    if (estado === "convertido") fila.c += 1;
    if (estado === "perdido") fila.p += 1;
    mapa.set(clave, fila);
  };

  for (const lead of lista) {
    porEtapa[lead.estado] += 1;
    acumular(origen, lead.origen ?? "Sin clasificar", lead.estado);
    acumular(campana, lead.campana ?? "Orgánico", lead.estado);
    if (lead.disciplinas.length === 0) {
      sinDisciplina += 1;
      continue;
    }
    for (const d of lead.disciplinas) acumular(disciplina, d.nombre, lead.estado);
    for (const sedeId of sedesDeInteres(lead.disciplinas)) {
      acumular(sede, sedeId, lead.estado);
    }
  }

  const aFila = ([clave, f]: [string, { c: number; p: number; t: number }]) => ({
    clave,
    total: f.t,
    convertidos: f.c,
    perdidos: f.p,
    tasa: tasaDe(f.c, f.p),
  });
  const porTotal = (a: FilaMetrica, b: FilaMetrica) =>
    b.total - a.total || a.clave.localeCompare(b.clave);

  return {
    porEtapa,
    tasaGlobal: tasaDe(porEtapa.convertido, porEtapa.perdido),
    porDisciplina: [...disciplina.entries()].map(aFila).sort(porTotal),
    porSede: [...sede.entries()]
      .map(([sedeId, f]) => ({ ...aFila([String(sedeId), f]), sedeId }))
      .sort(porTotal),
    porOrigen: [...origen.entries()].map(aFila).sort(porTotal),
    porCampana: [...campana.entries()].map(aFila).sort(porTotal),
    sinDisciplina,
  };
}
