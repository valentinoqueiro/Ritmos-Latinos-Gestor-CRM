import { describe, expect, it } from "vitest";
import {
  estaLleno,
  lugaresLibres,
  resolverHorariosDeSuscripcion,
} from "../reglas-suscripcion";

const horario = (id: number, cupo: number | null, inscriptos = 0) => ({
  id,
  cupo,
  inscriptos,
});

describe("plan por frecuencia: elección de horarios", () => {
  const plan = { tipo: "frecuencia" as const, frecuenciaSemanal: 2 };
  const disponibles = [
    horario(1, 8, 3),
    horario(2, 8, 8), // completo
    horario(3, null, 20),
    horario(4, 8, 7),
  ];

  it("acepta exactamente la cantidad de la frecuencia", () => {
    const r = resolverHorariosDeSuscripcion(plan, disponibles, [1, 3]);
    expect(r).toEqual({ ok: true, horarioIds: [1, 3] });
  });

  it("rechaza elegir menos horarios que la frecuencia", () => {
    const r = resolverHorariosDeSuscripcion(plan, disponibles, [1]);
    expect(r.ok).toBe(false);
  });

  it("rechaza elegir más horarios que la frecuencia", () => {
    const r = resolverHorariosDeSuscripcion(plan, disponibles, [1, 3, 4]);
    expect(r.ok).toBe(false);
  });

  it("rechaza horarios duplicados (no se puede contar dos veces la misma clase)", () => {
    const r = resolverHorariosDeSuscripcion(plan, disponibles, [1, 1]);
    expect(r.ok).toBe(false);
  });

  it("rechaza un horario que no pertenece al plan", () => {
    const r = resolverHorariosDeSuscripcion(plan, disponibles, [1, 99]);
    expect(r.ok).toBe(false);
  });

  it("rechaza un horario con el cupo completo", () => {
    const r = resolverHorariosDeSuscripcion(plan, disponibles, [1, 2]);
    expect(r.ok).toBe(false);
  });

  it("un horario sin cupo definido nunca se considera lleno", () => {
    const r = resolverHorariosDeSuscripcion(plan, disponibles, [3, 4]);
    expect(r.ok).toBe(true);
  });

  it("rechaza un plan por frecuencia sin frecuencia cargada", () => {
    const r = resolverHorariosDeSuscripcion(
      { tipo: "frecuencia", frecuenciaSemanal: null },
      disponibles,
      [1, 3],
    );
    expect(r.ok).toBe(false);
  });
});

describe("plan disciplina/pack: horarios implícitos", () => {
  it("asigna todos los horarios activos sin elección", () => {
    const r = resolverHorariosDeSuscripcion(
      { tipo: "disciplina", frecuenciaSemanal: null },
      [horario(1, null, 5), horario(2, null, 5)],
      [], // lo que elija el cliente se ignora
    );
    expect(r).toEqual({ ok: true, horarioIds: [1, 2] });
  });

  it("rechaza la suscripción si alguna clase del plan está completa", () => {
    const r = resolverHorariosDeSuscripcion(
      { tipo: "pack", frecuenciaSemanal: null },
      [horario(1, null, 5), horario(2, 10, 10)],
      [],
    );
    expect(r.ok).toBe(false);
  });
});

describe("cupos", () => {
  it("estaLleno solo aplica cuando hay cupo definido", () => {
    expect(estaLleno(horario(1, null, 999))).toBe(false);
    expect(estaLleno(horario(1, 8, 8))).toBe(true);
    expect(estaLleno(horario(1, 8, 7))).toBe(false);
  });

  it("lugaresLibres nunca es negativo", () => {
    expect(lugaresLibres(horario(1, 8, 10))).toBe(0);
    expect(lugaresLibres(horario(1, 8, 5))).toBe(3);
    expect(lugaresLibres(horario(1, null, 5))).toBeNull();
  });
});
