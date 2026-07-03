"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { usuarios } from "@/db/schema";
import { verificarPassword } from "@/lib/auth/password";
import { crearSesion, cerrarSesion } from "@/lib/auth/session";
import { rutaInicial } from "@/lib/auth/guards";

const esquemaLogin = z.object({
  email: z.string().trim().toLowerCase().email("Ingresá un email válido"),
  password: z.string().min(1, "Ingresá tu contraseña"),
});

export type EstadoLogin = { error?: string };

const CREDENCIALES_INVALIDAS =
  "Email o contraseña incorrectos. Probá de nuevo.";

export async function iniciarSesion(
  _estado: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const parseado = esquemaLogin.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parseado.success) {
    return { error: parseado.error.issues[0].message };
  }

  const usuario = await db.query.usuarios.findFirst({
    where: and(
      eq(usuarios.email, parseado.data.email),
      eq(usuarios.activo, true),
    ),
  });
  // Mismo mensaje exista o no el usuario: no filtramos qué emails existen.
  if (!usuario) return { error: CREDENCIALES_INVALIDAS };

  const passwordOk = await verificarPassword(
    parseado.data.password,
    usuario.passwordHash,
  );
  if (!passwordOk) return { error: CREDENCIALES_INVALIDAS };

  await crearSesion({
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol,
    sedeId: usuario.sedeId,
  });

  redirect(
    rutaInicial({
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
      sedeId: usuario.sedeId,
    }),
  );
}

export async function salir(): Promise<void> {
  await cerrarSesion();
  redirect("/login");
}
