import { describe, expect, it } from "vitest";
import {
  diasEnEtapa,
  esLeadFrio,
  metricasDeLeads,
  sedesDeInteres,
} from "../reglas-crm";

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

describe("metricasDeLeads (métricas del CRM, R5)", () => {
  const pole = { nombre: "Pole", sedeId: 2 };
  const jazz = { nombre: "Jazz", sedeId: 1 };

  it("un lead con dos disciplinas cuenta en ambas (y en ambas sedes)", () => {
    const m = metricasDeLeads([
      { estado: "convertido", origen: "Meta Ads", disciplinas: [pole, jazz] },
    ]);
    expect(m.porDisciplina.map((f) => f.clave).sort()).toEqual(["Jazz", "Pole"]);
    expect(m.porDisciplina.every((f) => f.convertidos === 1)).toBe(true);
    expect(m.porSede.map((f) => f.sedeId).sort()).toEqual([1, 2]);
  });

  it("tasa por dimensión: convertidos sobre cerrados; null sin desenlaces", () => {
    const m = metricasDeLeads([
      { estado: "convertido", origen: "Instagram", disciplinas: [pole] },
      { estado: "perdido", origen: "Instagram", disciplinas: [pole] },
      { estado: "nuevo", origen: "Web", disciplinas: [jazz] },
    ]);
    expect(m.porOrigen.find((f) => f.clave === "Instagram")?.tasa).toBe(0.5);
    expect(m.porOrigen.find((f) => f.clave === "Web")?.tasa).toBeNull();
    expect(m.tasaGlobal).toBe(0.5);
  });

  it("sin disciplina: fuera de disciplina/sede pero contado y visible", () => {
    const m = metricasDeLeads([
      { estado: "nuevo", origen: null, disciplinas: [] },
      { estado: "contactado", origen: "Mostrador", disciplinas: [pole] },
    ]);
    expect(m.sinDisciplina).toBe(1);
    expect(m.porDisciplina).toHaveLength(1);
    expect(m.porEtapa.nuevo).toBe(1);
  });

  it("sin origen agrupa como 'Sin clasificar' (visible, no desaparece)", () => {
    const m = metricasDeLeads([
      { estado: "nuevo", origen: null, disciplinas: [pole] },
    ]);
    expect(m.porOrigen[0]?.clave).toBe("Sin clasificar");
  });

  it("ordena por total descendente", () => {
    const m = metricasDeLeads([
      { estado: "nuevo", origen: "Web", disciplinas: [jazz] },
      { estado: "nuevo", origen: "Meta Ads", disciplinas: [pole] },
      { estado: "nuevo", origen: "Meta Ads", disciplinas: [pole] },
    ]);
    expect(m.porOrigen[0]?.clave).toBe("Meta Ads");
    expect(m.porDisciplina[0]?.clave).toBe("Pole");
  });
});
