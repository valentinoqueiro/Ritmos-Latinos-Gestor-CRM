import { NextResponse } from "next/server";
import { usuarioDeApi } from "@/lib/auth/api-guards";
import { sedesVisibles } from "@/lib/sedes";

// Sedes visibles para el usuario autenticado. El filtrado por alcance ocurre
// en el servidor (sedesVisibles): una secretaria solo recibe su propia sede,
// sin importar cómo llame a este endpoint.
export async function GET() {
  const guard = await usuarioDeApi();
  if (!guard.ok) return guard.respuesta;

  const sedes = await sedesVisibles(guard.usuario);
  return NextResponse.json({
    sedes: sedes.map((s) => ({
      id: s.id,
      nombre: s.nombre,
      direccion: s.direccion,
    })),
  });
}
