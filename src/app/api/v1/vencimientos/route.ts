import { NextResponse, type NextRequest } from "next/server";
import { autenticarApiPublica } from "@/lib/auth/api-publica-guard";
import { vencimientosPublicos } from "@/lib/api-publica";

// GET /api/v1/vencimientos?sedeId=1 — cuotas por vencer y vencidas con
// contacto, para recordatorios y recuperación externos. Alcance requerido:
// vencimientos:read. Sin sedeId, trae todas las sedes activas.

export async function GET(request: NextRequest) {
  const auth = await autenticarApiPublica(request, "vencimientos:read");
  if (!auth.ok) return auth.respuesta;

  const crudo = request.nextUrl.searchParams.get("sedeId");
  const sedeId = crudo ? Number(crudo) : undefined;
  if (crudo && (!Number.isInteger(sedeId) || sedeId! <= 0)) {
    return NextResponse.json({ error: "sedeId inválido" }, { status: 400 });
  }

  const vencimientos = await vencimientosPublicos(sedeId);
  return NextResponse.json({ vencimientos });
}
