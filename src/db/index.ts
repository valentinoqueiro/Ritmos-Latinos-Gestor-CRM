import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { envolverResiliente } from "./resiliencia";

// Postgres estándar vía node-postgres: funciona igual contra la base local de
// desarrollo y contra Neon en producción (la URL de Neon incluye sslmode=require).
// La tolerancia a conexiones muertas de Neon vive en ./resiliencia.

declare global {
  // Evita agotar conexiones con el hot-reload de desarrollo.
  var __gestorPool: Pool | undefined;
}

function crearPool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Falta la variable de entorno DATABASE_URL (ver README y .env.example)",
    );
  }
  const pool = new Pool({
    connectionString: url,
    // Pool chico: en Vercel cada instancia serverless abre pocas conexiones y
    // Neon free tier las limita; usar siempre la URL "pooled" de Neon en prod.
    max: 5,
    // Neon puede tardar unos segundos en despertar del suspend: no abortar antes.
    connectionTimeoutMillis: 10_000,
    // Reciclar conexiones ociosas y con muchos usos reduce (no elimina, por el
    // freeze del lambda) el chance de reusar una que Neon ya cortó.
    idleTimeoutMillis: 30_000,
    maxUses: 7_500,
    keepAlive: true,
  });

  // OBLIGATORIO en node-pg: sin listener, el error de un cliente OCIOSO (típico
  // cuando Neon suspende) se emite en un EventEmitter sin manejar y puede tumbar
  // el proceso. Lo tragamos: el cliente ya fue removido del pool.
  pool.on("error", (error) => {
    console.warn("[db] cliente ocioso cayó (se descarta):", (error as Error).message);
  });

  return envolverResiliente(pool);
}

const pool = globalThis.__gestorPool ?? crearPool();
if (process.env.NODE_ENV !== "production") {
  globalThis.__gestorPool = pool;
}

export const db = drizzle(pool, { schema });
