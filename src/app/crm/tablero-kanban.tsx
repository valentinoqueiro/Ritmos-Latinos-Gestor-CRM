"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  ETIQUETA_ESTADO_LEAD,
  puedeTransicionar,
  tasaDeConversion,
  type EstadoLead,
} from "@/lib/reglas-leads";
import { Campo, Input, Select } from "@/componentes/campos";
import { IconoCerrar, IconoFrio } from "@/componentes/iconos";
import { FormAccion } from "@/componentes/form-accion";
import { agendarPrueba, crearLead, marcarPerdido, moverLead } from "./acciones";

export type LeadDeTablero = {
  id: number;
  nombre: string;
  estado: EstadoLead;
  disciplinas: { id: number; nombre: string; sede: string }[];
  origen: string | null;
  campana: string | null;
  viaApi: string | null;
  diasEnEtapa: number;
  frio: boolean;
  pruebaFecha: string | null;
  motivoPerdida: string | null;
  alumnoId: number | null;
  whatsapp: string;
};

const COLUMNAS: EstadoLead[] = [
  "nuevo",
  "contactado",
  "prueba_agendada",
  "convertido",
  "perdido",
];
const ABIERTAS: EstadoLead[] = ["nuevo", "contactado", "prueba_agendada"];

function formatoFechaCorta(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

// --- Tarjeta -----------------------------------------------------------------

function ContenidoTarjeta({ lead }: { lead: LeadDeTablero }) {
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate font-semibold leading-snug">
          {lead.nombre}
        </p>
        {lead.frio ? (
          <span
            className="flex shrink-0 items-center gap-1 rounded-full bg-alerta/15 px-2 py-0.5 text-xs font-bold text-alerta"
            title={`Sin moverse hace ${lead.diasEnEtapa} días`}
          >
            <IconoFrio className="h-3.5 w-3.5" aria-hidden />
            frío
          </span>
        ) : null}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {lead.disciplinas.length === 0 ? (
          <span className="rounded-full bg-alerta/10 px-2 py-0.5 text-xs font-medium text-alerta">
            sin disciplina
          </span>
        ) : (
          lead.disciplinas.map((d) => (
            <span
              key={d.id}
              className="rounded-full bg-fondo px-2 py-0.5 text-xs font-medium text-tinta-suave ring-1 ring-borde"
              title={`Sede ${d.sede}`}
            >
              {d.nombre}
            </span>
          ))
        )}
      </div>
      {lead.estado === "prueba_agendada" && lead.pruebaFecha ? (
        <p className="mt-1.5 rounded-md bg-alerta/10 px-2 py-1 text-xs font-medium text-alerta">
          Prueba el {formatoFechaCorta(lead.pruebaFecha)}
        </p>
      ) : null}
      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-tinta-suave">
        <span className="min-w-0 truncate">
          {lead.origen ?? "sin origen"}
          {lead.campana ? ` · ${lead.campana}` : ""}
          {lead.viaApi ? ` · vía ${lead.viaApi}` : ""}
        </span>
        <span className="shrink-0 tabular-nums">
          {lead.diasEnEtapa === 0 ? "hoy" : `hace ${lead.diasEnEtapa} d`}
        </span>
      </div>
    </>
  );
}

function Tarjeta({
  lead,
  onAccion,
}: {
  lead: LeadDeTablero;
  onAccion: (accion: EstadoLead, lead: LeadDeTablero) => void;
}) {
  const arrastrable = ABIERTAS.includes(lead.estado);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
    disabled: !arrastrable,
  });
  const destinos = COLUMNAS.filter(
    (e) => e !== lead.estado && puedeTransicionar(lead.estado, e),
  );

  return (
    <li
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`rounded-xl bg-superficie p-3 text-tinta shadow-tarjeta ring-1 ring-black/5 ${
        arrastrable ? "cursor-grab touch-manipulation active:cursor-grabbing" : ""
      } ${isDragging ? "opacity-30" : ""}`}
    >
      <ContenidoTarjeta lead={lead} />
      <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-borde pt-2">
        <Link
          href={`/crm/${lead.id}`}
          className="rounded-md px-2.5 py-2 text-xs font-semibold text-tinta transition hover:bg-fondo"
        >
          Ficha
        </Link>
        <a
          href={lead.whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md px-2.5 py-2 text-xs font-semibold text-ok transition hover:bg-ok/10"
        >
          WhatsApp
        </a>
        {destinos.length > 0 ? (
          /* Fallback táctil: mover sin arrastrar (celular). */
          <details className="ml-auto w-full sm:w-auto">
            <summary className="cursor-pointer list-none rounded-md px-2.5 py-2 text-right text-xs font-semibold text-tinta-suave transition hover:bg-fondo">
              Mover ▾
            </summary>
            <div className="mt-1 rounded-xl border border-borde bg-fondo p-1">
              {destinos.map((destino) => (
                <button
                  key={destino}
                  type="button"
                  onClick={(e) => {
                    (e.currentTarget.closest("details") as HTMLDetailsElement).open = false;
                    onAccion(destino, lead);
                  }}
                  className="block w-full cursor-pointer rounded-lg px-2.5 py-2.5 text-left text-xs font-medium transition hover:bg-fondo"
                >
                  → {ETIQUETA_ESTADO_LEAD[destino]}
                </button>
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </li>
  );
}

function TarjetaCerrada({ lead }: { lead: LeadDeTablero }) {
  return (
    <li className="rounded-xl bg-white/5 p-3 text-sm text-white/90 ring-1 ring-white/10">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/crm/${lead.id}`}
          className="min-w-0 truncate font-medium text-white hover:underline"
        >
          {lead.nombre}
        </Link>
      </div>
      <p className="mt-0.5 truncate text-xs text-white/70">
        {lead.estado === "perdido"
          ? (lead.motivoPerdida ?? "sin motivo")
          : "ya es alumno"}
      </p>
    </li>
  );
}

// --- Columna -------------------------------------------------------------------

function Columna({
  estado,
  tarjetas,
  onAccion,
}: {
  estado: EstadoLead;
  tarjetas: LeadDeTablero[];
  onAccion: (accion: EstadoLead, lead: LeadDeTablero) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: estado });
  const abierta = ABIERTAS.includes(estado);
  return (
    <section
      ref={setNodeRef}
      className={`flex w-[82vw] shrink-0 snap-start flex-col rounded-2xl transition sm:w-72 ${
        isOver ? "bg-white/15 ring-2 ring-marca" : "bg-white/[0.06] ring-1 ring-white/10"
      }`}
    >
      <header className="flex items-baseline justify-between px-4 pb-2 pt-3">
        <h2 className="titulo-display text-xl text-white">
          {ETIQUETA_ESTADO_LEAD[estado]}
        </h2>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
            abierta ? "bg-marca text-white" : "bg-white/10 text-white/60"
          }`}
        >
          {tarjetas.length}
        </span>
      </header>
      <ul className="flex max-h-[68vh] min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-2.5 pb-3">
        {tarjetas.length === 0 ? (
          <li className="rounded-xl border border-dashed border-white/15 px-3 py-5 text-center text-xs text-white/60">
            {isOver ? "Soltá acá" : "Vacío"}
          </li>
        ) : abierta ? (
          tarjetas.map((l) => <Tarjeta key={l.id} lead={l} onAccion={onAccion} />)
        ) : (
          tarjetas.map((l) => <TarjetaCerrada key={l.id} lead={l} />)
        )}
      </ul>
    </section>
  );
}

// --- Modales -------------------------------------------------------------------

function Modal({
  titulo,
  onCerrar,
  children,
}: {
  titulo: string;
  onCerrar: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-tinta/60 p-4 backdrop-blur-sm sm:items-center"
      onClick={onCerrar}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-superficie p-5 shadow-tarjeta-alta"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="titulo-display text-2xl">{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-tinta-suave transition hover:bg-fondo"
          >
            <IconoCerrar className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}

type Pendiente =
  | { tipo: "perder"; lead: LeadDeTablero }
  | { tipo: "prueba"; lead: LeadDeTablero }
  | { tipo: "convertir"; lead: LeadDeTablero }
  | { tipo: "alta" };

// --- Tablero -------------------------------------------------------------------

type OpcionHorario = { id: number; disciplinaId: number; etiqueta: string };
type OpcionDisciplina = { id: number; etiqueta: string };

/**
 * Elegir la clase de prueba en dos pasos: disciplina primero (las de interés
 * del lead arriba y marcadas), horarios filtrados después. Sin esto el
 * desplegable tiraba TODOS los horarios de todas las sedes de una.
 */
function CamposClaseDePrueba({
  lead,
  opcionesDisciplina,
  opcionesHorario,
  hoy,
}: {
  lead: LeadDeTablero;
  opcionesDisciplina: OpcionDisciplina[];
  opcionesHorario: OpcionHorario[];
  hoy: string;
}) {
  const leInteresa = new Set(lead.disciplinas.map((d) => d.id));
  const ordenadas = [...opcionesDisciplina].sort(
    (a, b) => Number(leInteresa.has(b.id)) - Number(leInteresa.has(a.id)),
  );
  const [disciplinaId, setDisciplinaId] = useState<number | null>(
    lead.disciplinas[0]?.id ?? null,
  );
  const clases = opcionesHorario.filter((h) => h.disciplinaId === disciplinaId);

  return (
    <>
      <Campo etiqueta="Disciplina">
        <Select
          value={disciplinaId ?? ""}
          onChange={(e) =>
            setDisciplinaId(e.target.value === "" ? null : Number(e.target.value))
          }
          required
        >
          <option value="" disabled>
            Elegí la disciplina
          </option>
          {ordenadas.map((d) => (
            <option key={d.id} value={d.id}>
              {d.etiqueta}
              {leInteresa.has(d.id) ? " — le interesaba" : ""}
            </option>
          ))}
        </Select>
      </Campo>
      <Campo etiqueta="Clase">
        {/* key: al cambiar de disciplina se descarta la elección anterior */}
        <Select name="horarioId" key={disciplinaId ?? "sin"} required disabled={disciplinaId === null}>
          {disciplinaId === null ? (
            <option value="">Primero elegí la disciplina</option>
          ) : clases.length === 0 ? (
            <option value="">Esta disciplina no tiene horarios activos</option>
          ) : (
            clases.map((o) => (
              <option key={o.id} value={o.id}>
                {o.etiqueta}
              </option>
            ))
          )}
        </Select>
      </Campo>
      <Campo etiqueta="Fecha">
        <Input name="fecha" type="date" required min={hoy} />
      </Campo>
    </>
  );
}

export function TableroKanban({
  tarjetas,
  umbralFrio,
  hoy,
  opcionesHorario,
  opcionesDisciplina,
  opcionesOrigen,
}: {
  tarjetas: LeadDeTablero[];
  umbralFrio: number;
  hoy: string;
  opcionesHorario: OpcionHorario[];
  opcionesDisciplina: OpcionDisciplina[];
  opcionesOrigen: { id: number; nombre: string }[];
}) {
  const router = useRouter();
  const [, arrancarTransicion] = useTransition();
  // Estado local del tablero: refleja los props del server y se pisa
  // optimistamente al arrastrar; si la acción falla, se revierte. La
  // sincronización con props nuevos se hace durante el render (patrón
  // "derived state"), no en un efecto.
  const [lista, setLista] = useState(tarjetas);
  const [tarjetasPrevias, setTarjetasPrevias] = useState(tarjetas);
  if (tarjetas !== tarjetasPrevias) {
    setTarjetasPrevias(tarjetas);
    setLista(tarjetas);
  }

  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState<LeadDeTablero | null>(null);
  const [soloSinDisciplina, setSoloSinDisciplina] = useState(false);
  // Filtros combinables por origen y campaña (comparar campañas de anuncios).
  const [filtroOrigen, setFiltroOrigen] = useState<string | null>(null);
  const [filtroCampana, setFiltroCampana] = useState<string | null>(null);

  const sensores = useSensors(
    // Distancia mínima para no confundir taps/clicks con arrastres.
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  // Opciones de filtro: solo valores presentes en el tablero (un filtro que
  // no filtra nada no ayuda a nadie).
  const origenesEnTablero = [
    ...new Set(lista.map((l) => l.origen).filter((o): o is string => o !== null)),
  ].sort((a, b) => a.localeCompare(b));
  const campanasEnTablero = [
    ...new Set(lista.map((l) => l.campana).filter((c): c is string => c !== null)),
  ].sort((a, b) => a.localeCompare(b));

  const visibles = lista.filter(
    (l) =>
      (!soloSinDisciplina || l.disciplinas.length === 0) &&
      (filtroOrigen === null || l.origen === filtroOrigen) &&
      (filtroCampana === null || l.campana === filtroCampana),
  );
  const hayFiltros =
    soloSinDisciplina || filtroOrigen !== null || filtroCampana !== null;
  const porEstado = (estado: EstadoLead) =>
    visibles.filter((l) => l.estado === estado);

  const conteos = useMemo(() => {
    const c: Partial<Record<EstadoLead, number>> = {};
    for (const l of lista) c[l.estado] = (c[l.estado] ?? 0) + 1;
    return c;
  }, [lista]);
  const tasa = tasaDeConversion(conteos);
  const frios = lista.filter((l) => l.frio).length;
  const sinDisciplina = lista.filter((l) => l.disciplinas.length === 0).length;

  function moverOptimista(lead: LeadDeTablero, destino: EstadoLead) {
    const anterior = lista;
    setLista((ls) =>
      ls.map((l) =>
        l.id === lead.id
          ? { ...l, estado: destino, diasEnEtapa: 0, frio: false }
          : l,
      ),
    );
    arrancarTransicion(async () => {
      const fd = new FormData();
      fd.set("leadId", String(lead.id));
      fd.set("destino", destino);
      const resultado = await moverLead({}, fd);
      if (resultado.error) {
        setLista(anterior);
        setAviso(resultado.error);
      } else {
        router.refresh();
      }
    });
  }

  function ejecutarMovimiento(destino: EstadoLead, lead: LeadDeTablero) {
    setAviso(null);
    if (!puedeTransicionar(lead.estado, destino)) {
      setAviso(
        destino === "convertido"
          ? `Antes de convertir a ${lead.nombre} marcalo como contactado.`
          : `No se puede pasar de "${ETIQUETA_ESTADO_LEAD[lead.estado]}" a "${ETIQUETA_ESTADO_LEAD[destino]}".`,
      );
      return;
    }
    if (destino === "nuevo" || destino === "contactado") {
      moverOptimista(lead, destino);
    } else if (destino === "prueba_agendada") {
      setPendiente({ tipo: "prueba", lead });
    } else if (destino === "perdido") {
      setPendiente({ tipo: "perder", lead });
    } else {
      setPendiente({ tipo: "convertir", lead });
    }
  }

  function alSoltar(evento: DragEndEvent) {
    setArrastrando(null);
    const lead = lista.find((l) => l.id === evento.active.id);
    const destino = evento.over?.id as EstadoLead | undefined;
    if (!lead || !destino || destino === lead.estado) return;
    ejecutarMovimiento(destino, lead);
  }

  function alAgarrar(evento: DragStartEvent) {
    setArrastrando(lista.find((l) => l.id === evento.active.id) ?? null);
  }

  function cerrarModal(refrescar: boolean) {
    setPendiente(null);
    if (refrescar) router.refresh();
  }

  return (
    <div>
      {/* Cabecera del pipeline: números vivos + acciones */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="titulo-display text-4xl">Pipeline</h1>
          <p className="mt-0.5 text-sm text-tinta-suave">
            Arrastrá las tarjetas entre etapas, o usá «Mover» desde el celular.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {frios > 0 ? (
            <span className="flex items-center gap-1 rounded-full bg-alerta/10 px-3 py-1.5 text-xs font-semibold text-alerta">
              <IconoFrio className="h-3.5 w-3.5" aria-hidden />
              {frios} {frios === 1 ? "frío" : "fríos"} (+{umbralFrio} días quietos)
            </span>
          ) : null}
          {sinDisciplina > 0 ? (
            <button
              type="button"
              onClick={() => setSoloSinDisciplina((v) => !v)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                soloSinDisciplina
                  ? "bg-marca text-white shadow-boton"
                  : "bg-marca-suave text-marca-oscuro hover:bg-marca/20"
              }`}
            >
              {sinDisciplina} sin disciplina {soloSinDisciplina ? "· ver todos" : "· clasificar"}
            </button>
          ) : null}
          <span className="rounded-full bg-tinta px-3 py-1.5 text-xs font-semibold text-white">
            Conversión: {tasa === null ? "—" : `${Math.round(tasa * 100)}%`}
          </span>
          <button
            type="button"
            onClick={() => setPendiente({ tipo: "alta" })}
            className="boton-primario"
          >
            + Interesado
          </button>
        </div>
      </div>

      {/* Filtros del tablero: origen y campaña (combinables entre sí y con
          «sin disciplina»). Solo aparecen si hay algo que filtrar. */}
      {origenesEnTablero.length > 0 || campanasEnTablero.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-tinta-suave">
            Filtrar
          </span>
          {origenesEnTablero.length > 0 ? (
            <select
              value={filtroOrigen ?? ""}
              onChange={(e) => setFiltroOrigen(e.target.value === "" ? null : e.target.value)}
              aria-label="Filtrar por origen"
              className={`h-9 cursor-pointer rounded-full px-3 text-xs font-semibold ring-1 transition ${
                filtroOrigen !== null
                  ? "bg-marca text-white ring-marca"
                  : "bg-superficie text-tinta ring-borde hover:bg-fondo"
              }`}
            >
              <option value="">Origen · todos</option>
              {origenesEnTablero.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : null}
          {campanasEnTablero.length > 0 ? (
            <select
              value={filtroCampana ?? ""}
              onChange={(e) => setFiltroCampana(e.target.value === "" ? null : e.target.value)}
              aria-label="Filtrar por campaña"
              className={`h-9 cursor-pointer rounded-full px-3 text-xs font-semibold ring-1 transition ${
                filtroCampana !== null
                  ? "bg-marca text-white ring-marca"
                  : "bg-superficie text-tinta ring-borde hover:bg-fondo"
              }`}
            >
              <option value="">Campaña · todas</option>
              {campanasEnTablero.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          ) : null}
          {hayFiltros ? (
            <button
              type="button"
              onClick={() => {
                setFiltroOrigen(null);
                setFiltroCampana(null);
                setSoloSinDisciplina(false);
              }}
              className="flex h-9 items-center gap-1 rounded-full px-3 text-xs font-semibold text-tinta-suave transition hover:bg-fondo"
            >
              <IconoCerrar className="h-3 w-3" aria-hidden />
              Limpiar · viendo {visibles.length} de {lista.length}
            </button>
          ) : null}
        </div>
      ) : null}

      {aviso ? (
        <p
          role="alert"
          className="mt-3 rounded-xl bg-marca-suave px-4 py-2.5 text-sm font-medium text-marca-oscuro"
        >
          {aviso}
        </p>
      ) : null}

      {/* El tablero: backstage oscuro, columnas de vidrio, tarjetas claras */}
      <div className="banner-seccion mt-4 p-3 sm:p-4">
        <DndContext sensors={sensores} onDragStart={alAgarrar} onDragEnd={alSoltar}>
          <div className="relative flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1">
            {COLUMNAS.map((estado) => (
              <Columna
                key={estado}
                estado={estado}
                tarjetas={porEstado(estado)}
                onAccion={ejecutarMovimiento}
              />
            ))}
          </div>
          <DragOverlay>
            {arrastrando ? (
              <div className="w-64 rotate-2 rounded-xl bg-superficie p-3 text-tinta shadow-tarjeta-alta ring-2 ring-marca">
                <ContenidoTarjeta lead={arrastrando} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Modales de transiciones con datos */}
      {pendiente?.tipo === "perder" ? (
        <Modal titulo="Se perdió" onCerrar={() => cerrarModal(false)}>
          <p className="text-sm text-tinta-suave">
            {pendiente.lead.nombre} sale del pipeline. El motivo queda en el
            historial para aprender de las pérdidas.
          </p>
          <FormAccion
            accion={marcarPerdido}
            textoBoton="Marcar perdido"
            variante="peligro"
            className="mt-3"
            alCompletar={() => cerrarModal(true)}
          >
            <input type="hidden" name="leadId" value={pendiente.lead.id} />
            <Campo etiqueta="Motivo (obligatorio)">
              <Input name="motivo" required placeholder="Ej.: le quedaba lejos" />
            </Campo>
          </FormAccion>
        </Modal>
      ) : null}

      {pendiente?.tipo === "prueba" ? (
        <Modal titulo="Clase de prueba" onCerrar={() => cerrarModal(false)}>
          <FormAccion
            accion={agendarPrueba}
            textoBoton="Agendar prueba"
            className="grid gap-3"
            alCompletar={() => cerrarModal(true)}
          >
            <input type="hidden" name="leadId" value={pendiente.lead.id} />
            <CamposClaseDePrueba
              lead={pendiente.lead}
              opcionesDisciplina={opcionesDisciplina}
              opcionesHorario={opcionesHorario}
              hoy={hoy}
            />
          </FormAccion>
        </Modal>
      ) : null}

      {pendiente?.tipo === "convertir" ? (
        <Modal titulo="Convertir en alumno" onCerrar={() => cerrarModal(false)}>
          <p className="text-sm text-tinta-suave">
            {pendiente.lead.nombre} pasa al gestor: se crea su ficha de alumno
            con los datos precargados y seguís directo con la suscripción.
          </p>
          <Link
            href={`/crm/${pendiente.lead.id}/convertir`}
            className="boton-primario mt-4 w-full"
          >
            Completar ficha y convertir →
          </Link>
        </Modal>
      ) : null}

      {pendiente?.tipo === "alta" ? (
        <Modal titulo="Nuevo interesado" onCerrar={() => cerrarModal(false)}>
          <FormAccion
            accion={crearLead}
            textoBoton="Agregar al pipeline"
            className="grid gap-3"
            alCompletar={() => cerrarModal(true)}
          >
            <Campo etiqueta="Nombre">
              <Input name="nombre" required placeholder="Sofía" />
            </Campo>
            <Campo etiqueta="Teléfono / WhatsApp">
              <Input name="telefono" required inputMode="tel" placeholder="381 555 0000" />
            </Campo>
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1.5 text-sm font-medium">
                Disciplinas de interés (definen la sede)
              </legend>
              <div className="grid max-h-40 gap-1 overflow-y-auto rounded-lg border border-borde p-2">
                {opcionesDisciplina.map((d) => (
                  <label key={d.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="disciplinaIds"
                      value={d.id}
                      className="h-4 w-4 accent-marca"
                    />
                    {d.etiqueta}
                  </label>
                ))}
              </div>
            </fieldset>
            <Campo etiqueta="¿De dónde vino?">
              <Select name="origenNegocioId" defaultValue="">
                <option value="">No se sabe</option>
                {opcionesOrigen.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nombre}
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
        </Modal>
      ) : null}
    </div>
  );
}
