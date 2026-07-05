import type { Pool, PoolClient } from "pg";

// Resiliencia Neon serverless + Vercel (ver CHANGELOG "conexión muerta").
// Neon (free tier) SUSPENDE el compute tras ~5 min de inactividad y corta las
// conexiones TCP. Una instancia serverless de Vercel puede quedar "congelada"
// con esas conexiones guardadas en el Pool; cuando revive y reusa una, la
// primera query falla ("Connection terminated unexpectedly" / ECONNRESET) y la
// acción caía en "Algo salió mal". La solución NO es sólo un timeout (el freeze
// del lambda congela los timers): es AUTO-SANAR — validar la conexión al tomarla
// y reintentar la primera query, descartando la muerta para abrir una fresca.

export const MAX_INTENTOS = 3;

/**
 * ¿El error es una conexión caída (recuperable reabriendo), no un error de
 * lógica/datos? Neon al suspender manda `57P01` (admin shutdown); la caída de
 * socket llega como ECONNRESET/EPIPE o como un Error de pg sin `code` pero con
 * mensaje característico. Ante la duda NO reintentamos (un error de datos no se
 * arregla repitiéndolo).
 */
export function esErrorDeConexion(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  if (typeof code === "string") {
    // 57P01 admin shutdown, 57P02 crash shutdown, 57P03 cannot connect now,
    // clase 08* "connection exception".
    if (
      code === "57P01" ||
      code === "57P02" ||
      code === "57P03" ||
      code.startsWith("08") ||
      code === "ECONNRESET" ||
      code === "EPIPE" ||
      code === "ETIMEDOUT" ||
      code === "ENOTFOUND" ||
      code === "ECONNREFUSED"
    ) {
      return true;
    }
  }
  const mensaje = String((error as { message?: unknown }).message ?? "").toLowerCase();
  return (
    mensaje.includes("connection terminated") ||
    mensaje.includes("terminating connection") ||
    mensaje.includes("connection reset") ||
    mensaje.includes("econnreset") ||
    mensaje.includes("server closed the connection") ||
    mensaje.includes("connection closed") ||
    mensaje.includes("client has encountered a connection error") ||
    mensaje.includes("timeout expired") ||
    mensaje.includes("cannot use a pool after calling end")
  );
}

/**
 * Envuelve `query` y `connect` del Pool para tolerar conexiones muertas de Neon.
 * Drizzle usa `pool.query(...)` para queries sueltas y `pool.connect()` para las
 * transacciones (verificado en drizzle-orm/node-postgres/session), así que con
 * interceptar esos dos métodos cubrimos TODA la app de forma transparente.
 */
export function envolverResiliente(pool: Pool): Pool {
  const queryOriginal = pool.query.bind(pool);
  const connectOriginal = pool.connect.bind(pool);

  // --- query: reintentar la primera query si la conexión estaba muerta --------
  // pg destruye del pool al cliente que erroró, así que el reintento toma/crea
  // uno sano. Solo forma-promesa (drizzle nunca usa callback acá).
  pool.query = function (this: Pool, ...args: unknown[]): unknown {
    if (typeof args[args.length - 1] === "function") {
      // Estilo callback (uso interno de pg): sin reintento.
      return (queryOriginal as (...a: unknown[]) => unknown)(...args);
    }
    return (async () => {
      let ultimo: unknown;
      for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
        try {
          return await (queryOriginal as (...a: unknown[]) => Promise<unknown>)(...args);
        } catch (error) {
          ultimo = error;
          if (!esErrorDeConexion(error) || intento === MAX_INTENTOS) throw error;
        }
      }
      throw ultimo;
    })();
  } as typeof pool.query;

  // --- connect: validar la conexión ANTES de dársela a una transacción --------
  // Una transacción no se puede reintentar a medias, así que garantizamos que el
  // cliente entregado esté vivo (SELECT 1). Si está muerto, lo destruimos y
  // pedimos otro; el pool crea uno fresco que despierta a Neon.
  pool.connect = function (this: Pool, cb?: unknown): unknown {
    if (typeof cb === "function") {
      // Estilo callback (uso interno de pg): sin validación.
      return (connectOriginal as (...a: unknown[]) => unknown)(cb);
    }
    return (async () => {
      let ultimo: unknown;
      for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
        const client = (await (connectOriginal as () => Promise<PoolClient>)()) as PoolClient;
        try {
          await client.query("SELECT 1");
          return client;
        } catch (error) {
          ultimo = error;
          client.release(true); // destruir: no vuelve al pool
          if (!esErrorDeConexion(error) || intento === MAX_INTENTOS) throw error;
        }
      }
      throw ultimo;
    })();
  } as typeof pool.connect;

  return pool;
}
