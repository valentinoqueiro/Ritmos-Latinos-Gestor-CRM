import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { autenticarApiPublica } from "@/lib/auth/api-publica-guard";
import { crearLeadPublico, esquemaLeadPublico } from "@/lib/api-publica";

// POST /api/v1/leads — ingesta de leads externos (n8n, Meta Ads, formularios,
// agentes). Alcance requerido: leads:write. Entra al pipeline como "nuevo"
// con origen "api" y la fuente identificada (ver PLAN.md §3, Fase 7).

export async function POST(request: NextRequest) {
  const auth = await autenticarApiPublica(request, "leads:write");
  if (!auth.ok) return auth.respuesta;

  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json(
      { error: "El cuerpo debe ser JSON válido" },
      { status: 400 },
    );
  }

  try {
    const datos = esquemaLeadPublico.parse(cuerpo);
    const lead = await crearLeadPublico(datos);
    return NextResponse.json({ lead }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Datos inválidos" },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message === "La sede de interés no existe") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "Algo salió mal" }, { status: 500 });
  }
}
