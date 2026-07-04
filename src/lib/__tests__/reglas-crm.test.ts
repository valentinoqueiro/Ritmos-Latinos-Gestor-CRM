import { describe, expect, it } from "vitest";
import { diasEnEtapa, esLeadFrio, sedesDeInteres } from "../reglas-crm";

describe("sedesDeInteres (la sede se DERIVA de las disciplinas)", () => {
  it("una disciplina: la sede de esa disciplina", () => {
    expect(sedesDeInteres([{ sedeId: 1 }])).toEqual([1]);
  });

  it("varias disciplinas de la misma sede: una sola sede, sin repetir", () => {
    expect(sedesDeInteres([{ sedeId: 2 }, { sedeId: 2 }])).toEqual([2]);
  });

  it("disciplinas de dos sedes: el lead pertenece a ambas", () => {
    expect(sedesDeInteres([{ sedeId: 2 }, { sedeId: 1 }])).toEqual([1, 2]);
  });

  it("sin disciplinas: sin sede (queda fuera de las métricas por sede)", () => {
    expect(sedesDeInteres([])).toEqual([]);
  });
});

describe("diasEnEtapa", () => {
  it("cuenta días completos desde que entró a la etapa", () => {
    const desde = new Date("2026-07-01T12:00:00Z");
    expect(diasEnEtapa(desde, new Date("2026-07-04T12:00:00Z"))).toBe(3);
    expect(diasEnEtapa(desde, new Date("2026-07-04T11:00:00Z"))).toBe(2);
  });

  it("nunca negativo (reloj corrido o dato raro)", () => {
    const desde = new Date("2026-07-05T00:00:00Z");
    expect(diasEnEtapa(desde, new Date("2026-07-04T00:00:00Z"))).toBe(0);
  });
});

describe("esLeadFrio (umbral de días sin cambiar de etapa)", () => {
  const ahora = new Date("2026-07-10T12:00:00Z");
  const hace5dias = new Date("2026-07-05T12:00:00Z");
  const hace2dias = new Date("2026-07-08T12:00:00Z");

  it("abierto y quieto más días que el umbral: frío", () => {
    expect(esLeadFrio("nuevo", hace5dias, ahora, 3)).toBe(true);
    expect(esLeadFrio("contactado", hace5dias, ahora, 3)).toBe(true);
  });

  it("abierto pero dentro del umbral: no es frío", () => {
    expect(esLeadFrio("nuevo", hace2dias, ahora, 3)).toBe(false);
  });

  it("exactamente en el umbral: todavía no es frío (frío = MÁS días)", () => {
    const hace3dias = new Date("2026-07-07T12:00:00Z");
    expect(esLeadFrio("nuevo", hace3dias, ahora, 3)).toBe(false);
  });

  it("los estados finales nunca son fríos (ya tuvieron desenlace)", () => {
    expect(esLeadFrio("convertido", hace5dias, ahora, 3)).toBe(false);
    expect(esLeadFrio("perdido", hace5dias, ahora, 3)).toBe(false);
  });
});
