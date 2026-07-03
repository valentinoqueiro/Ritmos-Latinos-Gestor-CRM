import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { sedes, usuarios } from "./schema";
import { hashearPassword } from "../lib/auth/password";

// Datos semilla de la Fase 1: las 2 sedes reales y un usuario de prueba por rol.
// Idempotente: se puede correr varias veces sin duplicar (busca por nombre/email).
//
// ⚠️ Las contraseñas de prueba se reemplazan por credenciales reales en la Fase 8.

const SEDES_INICIALES = [
  {
    nombre: "Sede Aconquija",
    direccion: "Av. Aconquija 946, Unidad Sionista",
    telefono: "5493816332438",
  },
  {
    nombre: "Sede Yerba Buena",
    direccion: "Julio Argentino Roca 124, Yerba Buena",
    telefono: "5493815838208",
  },
] as const;

const PASSWORD_PRUEBA = "ritmos123";

async function asegurarSede(datos: (typeof SEDES_INICIALES)[number]) {
  const existente = await db.query.sedes.findFirst({
    where: eq(sedes.nombre, datos.nombre),
  });
  if (existente) return existente;
  const [creada] = await db.insert(sedes).values(datos).returning();
  return creada;
}

async function asegurarUsuario(datos: {
  nombre: string;
  email: string;
  rol: "secretaria" | "admin" | "owner";
  sedeId: number | null;
}) {
  const existente = await db.query.usuarios.findFirst({
    where: eq(usuarios.email, datos.email),
  });
  if (existente) return existente;
  const passwordHash = await hashearPassword(PASSWORD_PRUEBA);
  const [creado] = await db
    .insert(usuarios)
    .values({ ...datos, passwordHash })
    .returning();
  return creado;
}

async function main() {
  const [aconquija, yerbaBuena] = await Promise.all(
    SEDES_INICIALES.map(asegurarSede),
  );

  await asegurarUsuario({
    nombre: "Secretaría Aconquija",
    email: "secretaria.aconquija@ritmoslatinos.test",
    rol: "secretaria",
    sedeId: aconquija.id,
  });
  await asegurarUsuario({
    nombre: "Secretaría Yerba Buena",
    email: "secretaria.yerbabuena@ritmoslatinos.test",
    rol: "secretaria",
    sedeId: yerbaBuena.id,
  });
  await asegurarUsuario({
    nombre: "Administración",
    email: "admin@ritmoslatinos.test",
    rol: "admin",
    sedeId: null,
  });
  await asegurarUsuario({
    nombre: "Dueños",
    email: "owner@ritmoslatinos.test",
    rol: "owner",
    sedeId: null,
  });

  console.log("Seed listo. Usuarios de prueba (contraseña: %s):", PASSWORD_PRUEBA);
  console.log("  secretaria.aconquija@ritmoslatinos.test  (secretaria, Sede Aconquija)");
  console.log("  secretaria.yerbabuena@ritmoslatinos.test (secretaria, Sede Yerba Buena)");
  console.log("  admin@ritmoslatinos.test                 (admin, todas las sedes)");
  console.log("  owner@ritmoslatinos.test                 (owner, solo dashboard)");
  process.exit(0);
}

main().catch((error) => {
  console.error("Error corriendo el seed:", error);
  process.exit(1);
});
