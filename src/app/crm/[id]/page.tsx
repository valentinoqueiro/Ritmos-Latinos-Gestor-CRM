import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  disciplinas,
  horarios,
  leadActividades,
  leadDisciplinas,
  leads,
  origenesNegocio,
  usuarios,
} from "@/db/schema";
import { requerirSeccion } from "@/lib/auth/guards";
import { formatoFecha, ZONA_HORARIA } from "@/lib/fechas";
import {
  CLAVE_MENSAJE_INTERESADOS,
  MENSAJE_INTERESADOS_DEFAULT,
  linkWhatsApp,
  renderizarPlantilla,
} from "@/lib/mensajes";
import { DIAS, formatoHora } from "@/lib/operativa";
import {
  ETIQUETA_ESTADO_LEAD,
  esEstadoFinal,
  puedeTransicionar,
} from "@/lib/reglas-leads";
import { configuracion } from "@/db/schema";
import { sedesVisibles } from "@/lib/sedes";
import { Campo, Input, Select } from "@/componentes/campos";
import { FormAccion } from "@/componentes/form-accion";
import { agregarNota, guardarInteresesLead } from "../acciones";

export const metadata: Metadata = { title: "Ficha del lead" };

const ETIQUETA_CANAL: Record<string, string> = {
  whatsapp: "WhatsApp",
  llamada: "Llamada",
  presencial: "Presencial",
  otro: "Otro",
};

function formatoFechaHora(fecha: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: ZONA_HORARIA,
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(fecha);
}

export default async function PaginaFichaLead({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await requerirSeccion("crm");
  const { id } = await params;
  const leadId = Number(id);
  if (!Number.isInteger(leadId)) notFound();

  const lead = await db.query.leads.findFirst({ where: eq(leads.id, leadId) });
  if (!lead) notFound();

  const [
    intereses,
    catalogo,
    origenes,
    actividades,
    filaMensaje,
    sedes,
    prueba,
  ] = await Promise.all([
    db
      .select({ disciplinaId: disciplinas.id, nombre: disciplinas.nombre, sedeId: disciplinas.sedeId })
      .from(leadDisciplinas)
      .innerJoin(disciplinas, eq(leadDisciplinas.disciplinaId, disciplinas.id))
      .where(eq(leadDisciplinas.leadId, lead.id)),
    db.query.disciplinas.findMany({
      where: eq(disciplinas.activa, true),
      orderBy: asc(disciplinas.nombre),
    }),
    db.query.origenesNegocio.findMany({
      where: eq(origenesNegocio.activo, true),
      orderBy: asc(origenesNegocio.id),
    }),
    db
      .select({
        id: leadActividades.id,
        tipo: leadActividades.tipo,
        canal: leadActividades.canal,
        detalle: leadActividades.detalle,
        creadoEn: leadActividades.creadoEn,
        registradoPor: usuarios.nombre,
      })
      .from(leadActividades)
      .leftJoin(usuarios, eq(leadActividades.registradoPorId, usuarios.id))
      .where(eq(leadActividades.leadId, lead.id))
      .orderBy(desc(leadActividades.creadoEn)),
    db.query.configuracion.findFirst({
      where: eq(configuracion.clave, CLAVE_MENSAJE_INTERESADOS),
    }),
    sedesVisibles(usuario),
    lead.pruebaHorarioId
      ? db
          .select({
            diaSemana: horarios.diaSemana,
            hora: horarios.hora,
            disciplina: disciplinas.nombre,
          })
          .from(horarios)
          .innerJoin(disciplinas, eq(horarios.disciplinaId, disciplinas.id))
          .where(eq(horarios.id, lead.pruebaHorarioId))
          .then((filas) => filas[0] ?? null)
      : null,
  ]);

  const plantilla = filaMensaje?.valor ?? MENSAJE_INTERESADOS_DEFAULT;
  const whatsapp = linkWhatsApp(
    lead.telefono,
    renderizarPlantilla(plantilla, { nombre: lead.nombre }),
  );
  const nombreSede = (sedeId: number) =>
    sedes.find((s) => s.id === sedeId)?.nombre.replace("Sede ", "") ?? "";
  const sedesDerivadas = [...new Set(intereses.map((i) => nombreSede(i.sedeId)))];
  const elegidas = new Set(intereses.map((i) => i.disciplinaId));

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-sm text-tinta-suave">
        <Link href="/crm" className="underline">
          ← Pipeline
        </Link>
      </p>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="titulo-display text-4xl">{lead.nombre}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            <span
              className={`rounded-full px-2.5 py-1 font-semibold ${
                esEstadoFinal(lead.estado)
                  ? "bg-borde text-tinta-suave"
                  : "bg-marca text-white"
              }`}
            >
              {ETIQUETA_ESTADO_LEAD[lead.estado]}
            </span>
            {sedesDerivadas.map((s) => (
              <span
                key={s}
                className="rounded-full bg-tinta px-2.5 py-1 font-medium text-white"
              >
                {s}
              </span>
            ))}
            {lead.estado === "prueba_agendada" && lead.pruebaFecha ? (
              <span className="rounded-full bg-alerta/10 px-2.5 py-1 font-medium text-alerta">
                Prueba el {formatoFecha(lead.pruebaFecha)}
                {prueba
                  ? ` · ${prueba.disciplina} ${DIAS[prueba.diaSemana]} ${formatoHora(prueba.hora)}`
                  : ""}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl bg-ok px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
          >
            WhatsApp con mensaje
          </a>
          {puedeTransicionar(lead.estado, "convertido") ? (
            <Link href={`/crm/${lead.id}/convertir`} className="boton-primario">
              Convertir en alumno
            </Link>
          ) : null}
          {lead.estado === "convertido" && lead.alumnoId ? (
            <Link href={`/alumnos/${lead.alumnoId}`} className="boton-secundario">
              Ver ficha de alumno
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <div className="grid content-start gap-4">
          {/* Datos de contacto */}
          <section className="tarjeta p-4">
            <h2 className="text-sm font-semibold text-tinta-suave">Datos</h2>
            <dl className="mt-2 grid gap-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-tinta-suave">Teléfono</dt>
                <dd className="font-medium">{lead.telefono}</dd>
              </div>
              {lead.email ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-tinta-suave">Email</dt>
                  <dd className="min-w-0 truncate font-medium">{lead.email}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-3">
                <dt className="text-tinta-suave">Cargado</dt>
                <dd className="font-medium">
                  {formatoFechaHora(lead.creadoEn)}
                  {lead.origen === "api" ? ` · vía ${lead.fuente ?? "API"}` : ""}
                  {lead.fuente === "mostrador" ? " · mostrador" : ""}
                </dd>
              </div>
              {lead.nota ? (
                <div>
                  <dt className="text-tinta-suave">Nota de captura</dt>
                  <dd className="mt-0.5 rounded-lg bg-fondo px-2.5 py-1.5">
                    {lead.nota}
                  </dd>
                </div>
              ) : null}
              {lead.motivoPerdida ? (
                <div>
                  <dt className="text-tinta-suave">Motivo de pérdida</dt>
                  <dd className="mt-0.5 rounded-lg bg-marca-suave px-2.5 py-1.5 text-marca-oscuro">
                    {lead.motivoPerdida}
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>

          {/* Clasificación: disciplinas (derivan la sede) + origen */}
          <section className="tarjeta p-4">
            <h2 className="text-sm font-semibold text-tinta-suave">
              Interés y origen
            </h2>
            <p className="mt-1 text-xs text-tinta-suave">
              Las disciplinas definen la sede del lead y alimentan las métricas.
            </p>
            <FormAccion
              accion={guardarInteresesLead}
              textoBoton="Guardar"
              variante="secundario"
              className="mt-3 grid gap-3"
            >
              <input type="hidden" name="leadId" value={lead.id} />
              <fieldset className="flex flex-col gap-1.5">
                <legend className="mb-1.5 text-sm font-medium">
                  Disciplinas de interés
                </legend>
                <div className="grid max-h-44 gap-1 overflow-y-auto rounded-lg border border-borde p-2">
                  {catalogo.map((d) => (
                    <label key={d.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="disciplinaIds"
                        value={d.id}
                        defaultChecked={elegidas.has(d.id)}
                        className="h-4 w-4 accent-marca"
                      />
                      {d.nombre}
                      <span className="text-xs text-tinta-suave">
                        · {nombreSede(d.sedeId)}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <Campo etiqueta="¿De dónde vino?">
                <Select
                  name="origenNegocioId"
                  defaultValue={lead.origenNegocioId ?? ""}
                >
                  <option value="">Sin clasificar</option>
                  {origenes.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nombre}
                    </option>
                  ))}
                </Select>
              </Campo>
            </FormAccion>
          </section>
        </div>

        {/* Historial de actividad */}
        <section className="tarjeta p-4">
          <h2 className="text-sm font-semibold text-tinta-suave">
            Actividad ({actividades.length})
          </h2>

          <FormAccion
            accion={agregarNota}
            textoBoton="Agregar nota"
            variante="secundario"
            className="mt-3 rounded-xl bg-fondo p-3"
          >
            <input type="hidden" name="leadId" value={lead.id} />
            <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
              <Campo etiqueta="Canal">
                <Select name="canal" defaultValue="whatsapp">
                  {Object.entries(ETIQUETA_CANAL).map(([valor, etiqueta]) => (
                    <option key={valor} value={valor}>
                      {etiqueta}
                    </option>
                  ))}
                </Select>
              </Campo>
              <Campo etiqueta="Qué se habló">
                <Input
                  name="detalle"
                  required
                  placeholder="Ej.: le pasé precios, avisa el lunes"
                />
              </Campo>
            </div>
          </FormAccion>

          <ol className="mt-4 grid gap-0">
            {actividades.map((a) => (
              <li
                key={a.id}
                className="relative border-l-2 border-borde pb-4 pl-4 last:pb-0"
              >
                <span
                  className={`absolute -left-[5px] top-1.5 h-2 w-2 rounded-full ${
                    a.tipo === "nota" ? "bg-marca" : "bg-borde"
                  }`}
                />
                <p className="text-xs text-tinta-suave">
                  {formatoFechaHora(a.creadoEn)}
                  {a.canal ? ` · ${ETIQUETA_CANAL[a.canal]}` : ""}
                  {a.registradoPor ? ` · ${a.registradoPor}` : ""}
                </p>
                <p className={`mt-0.5 text-sm ${a.tipo === "nota" ? "font-medium" : "text-tinta-suave"}`}>
                  {a.detalle}
                </p>
              </li>
            ))}
            <li className="relative border-l-2 border-transparent pl-4">
              <span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-borde" />
              <p className="text-xs text-tinta-suave">
                {formatoFechaHora(lead.creadoEn)}
              </p>
              <p className="mt-0.5 text-sm text-tinta-suave">
                Lead creado
                {lead.origen === "api"
                  ? ` vía ${lead.fuente ?? "API"}`
                  : lead.fuente === "mostrador"
                    ? " en el mostrador"
                    : ""}
              </p>
            </li>
          </ol>
        </section>
      </div>
    </div>
  );
}
