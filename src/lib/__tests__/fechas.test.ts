import { describe, expect, it } from "vitest";
import { diaSemanaISO } from "../fechas";

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
