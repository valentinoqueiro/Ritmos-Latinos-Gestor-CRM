// Reglas puras de suscripción (sin base de datos): qué horarios corresponden
// a cada tipo de plan y cómo se validan cupos. Testeadas en __tests__.

export type PlanParaSuscribir = {
  tipo: "disciplina" | "pack" | "frecuencia";
  frecuenciaSemanal: number | null;
};

export type HorarioDisponible = {
  id: number;
  cupo: number | null;
  inscriptos: number;
};

export type ResultadoValidacion =
  | { ok: true; horarioIds: number[] }
  | { ok: false; error: string };

/**
 * Resuelve los horarios de una suscripción nueva.
 *
 * - Plan "frecuencia": el alumno elige exactamente `frecuenciaSemanal` horarios
 *   de los disponibles de la disciplina del plan.
 * - Plan "disciplina" / "pack": el horario es implícito — se asigna a TODOS los
 *   horarios activos de la(s) disciplina(s); no hay elección.
 *
 * En ambos casos se rechaza cualquier horario con el cupo completo.
 */
export function resolverHorariosDeSuscripcion(
  plan: PlanParaSuscribir,
  disponibles: HorarioDisponible[],
  elegidosIds: number[],
): ResultadoValidacion {
  if (plan.tipo === "frecuencia") {
    const frecuencia = plan.frecuenciaSemanal ?? 0;
    if (frecuencia < 1) {
      return { ok: false, error: "El plan no tiene una frecuencia válida" };
    }
    const unicos = [...new Set(elegidosIds)];
    if (unicos.length !== frecuencia) {
      return {
        ok: false,
        error: `Este plan requiere elegir exactamente ${frecuencia} ${
          frecuencia === 1 ? "horario" : "horarios"
        }`,
      };
    }
    const porId = new Map(disponibles.map((h) => [h.id, h]));
    for (const id of unicos) {
      const horario = porId.get(id);
      if (!horario) {
        return {
          ok: false,
          error: "Elegiste un horario que no corresponde a este plan",
        };
      }
      if (estaLleno(horario)) {
        return { ok: false, error: "Uno de los horarios elegidos está completo" };
      }
    }
    return { ok: true, horarioIds: unicos };
  }

  // disciplina / pack: todos los horarios activos, sin elección.
  const llenos = disponibles.filter(estaLleno);
  if (llenos.length > 0) {
    return {
      ok: false,
      error:
        "Una de las clases de este plan está completa; revisá los cupos antes de suscribir",
    };
  }
  return { ok: true, horarioIds: disponibles.map((h) => h.id) };
}

export function estaLleno(horario: {
  cupo: number | null;
  inscriptos: number;
}): boolean {
  return horario.cupo !== null && horario.inscriptos >= horario.cupo;
}

export function lugaresLibres(horario: {
  cupo: number | null;
  inscriptos: number;
}): number | null {
  if (horario.cupo === null) return null;
  return Math.max(0, horario.cupo - horario.inscriptos);
}
