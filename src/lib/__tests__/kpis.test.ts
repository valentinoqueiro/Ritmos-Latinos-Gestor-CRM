import { describe, expect, it } from "vitest";
import { ultimosMeses } from "../fechas";

describe("ultimosMeses (claves de la serie de evolución)", () => {
  it("termina en el mes actual e incluye n meses", () => {
    expect(ultimosMeses(6, "2026-07-03")).toEqual([
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
    ]);
  });

  it("cruza el cambio de año", () => {
    expect(ultimosMeses(4, "2026-02-15")).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });

  it("un solo mes", () => {
    expect(ultimosMeses(1, "2026-07-03")).toEqual(["2026-07"]);
  });
});
