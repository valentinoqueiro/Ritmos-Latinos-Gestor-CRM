"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { requerirUsuario } from "@/lib/auth/guards";
import { autorizarSede } from "@/lib/auth/permissions";
import { COOKIE_SEDE, sedesVisibles } from "@/lib/sedes";

// Selector de sede del admin. La secretaria no elige (su sede es fija y el
// backend la fuerza en sedeActiva); igual validamos acá por las dudas.
export async function cambiarSede(formData: FormData): Promise<void> {
  const usuario = await requerirUsuario();
  const sedeId = z.coerce.number().int().positive().parse(formData.get("sedeId"));

  autorizarSede(usuario, sedeId);
  const visibles = await sedesVisibles(usuario);
  if (!visibles.some((s) => s.id === sedeId)) return;

  const jar = await cookies();
  jar.set(COOKIE_SEDE, String(sedeId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  revalidatePath("/", "layout");
}
