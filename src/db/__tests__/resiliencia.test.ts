import { describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { envolverResiliente, esErrorDeConexion } from "../resiliencia";

const errorConexion = () => new Error("Connection terminated unexpectedly");

describe("esErrorDeConexion", () => {
  it("reconoce el suspend de Neon (57P01 admin shutdown)", () => {
    expect(esErrorDeConexion({ code: "57P01" })).toBe(true);
  });

  it("reconoce caídas de socket por code", () => {
    for (const code of ["ECONNRESET", "EPIPE", "ETIMEDOUT", "08006", "08003"]) {
      expect(esErrorDeConexion({ code })).toBe(true);
    }
  });

  it("reconoce el error típico de pg sin code, por mensaje", () => {
    expect(
      esErrorDeConexion(new Error("Connection terminated unexpectedly")),
    ).toBe(true);
    expect(
      esErrorDeConexion(new Error("terminating connection due to administrator command")),
    ).toBe(true);
    expect(esErrorDeConexion(new Error("read ECONNRESET"))).toBe(true);
  });

  it("NO reintenta errores de datos/lógica (no son de conexión)", () => {
    // Violación de unique, etc.: repetir no lo arregla.
    expect(esErrorDeConexion({ code: "23505", message: "duplicate key value" })).toBe(false);
    expect(esErrorDeConexion(new Error("El lead no existe"))).toBe(false);
    expect(esErrorDeConexion(new Error("syntax error at or near"))).toBe(false);
  });

  it("es defensivo ante entradas raras", () => {
    expect(esErrorDeConexion(null)).toBe(false);
    expect(esErrorDeConexion(undefined)).toBe(false);
    expect(esErrorDeConexion("boom")).toBe(false);
    expect(esErrorDeConexion(42)).toBe(false);
  });
});

describe("envolverResiliente — query", () => {
  it("reintenta la query si la primera conexión estaba muerta", async () => {
    let intentos = 0;
    const fake = {
      query: async () => {
        intentos++;
        if (intentos === 1) throw errorConexion();
        return { rows: [{ ok: 1 }] };
      },
      connect: async () => ({}),
    } as unknown as Pool;
    envolverResiliente(fake);
    const res = (await fake.query("select 1")) as { rows: unknown[] };
    expect(intentos).toBe(2);
    expect(res.rows).toEqual([{ ok: 1 }]);
  });

  it("NO reintenta un error de datos (lo propaga en el primer intento)", async () => {
    let intentos = 0;
    const fake = {
      query: async () => {
        intentos++;
        throw Object.assign(new Error("duplicate key value"), { code: "23505" });
      },
      connect: async () => ({}),
    } as unknown as Pool;
    envolverResiliente(fake);
    await expect(fake.query("insert ...")).rejects.toThrow("duplicate key");
    expect(intentos).toBe(1);
  });

  it("se rinde tras agotar los intentos si la conexión sigue muerta", async () => {
    let intentos = 0;
    const fake = {
      query: async () => {
        intentos++;
        throw errorConexion();
      },
      connect: async () => ({}),
    } as unknown as Pool;
    envolverResiliente(fake);
    await expect(fake.query("select 1")).rejects.toThrow("Connection terminated");
    expect(intentos).toBe(3);
  });
});

describe("envolverResiliente — connect", () => {
  it("descarta el cliente muerto y entrega uno sano a la transacción", async () => {
    let destruido = false;
    const muerto = {
      query: async () => {
        throw errorConexion();
      },
      release: (destroy?: boolean) => {
        if (destroy) destruido = true;
      },
    };
    const sano = { query: async () => ({ rows: [{}] }), release: () => {} };
    let entregas = 0;
    const fake = {
      query: async () => ({}),
      connect: async () => {
        entregas++;
        return entregas === 1 ? muerto : sano;
      },
    } as unknown as Pool;
    envolverResiliente(fake);
    const client = await fake.connect();
    expect(client).toBe(sano);
    expect(entregas).toBe(2);
    expect(destruido).toBe(true); // el muerto se destruyó, no volvió al pool
  });

  it("propaga un error que NO es de conexión sin reintentar el connect", async () => {
    const cliente = {
      query: async () => {
        throw Object.assign(new Error("permission denied"), { code: "42501" });
      },
      release: () => {},
    };
    let entregas = 0;
    const fake = {
      query: async () => ({}),
      connect: async () => {
        entregas++;
        return cliente;
      },
    } as unknown as Pool;
    envolverResiliente(fake);
    await expect(fake.connect()).rejects.toThrow("permission denied");
    expect(entregas).toBe(1);
  });
});
