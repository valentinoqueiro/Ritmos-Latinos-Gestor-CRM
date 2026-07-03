import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/auth/session";
import { rutaInicial } from "@/lib/auth/guards";

export default async function Home() {
  const usuario = await obtenerSesion();
  redirect(usuario ? rutaInicial(usuario) : "/login");
}
