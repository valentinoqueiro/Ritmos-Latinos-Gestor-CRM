import { describe, expect, it } from "vitest";
import {
  ALCANCES_API,
  esAlcanceValido,
  generarClave,
  hashearClave,
  PREFIJO_CLAVE,
  tieneAlcance,
} from "../api-keys";

describe("generación de API keys", () => {
  it("genera una clave con el prefijo esperado y hash reproducible", () => {
    const { clave, hash, ultimosCaracteres } = generarClave();
    expect(clave.startsWith(PREFIJO_CLAVE)).toBe(true);
    expect(hash).toBe(hashearClave(clave));
    expect(ultimosCaracteres).toBe(clave.slice(-4));
  });

  it("nunca guarda la clave en texto plano dentro del hash", () => {
    const { clave, hash } = generarClave();
    expect(hash).not.toContain(clave);
  });

  it("cada clave generada es distinta", () => {
    const a = generarClave();
    const b = generarClave();
    expect(a.clave).not.toBe(b.clave);
    expect(a.hash).not.toBe(b.hash);
  });

  it("el hash de la misma clave es siempre igual (permite buscar por igualdad)", () => {
    const { clave, hash } = generarClave();
    expect(hashearClave(clave)).toBe(hash);
  });
});

describe("alcances", () => {
  it("valida los alcances conocidos y rechaza cualquier otro", () => {
    for (const alcance of ALCANCES_API) {
      expect(esAlcanceValido(alcance)).toBe(true);
    }
    expect(esAlcanceValido("admin:god-mode")).toBe(false);
  });

  it("tieneAlcance solo es true si el alcance está en la lista", () => {
    expect(tieneAlcance(["leads:write"], "leads:write")).toBe(true);
    expect(tieneAlcance(["leads:write"], "alumnos:read")).toBe(false);
    expect(tieneAlcance([], "alumnos:read")).toBe(false);
  });
});
