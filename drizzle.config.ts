import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Migraciones versionadas: el esquema evoluciona SOLO por archivos generados en
// ./drizzle (npm run db:generate) y aplicados con npm run db:migrate.
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
