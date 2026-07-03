import { describe, expect, it } from "vitest";
import {
  calcularVencimiento,
  diasParaVencer,
  estadoCuota,
  sumarUnMes,
} from "../vencimientos";

describe("sumarUnMes (vencimiento rodante, 30/31 días)", () => {
  it("caso normal: mismo día del mes siguiente", () => {
    expect(sumarUnMes("2026-07-03")).toBe("2026-08-03");
    expect(sumarUnMes("2026-01-15")).toBe("2026-02-15");
  });

  it("fin de mes: 31 de enero vence el 28 de febrero (no el 3 de marzo)", () => {
    expect(sumarUnMes("2026-01-31")).toBe("2026-02-28");
  });

  it("fin de mes en año bisiesto: 31 de enero de 2028 → 29 de febrero", () => {
    expect(sumarUnMes("2028-01-31")).toBe("2028-02-29");
  });

  it("31 → mes de 30 días", () => {
    expect(sumarUnMes("2026-03-31")).toBe("2026-04-30");
    expect(sumarUnMes("2026-08-31")).toBe("2026-09-30");
  });

  it("cruce de año: diciembre → enero", () => {
    expect(sumarUnMes("2026-12-15")).toBe("2027-01-15");
    expect(sumarUnMes("2026-12-31")).toBe("2027-01-31");
  });

  it("28 de febrero NO se pega a fin de mes: vence el 28 de marzo", () => {
    expect(sumarUnMes("2026-02-28")).toBe("2026-03-28");
  });
});

describe("calcularVencimiento (pagos anticipados — decisión 2 confirmada)", () => {
  it("primer pago (sin vencimiento previo): corre desde la fecha de pago", () => {
    expect(calcularVencimiento(null, "2026-07-03")).toBe("2026-08-03");
  });

  it("alumno al día que paga 3 días antes: NO pierde días (corre desde el vencimiento)", () => {
    expect(calcularVencimiento("2026-07-06", "2026-07-03")).toBe("2026-08-06");
  });

  it("paga el mismo día que vence: corre desde el vencimiento", () => {
    expect(calcularVencimiento("2026-07-03", "2026-07-03")).toBe("2026-08-03");
  });

  it("alumno vencido que paga tarde: corre desde la fecha de pago", () => {
    expect(calcularVencimiento("2026-06-20", "2026-07-03")).toBe("2026-08-03");
  });
});

describe("estadoCuota (derivado, nunca guardado)", () => {
  const HOY = "2026-07-03";

  it("sin pagos: vencida", () => {
    expect(estadoCuota(null, HOY)).toBe("vencida");
  });

  it("vencimiento pasado: vencida", () => {
    expect(estadoCuota("2026-07-02", HOY)).toBe("vencida");
  });

  it("vence hoy o dentro del umbral (5 días): por vencer", () => {
    expect(estadoCuota("2026-07-03", HOY)).toBe("por_vencer");
    expect(estadoCuota("2026-07-08", HOY)).toBe("por_vencer");
  });

  it("vence después del umbral: al día", () => {
    expect(estadoCuota("2026-07-09", HOY)).toBe("al_dia");
    expect(estadoCuota("2026-08-03", HOY)).toBe("al_dia");
  });

  it("el umbral es configurable", () => {
    expect(estadoCuota("2026-07-08", HOY, 2)).toBe("al_dia");
    expect(estadoCuota("2026-07-05", HOY, 2)).toBe("por_vencer");
  });

  it("diasParaVencer: positivo si falta, negativo si venció", () => {
    expect(diasParaVencer("2026-07-08", HOY)).toBe(5);
    expect(diasParaVencer("2026-06-30", HOY)).toBe(-3);
  });
});
