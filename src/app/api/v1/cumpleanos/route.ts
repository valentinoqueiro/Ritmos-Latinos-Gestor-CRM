import { NextResponse, type NextRequest } from "next/server";
import { autenticarApiPublica } from "@/lib/auth/api-publica-guard";
import { cumpleanosProximos } from "@/lib/api-publica";

// GET /api/v1/cumpleanos?sedeId=1 — próximos cumpleaños (lo que resta del
// mes actual) con contacto, para saludos automatizados. Alcance requerido:
// cumpleanos:read. Sin sedeId, trae todas las sedes activas.

export async function GET(request: NextRequest) {
  const auth = await autenticarApiPublica(request, "cumpleanos:read");
  if (!auth.ok) return auth.respuesta;

  const crudo = request.nextUrl.searchParams.get("sedeId");
  const sedeId = crudo ? Number(crudo) : undefined;
  if (crudo && (!Number.isInteger(sedeId) || sedeId! <= 0)) {
    return NextResponse.json({ error: "sedeId inválido" }, { status: 400 });
  }

  const cumpleanos = await cumpleanosProximos(sedeId);
  return NextResponse.json({ cumpleanos });
}
