import { beforeEach, describe, expect, it } from "vitest";
import { excedeLimite, reiniciarContadores } from "../rate-limit";

describe("límite de solicitudes por API key", () => {
  beforeEach(() => {
    reiniciarContadores();
  });

  it("no excede el límite dentro de la ventana con pocas solicitudes", () => {
    for (let i = 0; i < 10; i++) {
      expect(excedeLimite(1, 1_000)).toBe(false);
    }
  });

  it("excede el límite al superar el tope dentro de la misma ventana", () => {
    let excedido = false;
    for (let i = 0; i < 61; i++) {
      excedido = excedeLimite(1, 1_000) || excedido;
    }
    expect(excedido).toBe(true);
  });

  it("reinicia el contador en una ventana nueva", () => {
    for (let i = 0; i < 60; i++) excedeLimite(1, 0);
    expect(excedeLimite(1, 61_000)).toBe(false);
  });

  it("cada API key tiene su propio contador", () => {
    for (let i = 0; i < 60; i++) excedeLimite(1, 0);
    expect(excedeLimite(2, 0)).toBe(false);
  });
});
