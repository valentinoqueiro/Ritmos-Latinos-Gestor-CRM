import type { Metadata } from "next";
import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { disciplinas, horarios, leads, type Lead } from "@/db/schema";
import { requerirSeccion } from "@/lib/auth/guards";
import { formatoFecha, hoyISO } from "@/lib/fechas";
import { DIAS, formatoHora } from "@/lib/operativa";
import {
  ETIQUETA_ESTADO_LEAD,
  tasaDeConversion,
  type EstadoLead,
} from "@/lib/reglas-leads";
import { sedesVisibles } from "@/lib/sedes";
import { Campo, Input, Select } from "@/componentes/campos";
import { EncabezadoSeccion } from "@/componentes/encabezado";
import { FormAccion } from "@/componentes/form-accion";
import {
  agendarPrueba,
  crearLead,
  marcarContactado,
  marcarPerdido,
} from "./acciones";

export const metadata: Metadata = { title: "CRM" };

type HorarioOpcion = {
  id: number;
  etiqueta: string;
  sedeId: number;
};

function TarjetaLead({
  lead,
  sedes,
  opciones,
}: {
  lead: Lead;
  sedes: { id: number; nombre: string }[];
  opciones: HorarioOpcion[];
}) {
  const wa = lead.telefono.replace(/\D/g, "");
  const sedeInteres = sedes.find((s) => s.id === lead.sedeInteresId)?.nombre;
  const prueba = opciones.find((o) => o.id === lead.pruebaHorarioId);

  return (
    <li className="tarjeta p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{lead.nombre}</p>
        <a
          href={`https://wa.me/${wa}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-ok/10 px-2.5 py-1 text-xs font-semibold text-ok"
        >
          WhatsApp
        </a>
      </div>
      <p className="mt-1 text-xs text-tinta-suave">
        {lead.telefono}
        {lead.email ? ` · ${lead.email}` : ""}
        {sedeInteres ? ` · le interesa ${sedeInteres}` : ""}
        {lead.origen === "api" ? ` · vía ${lead.fuente ?? "API"}` : ""}
        {lead.fuente === "mostrador" ? " · vino a averiguar" : ""}
        {lead.nota ? ` · ${lead.nota}` : ""}
      </p>
      {lead.estado === "prueba_agendada" && lead.pruebaFecha ? (
        <p className="mt-2 rounded-lg bg-alerta/10 px-3 py-2 text-xs font-medium text-alerta">
          Clase de prueba el {formatoFecha(lead.pruebaFecha)}
          {prueba ? ` · ${prueba.etiqueta}` : ""}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {lead.estado === "nuevo" ? (
          <form action={marcarContactado}>
            <input type="hidden" name="leadId" value={lead.id} />
            <button
              type="submit"
              className="rounded-full bg-tinta px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-tinta-suave"
            >
              ✓ Lo contacté
            </button>
          </form>
        ) : null}
        {lead.estado !== "nuevo" ? (
          <Link
            href={`/crm/${lead.id}/convertir`}
            className="rounded-full bg-marca px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-marca-oscuro"
          >
            Convertir en alumno
          </Link>
        ) : null}

        {lead.estado !== "prueba_agendada" ? (
          <details className="w-full sm:w-auto">
            <summary className="cursor-pointer text-xs font-medium text-tinta-suave">
              Agendar prueba…
            </summary>
            <FormAccion
              accion={agendarPrueba}
              textoBoton="Agendar"
              variante="secundario"
              className="mt-2 grid max-w-sm gap-2"
            >
              <input type="hidden" name="leadId" value={lead.id} />
              <Campo etiqueta="Clase">
                <Select name="horarioId" required>
                  {opciones.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.etiqueta}
                    </option>
                  ))}
                </Select>
              </Campo>
              <Campo etiqueta="Fecha">
                <Input name="fecha" type="date" required min={hoyISO()} />
              </Campo>
            </FormAccion>
          </details>
        ) : null}

        <details className="w-full sm:w-auto">
          <summary className="cursor-pointer text-xs font-medium text-peligro">
            Se perdió…
          </summary>
          <FormAccion
            accion={marcarPerdido}
            textoBoton="Marcar perdido"
            variante="peligro"
            className="mt-2 max-w-sm"
          >
            <input type="hidden" name="leadId" value={lead.id} />
            <Campo etiqueta="Motivo (obligatorio)">
              <Input name="motivo" required placeholder="Ej.: le quedaba lejos" />
            </Campo>
          </FormAccion>
        </details>
      </div>
    </li>
  );
}

export default async function PaginaCrm() {
  const usuario = await requerirSeccion("crm");
  const [todos, sedes, listaHorarios] = await Promise.all([
    db.query.leads.findMany({ orderBy: desc(leads.creadoEn) }),
    sedesVisibles(usuario),
    db
      .select({
        id: horarios.id,
        sedeId: horarios.sedeId,
        diaSemana: horarios.diaSemana,
        hora: horarios.hora,
        nota: horarios.nota,
        disciplina: disciplinas.nombre,
      })
      .from(horarios)
      .innerJoin(disciplinas, eq(horarios.disciplinaId, disciplinas.id))
      .where(eq(horarios.activo, true))
      .orderBy(asc(horarios.sedeId), asc(horarios.diaSemana), asc(horarios.hora)),
  ]);

  const nombreSede = (id: number) =>
    sedes.find((s) => s.id === id)?.nombre.replace("Sede ", "") ?? "";
  const opciones: HorarioOpcion[] = listaHorarios.map((h) => ({
    id: h.id,
    sedeId: h.sedeId,
    etiqueta: `${h.disciplina} · ${DIAS[h.diaSemana]} ${formatoHora(h.hora)}${
      h.nota ? ` (${h.nota})` : ""
    } · ${nombreSede(h.sedeId)}`,
  }));

  const porEstado = (estado: EstadoLead) =>
    todos.filter((l) => l.estado === estado);
  const conteos = Object.fromEntries(
    (Object.keys(ETIQUETA_ESTADO_LEAD) as EstadoLead[]).map((e) => [
      e,
      porEstado(e).length,
    ]),
  ) as Record<EstadoLead, number>;
  const tasa = tasaDeConversion(conteos);
  const abiertos: EstadoLead[] = ["nuevo", "contactado", "prueba_agendada"];

  return (
    <div>
      <EncabezadoSeccion
        titulo="Interesados"
        subtitulo="El embudo de todas las sedes, del primer mensaje a la conversión."
      >
        {/* Embudo de un vistazo */}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(ETIQUETA_ESTADO_LEAD) as EstadoLead[]).map((estado) => (
            <span
              key={estado}
              className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80 ring-1 ring-white/15"
            >
              {ETIQUETA_ESTADO_LEAD[estado]}:{" "}
              <strong className="text-white">{conteos[estado]}</strong>
            </span>
          ))}
          <span className="rounded-full bg-marca px-3 py-1.5 text-xs font-semibold text-white shadow-boton">
            Conversión: {tasa === null ? "—" : `${Math.round(tasa * 100)}%`}
          </span>
        </div>
      </EncabezadoSeccion>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div>
          {abiertos.map((estado) => {
            const lista = porEstado(estado);
            return (
              <section key={estado} className="mb-6">
                <h2 className="titulo-display text-2xl">
                  {ETIQUETA_ESTADO_LEAD[estado]} ({lista.length})
                </h2>
                {lista.length === 0 ? (
                  <p className="mt-2 tarjeta border-dashed px-4 py-5 text-center text-sm text-tinta-suave">
                    Nadie en este estado.
                  </p>
                ) : (
                  <ul className="mt-2 grid gap-3">
                    {lista.map((lead) => (
                      <TarjetaLead
                        key={lead.id}
                        lead={lead}
                        sedes={sedes}
                        opciones={opciones}
                      />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}

          {(["convertido", "perdido"] as EstadoLead[]).map((estado) => {
            const lista = porEstado(estado);
            if (lista.length === 0) return null;
            return (
              <details key={estado} className="mb-4">
                <summary className="cursor-pointer text-sm font-semibold text-tinta-suave">
                  {ETIQUETA_ESTADO_LEAD[estado]} ({lista.length})
                </summary>
                <ul className="mt-2 grid gap-1.5">
                  {lista.map((lead) => (
                    <li
                      key={lead.id}
                      className="rounded-xl border border-borde bg-superficie px-4 py-2.5 text-sm"
                    >
                      <span className="font-medium">{lead.nombre}</span>{" "}
                      <span className="text-xs text-tinta-suave">
                        {estado === "perdido"
                          ? `· ${lead.motivoPerdida ?? "sin motivo"}`
                          : lead.alumnoId
                            ? "· ya es alumno"
                            : ""}
                        {lead.origen === "api"
                          ? ` · vía ${lead.fuente ?? "API"}`
                          : ""}
                      </span>
                      {estado === "convertido" && lead.alumnoId ? (
                        <Link
                          href={`/alumnos/${lead.alumnoId}`}
                          className="ml-2 text-xs font-medium underline"
                        >
                          ver ficha
                        </Link>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </details>
            );
          })}
        </div>

        <section className="self-start tarjeta p-4">
          <h2 className="font-semibold">Nuevo interesado</h2>
          <FormAccion
            accion={crearLead}
            textoBoton="Agregar lead"
            className="mt-3 grid gap-3"
          >
            <Campo etiqueta="Nombre">
              <Input name="nombre" required placeholder="Sofía" />
            </Campo>
            <Campo etiqueta="Teléfono / WhatsApp">
              <Input name="telefono" required inputMode="tel" placeholder="381 555 0000" />
            </Campo>
            <Campo etiqueta="Sede de interés (opcional)">
              <Select name="sedeInteresId" defaultValue="">
                <option value="">No sabe todavía</option>
                {sedes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </Select>
            </Campo>
            <Campo etiqueta="Email (opcional)">
              <Input name="email" type="email" />
            </Campo>
            <Campo etiqueta="Nota (opcional)">
              <Input name="nota" placeholder="Ej.: preguntó por pole" />
            </Campo>
          </FormAccion>
        </section>
      </div>
    </div>
  );
}
