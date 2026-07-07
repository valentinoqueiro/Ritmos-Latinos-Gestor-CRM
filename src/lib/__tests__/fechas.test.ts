import { describe, expect, it } from "vitest";
import { diaSemanaISO, sumarDias } from "../fechas";

describe("diaSemanaISO (1 = lunes … 7 = domingo, como horarios.diaSemana)", () => {
  it("sábado 4 de julio de 2026 es 6", () => {
    expect(diaSemanaISO("2026-07-04")).toBe(6);
  });

  it("domingo mapea a 7 (no a 0 como getUTCDay)", () => {
    expect(diaSemanaISO("2026-07-05")).toBe(7);
  });

  it("lunes es 1", () => {
    expect(diaSemanaISO("2026-07-06")).toBe(1);
  });
});

describe("sumarDias (navegación por día de Asistencia)", () => {
  it("suma dentro del mismo mes", () => {
    expect(sumarDias("2026-07-06", 1)).toBe("2026-07-07");
  });

  it("resta cruzando de mes", () => {
    expect(sumarDias("2026-07-01", -1)).toBe("2026-06-30");
  });

  it("cruza de año", () => {
    expect(sumarDias("2025-12-31", 1)).toBe("2026-01-01");
  });

  it("respeta el año bisiesto", () => {
    expect(sumarDias("2024-02-28", 1)).toBe("2024-02-29");
  });
});
