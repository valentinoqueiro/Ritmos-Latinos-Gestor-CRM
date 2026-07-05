import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { autenticarApiPublica } from "@/lib/auth/api-publica-guard";
import {
  crearLeadPublico,
  ErrorDeIngesta,
  esquemaLeadPublico,
  ESTADOS_LEAD_PUBLICOS,
  leadsPublicos,
} from "@/lib/api-publica";

// POST /api/v1/leads — ingesta de leads externos (n8n, Meta Ads, formularios,
// agentes). Alcance requerido: leads:write. Entra al pipeline como "nuevo"
// con origen "api" y la fuente identificada (ver PLAN.md §3, Fase 7).
// Desde el rediseño del CRM acepta además `disciplinas` (nombres del catálogo;
// derivan la sede), `origenNegocio` y `campana` (find-or-create, para comparar
// campañas de anuncios); `sedeInteresId` queda obsoleto pero sigue aceptado
// por compatibilidad.

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
    if (error instanceof ErrorDeIngesta) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "Algo salió mal" }, { status: 500 });
  }
}

// GET /api/v1/leads?estado=nuevo&desde=2026-07-01 — pipeline en solo lectura
// para automatizaciones externas (seguimiento, recordatorios). Alcance
// requerido: leads:read. Sin filtros trae todos los leads.

export async function GET(request: NextRequest) {
  const auth = await autenticarApiPublica(request, "leads:read");
  if (!auth.ok) return auth.respuesta;

  const params = request.nextUrl.searchParams;
  const estado = params.get("estado") ?? undefined;
  if (
    estado !== undefined &&
    !(ESTADOS_LEAD_PUBLICOS as readonly string[]).includes(estado)
  ) {
    return NextResponse.json(
      { error: `estado inválido. Valores: ${ESTADOS_LEAD_PUBLICOS.join(", ")}` },
      { status: 400 },
    );
  }
  const desde = params.get("desde") ?? undefined;
  if (desde !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(desde)) {
    return NextResponse.json(
      { error: "desde inválido (formato YYYY-MM-DD)" },
      { status: 400 },
    );
  }
  // Campaña por nombre (case-insensitive); desconocida = lista vacía, no error
  // (una automatización puede preguntar por una campaña que todavía no mandó leads).
  const campana = params.get("campana") ?? undefined;

  const lista = await leadsPublicos({
    estado: estado as (typeof ESTADOS_LEAD_PUBLICOS)[number] | undefined,
    desde,
    campana,
  });
  return NextResponse.json({ leads: lista });
}
