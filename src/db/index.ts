import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Postgres estándar vía node-postgres: funciona igual contra la base local de
// desarrollo y contra Neon en producción (la URL de Neon incluye sslmode=require).
// Pool chico: en Vercel cada instancia serverless abre pocas conexiones y Neon
// free tier las limita; usar siempre la URL "pooled" de Neon en producción.

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
  return new Pool({ connectionString: url, max: 5 });
}

const pool = globalThis.__gestorPool ?? crearPool();
if (process.env.NODE_ENV !== "production") {
  globalThis.__gestorPool = pool;
}

export const db = drizzle(pool, { schema });
