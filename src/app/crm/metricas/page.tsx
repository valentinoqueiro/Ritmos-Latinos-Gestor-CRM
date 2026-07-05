import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  campanas,
  configuracion,
  disciplinas,
  leadDisciplinas,
  origenesNegocio,
} from "@/db/schema";
import { requerirSeccion } from "@/lib/auth/guards";
import {
  CLAVE_UMBRAL_LEAD_FRIO,
  UMBRAL_LEAD_FRIO_DEFAULT,
  esLeadFrio,
  metricasDeLeads,
  type FilaMetrica,
} from "@/lib/reglas-crm";
import { ETIQUETA_ESTADO_LEAD, type EstadoLead } from "@/lib/reglas-leads";
import { sedesVisibles } from "@/lib/sedes";

export const metadata: Metadata = { title: "Métricas del CRM" };

// Métricas del embudo (R5): qué disciplina trae más interesados, qué origen
// convierte mejor y dónde se estanca el pipeline. Un lead con dos disciplinas
// cuenta en ambas (criterio explícito); los "sin disciplina" no entran a las
// métricas por disciplina/sede pero se muestran SIEMPRE para clasificarlos.

const ETAPAS: EstadoLead[] = [
  "nuevo",
  "contactado",
  "prueba_agendada",
  "convertido",
  "perdido",
];

function porcentaje(tasa: number | null): string {
  return tasa === null ? "—" : `${Math.round(tasa * 100)}%`;
}

function Barras({
  titulo,
  descripcion,
  filas,
  nombreDe,
}: {
  titulo: string;
  descripcion: string;
  filas: FilaMetrica[];
  nombreDe?: (fila: FilaMetrica) => string;
}) {
  const maximo = Math.max(1, ...filas.map((f) => f.total));
  return (
    <section className="tarjeta p-4">
      <h2 className="titulo-display text-2xl">{titulo}</h2>
      <p className="mt-0.5 text-xs text-tinta-suave">{descripcion}</p>
      {filas.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-borde px-3 py-4 text-center text-sm text-tinta-suave">
          Sin datos todavía.
        </p>
      ) : (
        <ul className="mt-3 grid gap-2.5">
          {filas.map((fila) => (
            <li key={fila.clave}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium">
                  {nombreDe ? nombreDe(fila) : fila.clave}
                </span>
                <span className="shrink-0 text-xs text-tinta-suave tabular-nums">
                  {fila.total} {fila.total === 1 ? "lead" : "leads"} · convierte{" "}
                  <strong
                    className={
                      fila.tasa !== null && fila.tasa >= 0.5
                        ? "text-ok"
                        : "text-tinta"
                    }
                  >
                    {porcentaje(fila.tasa)}
                  </strong>
                </span>
              </div>
              <div
                aria-hidden
                className="mt-1 h-2 overflow-hidden rounded-full bg-fondo ring-1 ring-borde"
              >
                <div
                  className="h-full rounded-full bg-marca"
                  style={{ width: `${(fila.total / maximo) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      {filas.length > 0 ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-tinta-suave">
            Ver como tabla
          </summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-72 text-left text-sm">
              <thead>
                <tr className="border-b border-borde text-xs uppercase text-tinta-suave">
                  <th className="py-1.5 pr-3">{titulo}</th>
                  <th className="py-1.5 pr-3">Leads</th>
                  <th className="py-1.5 pr-3">Convertidos</th>
                  <th className="py-1.5 pr-3">Perdidos</th>
                  <th className="py-1.5">Conversión</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.clave} className="border-b border-borde last:border-0">
                    <td className="py-1.5 pr-3">{nombreDe ? nombreDe(f) : f.clave}</td>
                    <td className="py-1.5 pr-3 tabular-nums">{f.total}</td>
                    <td className="py-1.5 pr-3 tabular-nums">{f.convertidos}</td>
                    <td className="py-1.5 pr-3 tabular-nums">{f.perdidos}</td>
                    <td className="py-1.5 tabular-nums">{porcentaje(f.tasa)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </section>
  );
}

export default async function PaginaMetricasCrm() {
  const usuario = await requerirSeccion("crm");
  const [todos, sedes, origenes, filaUmbral, catalogoCampanas] =
    await Promise.all([
      db.query.leads.findMany(),
      sedesVisibles(usuario),
      db.query.origenesNegocio.findMany({ orderBy: asc(origenesNegocio.id) }),
      db.query.configuracion.findFirst({
        where: eq(configuracion.clave, CLAVE_UMBRAL_LEAD_FRIO),
      }),
      db.query.campanas.findMany({ orderBy: asc(campanas.nombre) }),
    ]);
  const intereses =
    todos.length === 0
      ? []
      : await db
          .select({
            leadId: leadDisciplinas.leadId,
            nombre: disciplinas.nombre,
            sedeId: disciplinas.sedeId,
          })
          .from(leadDisciplinas)
          .innerJoin(disciplinas, eq(leadDisciplinas.disciplinaId, disciplinas.id));

  const umbral = Number(filaUmbral?.valor) || UMBRAL_LEAD_FRIO_DEFAULT;
  const origenDe = (id: number | null) =>
    origenes.find((o) => o.id === id)?.nombre ?? null;
  const nombreSede = (id: number) =>
    sedes.find((s) => s.id === id)?.nombre ?? `Sede ${id}`;

  const metricas = metricasDeLeads(
    todos.map((l) => ({
      estado: l.estado,
      origen: origenDe(l.origenNegocioId),
      campana:
        catalogoCampanas.find((c) => c.id === l.campanaId)?.nombre ?? null,
      disciplinas: intereses.filter((i) => i.leadId === l.id),
    })),
  );
  // La comparación de campañas solo aparece cuando hay campañas: sin anuncios
  // corriendo sería una sección de una sola fila "Orgánico" (ruido).
  const hayCampanas = metricas.porCampana.some((f) => f.clave !== "Orgánico");
  const ahora = new Date();
  const frios = todos.filter((l) =>
    esLeadFrio(l.estado, l.etapaDesde, ahora, umbral),
  ).length;
  const abiertos =
    metricas.porEtapa.nuevo +
    metricas.porEtapa.contactado +
    metricas.porEtapa.prueba_agendada;
  const maximoEtapa = Math.max(1, ...ETAPAS.map((e) => metricas.porEtapa[e]));

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="titulo-display text-4xl">Métricas</h1>
          <p className="mt-0.5 text-sm text-tinta-suave">
            Qué disciplina trae más interesados y qué origen convierte mejor.
          </p>
        </div>
        {metricas.sinDisciplina > 0 ? (
          <Link
            href="/crm"
            className="rounded-full bg-marca-suave px-3 py-2 text-xs font-semibold text-marca-oscuro transition hover:bg-marca/20"
          >
            {metricas.sinDisciplina} sin disciplina, fuera de estas métricas ·
            clasificar →
          </Link>
        ) : null}
      </div>

      {/* KPIs del embudo */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="tarjeta p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-tinta-suave">
            Abiertos
          </h2>
          <p className="titulo-display mt-1 text-3xl tabular-nums">{abiertos}</p>
        </div>
        <div className="tarjeta p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-tinta-suave">
            Fríos ahora
          </h2>
          <p
            className={`titulo-display mt-1 text-3xl tabular-nums ${frios > 0 ? "text-alerta" : ""}`}
          >
            {frios}
          </p>
          <p className="mt-0.5 text-xs text-tinta-suave">
            +{umbral} días sin moverse
          </p>
        </div>
        <div className="tarjeta p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-tinta-suave">
            Convertidos
          </h2>
          <p className="titulo-display mt-1 text-3xl text-ok tabular-nums">
            {metricas.porEtapa.convertido}
          </p>
          <p className="mt-0.5 text-xs text-tinta-suave">
            {metricas.porEtapa.perdido} perdidos
          </p>
        </div>
        <div className="tarjeta border-t-4 border-t-marca p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-tinta-suave">
            Conversión
          </h2>
          <p className="titulo-display mt-1 text-3xl tabular-nums">
            {porcentaje(metricas.tasaGlobal)}
          </p>
          <p className="mt-0.5 text-xs text-tinta-suave">
            convertidos sobre cerrados
          </p>
        </div>
      </div>

      {/* Embudo por etapa */}
      <section className="mt-4 tarjeta p-4">
        <h2 className="titulo-display text-2xl">Embudo por etapa</h2>
        <ul className="mt-3 grid gap-2">
          {ETAPAS.map((etapa) => (
            <li key={etapa} className="flex items-center gap-3">
              <span className="w-32 shrink-0 text-sm font-medium sm:w-40">
                {ETIQUETA_ESTADO_LEAD[etapa]}
              </span>
              <div
                aria-hidden
                className="h-5 min-w-0 flex-1 overflow-hidden rounded-md bg-fondo ring-1 ring-borde"
              >
                <div
                  className={`h-full rounded-md ${
                    etapa === "convertido"
                      ? "bg-ok"
                      : etapa === "perdido"
                        ? "bg-borde"
                        : "bg-marca"
                  }`}
                  style={{
                    width: `${(metricas.porEtapa[etapa] / maximoEtapa) * 100}%`,
                  }}
                />
              </div>
              <span className="w-8 shrink-0 text-right text-sm font-semibold tabular-nums">
                {metricas.porEtapa[etapa]}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Barras
          titulo="Por disciplina"
          descripcion="Cuántos interesados trae cada disciplina y cómo convierten."
          filas={metricas.porDisciplina}
        />
        <Barras
          titulo="Por origen"
          descripcion="De dónde vienen los interesados que mejor convierten."
          filas={metricas.porOrigen}
        />
      </div>
      {hayCampanas ? (
        <div className="mt-4">
          <Barras
            titulo="Por campaña"
            descripcion="Qué campaña de anuncios convierte mejor («Orgánico» = leads sin campaña): la comparación para decidir dónde invertir."
            filas={metricas.porCampana}
          />
        </div>
      ) : null}
      <div className="mt-4">
        <Barras
          titulo="Por sede"
          descripcion="Sede derivada de las disciplinas de interés (un lead con disciplinas de dos sedes cuenta en ambas)."
          filas={metricas.porSede}
          nombreDe={(f) =>
            nombreSede((f as FilaMetrica & { sedeId: number }).sedeId)
          }
        />
      </div>
    </div>
  );
}
