import { describe, expect, it } from "vitest";
import {
  autorizarEscritura,
  autorizarSeccion,
  autorizarSede,
  ErrorAutorizacion,
  puedeAcceder,
  puedeCorregirContratos,
  sedesPermitidas,
  type Seccion,
  type UsuarioSesion,
} from "../permissions";

const secretariaSedeA: UsuarioSesion = {
  id: 1,
  nombre: "Secretaría A",
  email: "a@test",
  rol: "secretaria",
  sedeId: 10,
};
const admin: UsuarioSesion = {
  id: 2,
  nombre: "Admin",
  email: "admin@test",
  rol: "admin",
  sedeId: null,
};
const owner: UsuarioSesion = {
  id: 3,
  nombre: "Owner",
  email: "owner@test",
  rol: "owner",
  sedeId: null,
};

const TODAS_LAS_SECCIONES: Seccion[] = [
  "operativa",
  "interesados",
  "gastos",
  "dashboard",
  "crm",
  "configuracion",
];

describe("matriz de accesos por rol (PLAN.md §2)", () => {
  it("secretaria: operativa e interesados, nada más", () => {
    const suyas: Seccion[] = ["operativa", "interesados"];
    for (const seccion of suyas) {
      expect(puedeAcceder("secretaria", seccion)).toBe(true);
    }
    for (const seccion of TODAS_LAS_SECCIONES.filter(
      (s) => !suyas.includes(s),
    )) {
      expect(puedeAcceder("secretaria", seccion)).toBe(false);
    }
  });

  it("admin: todas las secciones", () => {
    for (const seccion of TODAS_LAS_SECCIONES) {
      expect(puedeAcceder("admin", seccion)).toBe(true);
    }
  });

  it("owner: solo dashboard", () => {
    expect(puedeAcceder("owner", "dashboard")).toBe(true);
    for (const seccion of TODAS_LAS_SECCIONES.filter((s) => s !== "dashboard")) {
      expect(puedeAcceder("owner", seccion)).toBe(false);
    }
  });

  it("autorizarSeccion lanza cuando el rol no accede", () => {
    expect(() => autorizarSeccion(secretariaSedeA, "gastos")).toThrow(
      ErrorAutorizacion,
    );
    expect(() => autorizarSeccion(owner, "crm")).toThrow(ErrorAutorizacion);
    expect(() => autorizarSeccion(admin, "configuracion")).not.toThrow();
  });
});

describe("alcance por sede", () => {
  it("secretaria: únicamente su sede", () => {
    expect(sedesPermitidas(secretariaSedeA)).toEqual([10]);
    expect(() => autorizarSede(secretariaSedeA, 10)).not.toThrow();
    expect(() => autorizarSede(secretariaSedeA, 20)).toThrow(ErrorAutorizacion);
  });

  it("secretaria sin sede asignada: ninguna sede", () => {
    const sinSede = { ...secretariaSedeA, sedeId: null };
    expect(sedesPermitidas(sinSede)).toEqual([]);
    expect(() => autorizarSede(sinSede, 10)).toThrow(ErrorAutorizacion);
  });

  it("admin y owner: todas las sedes", () => {
    expect(sedesPermitidas(admin)).toBe("todas");
    expect(sedesPermitidas(owner)).toBe("todas");
    expect(() => autorizarSede(admin, 999)).not.toThrow();
  });
});

describe("escritura", () => {
  it("el owner es solo lectura en todo el sistema", () => {
    expect(() => autorizarEscritura(owner)).toThrow(ErrorAutorizacion);
    expect(() => autorizarEscritura(admin)).not.toThrow();
    expect(() => autorizarEscritura(secretariaSedeA)).not.toThrow();
  });
});

describe("correcciones de contratos (decisión 2026-07-04: sin rol encargada)", () => {
  it("solo el admin puede corregir vencimientos y borrar contratos", () => {
    expect(puedeCorregirContratos("admin")).toBe(true);
    expect(puedeCorregirContratos("secretaria")).toBe(false);
    expect(puedeCorregirContratos("owner")).toBe(false);
  });
});
