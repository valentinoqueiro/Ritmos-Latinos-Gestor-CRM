import { describe, expect, it } from "vitest";
import {
  esEstadoFinal,
  puedeTransicionar,
  tasaDeConversion,
} from "../reglas-leads";

describe("transiciones del pipeline", () => {
  it("flujo feliz: nuevo → contactado → prueba → convertido", () => {
    expect(puedeTransicionar("nuevo", "contactado")).toBe(true);
    expect(puedeTransicionar("contactado", "prueba_agendada")).toBe(true);
    expect(puedeTransicionar("prueba_agendada", "convertido")).toBe(true);
  });

  it("se puede perder desde cualquier estado abierto", () => {
    expect(puedeTransicionar("nuevo", "perdido")).toBe(true);
    expect(puedeTransicionar("contactado", "perdido")).toBe(true);
    expect(puedeTransicionar("prueba_agendada", "perdido")).toBe(true);
  });

  it("no se puede convertir un lead nuevo sin contactarlo", () => {
    expect(puedeTransicionar("nuevo", "convertido")).toBe(false);
  });

  it("los estados finales no se mueven", () => {
    expect(puedeTransicionar("convertido", "perdido")).toBe(false);
    expect(puedeTransicionar("perdido", "contactado")).toBe(false);
    expect(esEstadoFinal("convertido")).toBe(true);
    expect(esEstadoFinal("perdido")).toBe(true);
    expect(esEstadoFinal("contactado")).toBe(false);
  });

  it("no se retrocede en el pipeline", () => {
    expect(puedeTransicionar("prueba_agendada", "contactado")).toBe(false);
    expect(puedeTransicionar("contactado", "nuevo")).toBe(false);
  });
});

describe("tasa de conversión", () => {
  it("convertidos sobre cerrados (los abiertos no cuentan)", () => {
    expect(
      tasaDeConversion({ nuevo: 10, contactado: 5, convertido: 3, perdido: 1 }),
    ).toBe(0.75);
  });

  it("sin desenlaces todavía: null (no 0%)", () => {
    expect(tasaDeConversion({ nuevo: 4 })).toBeNull();
    expect(tasaDeConversion({})).toBeNull();
  });
});
