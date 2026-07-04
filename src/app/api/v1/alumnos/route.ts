import { NextResponse, type NextRequest } from "next/server";
import { autenticarApiPublica } from "@/lib/auth/api-publica-guard";
import { alumnosPublicos } from "@/lib/api-publica";

// GET /api/v1/alumnos?sedeId=1 — datos básicos y estado (activo/inactivo).
// Alcance requerido: alumnos:read. Sin sedeId, trae todas las sedes activas.

export async function GET(request: NextRequest) {
  const auth = await autenticarApiPublica(request, "alumnos:read");
  if (!auth.ok) return auth.respuesta;

  const crudo = request.nextUrl.searchParams.get("sedeId");
  const sedeId = crudo ? Number(crudo) : undefined;
  if (crudo && (!Number.isInteger(sedeId) || sedeId! <= 0)) {
    return NextResponse.json({ error: "sedeId inválido" }, { status: 400 });
  }

  const alumnos = await alumnosPublicos(sedeId);
  return NextResponse.json({ alumnos });
}
