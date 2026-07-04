import { describe, expect, it } from "vitest";
import { resumenDeTurno } from "../reglas-caja";

describe("resumenDeTurno (cierre de caja)", () => {
  it("turno sin actividad: todo en cero, esperado = efectivo inicial", () => {
    expect(
      resumenDeTurno({
        efectivoInicial: 20000,
        contratosDelTurno: [],
        entregas: [],
        egresos: [],
      }),
    ).toEqual({
      nuevos: 0,
      renovados: 0,
      totalEfectivo: 0,
      totalTransferencia: 0,
      egresos: 0,
      efectivoEsperado: 20000,
    });
  });

  it("efectivo inicial null se trata como 0", () => {
    const r = resumenDeTurno({
      efectivoInicial: null,
      contratosDelTurno: [],
      entregas: [{ monto: 5000, medio: "efectivo" }],
      egresos: [],
    });
    expect(r.efectivoEsperado).toBe(5000);
  });

  it("separa efectivo de transferencia (la transferencia no está en la caja física)", () => {
    const r = resumenDeTurno({
      efectivoInicial: 10000,
      contratosDelTurno: [],
      entregas: [
        { monto: 24000, medio: "efectivo" },
        { monto: 40000, medio: "transferencia" },
        { monto: 6000, medio: "efectivo" },
      ],
      egresos: [],
    });
    expect(r.totalEfectivo).toBe(30000);
    expect(r.totalTransferencia).toBe(40000);
    expect(r.efectivoEsperado).toBe(40000); // 10000 + 30000, sin transferencias
  });

  it("los egresos descuentan del efectivo esperado", () => {
    const r = resumenDeTurno({
      efectivoInicial: 20000,
      contratosDelTurno: [],
      entregas: [{ monto: 24000, medio: "efectivo" }],
      egresos: [{ monto: 3500 }, { monto: 1500 }],
    });
    expect(r.egresos).toBe(5000);
    expect(r.efectivoEsperado).toBe(39000);
  });

  it("egresos mayores a lo cobrado: el esperado queda negativo (se muestra, no se bloquea)", () => {
    const r = resumenDeTurno({
      efectivoInicial: null,
      contratosDelTurno: [],
      entregas: [],
      egresos: [{ monto: 1000 }],
    });
    expect(r.efectivoEsperado).toBe(-1000);
  });

  it("cuenta nuevos (primer contrato del alumno) y renovados por separado", () => {
    const r = resumenDeTurno({
      efectivoInicial: null,
      contratosDelTurno: [
        { esPrimerContratoDelAlumno: true },
        { esPrimerContratoDelAlumno: false },
        { esPrimerContratoDelAlumno: false },
      ],
      entregas: [],
      egresos: [],
    });
    expect(r.nuevos).toBe(1);
    expect(r.renovados).toBe(2);
  });
});
