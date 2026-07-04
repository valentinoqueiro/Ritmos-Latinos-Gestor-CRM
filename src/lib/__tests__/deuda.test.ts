import { describe, expect, it } from "vitest";
import {
  esDeudor,
  saldoPendiente,
  totalEntregado,
  validarReparto,
} from "../deuda";

describe("totalEntregado", () => {
  it("suma entregas que llegan como string (numeric de la base)", () => {
    expect(totalEntregado([{ monto: "10000.00" }, { monto: "5000.50" }])).toBe(
      15000.5,
    );
  });

  it("sin entregas: 0", () => {
    expect(totalEntregado([])).toBe(0);
  });
});

describe("saldoPendiente", () => {
  it("entrega parcial: queda el resto", () => {
    expect(saldoPendiente(24000, 14000)).toBe(10000);
  });

  it("entrega completa: saldo 0", () => {
    expect(saldoPendiente(24000, 24000)).toBe(0);
  });

  it("nunca negativo aunque se haya entregado de más", () => {
    expect(saldoPendiente(24000, 25000)).toBe(0);
  });

  it("diferencias de centavos por numeric/string no cuentan como deuda", () => {
    expect(saldoPendiente(24000, 23999.995)).toBe(0);
  });
});

describe("esDeudor", () => {
  it("saldo positivo real: deudor", () => {
    expect(esDeudor(100)).toBe(true);
  });

  it("saldo 0 o residuo de centavos: no deudor", () => {
    expect(esDeudor(0)).toBe(false);
    expect(esDeudor(0.005)).toBe(false);
  });
});

describe("validarReparto (cobro mixto efectivo + transferencia)", () => {
  it("reparto exacto en un solo medio", () => {
    expect(validarReparto(24000, 24000, 0)).toEqual({
      ok: true,
      total: 24000,
      saldo: 0,
    });
  });

  it("reparto mixto que completa el monto", () => {
    expect(validarReparto(24000, 10000, 14000)).toEqual({
      ok: true,
      total: 24000,
      saldo: 0,
    });
  });

  it("cobro parcial: válido, con saldo pendiente (queda deudor)", () => {
    expect(validarReparto(24000, 14000, 0)).toEqual({
      ok: true,
      total: 14000,
      saldo: 10000,
    });
  });

  it("no se puede cobrar nada (total 0)", () => {
    const r = validarReparto(24000, 0, 0);
    expect(r.ok).toBe(false);
  });

  it("no se puede cobrar de más", () => {
    const r = validarReparto(24000, 24000, 1000);
    expect(r.ok).toBe(false);
  });

  it("montos negativos: inválidos", () => {
    expect(validarReparto(24000, -1, 100).ok).toBe(false);
    expect(validarReparto(24000, 100, -1).ok).toBe(false);
  });

  it("suma con decimales flotantes se redondea a centavos", () => {
    const r = validarReparto(0.3, 0.1, 0.2);
    expect(r).toEqual({ ok: true, total: 0.3, saldo: 0 });
  });
});
