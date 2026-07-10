import type { Metadata } from "next";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  campanas,
  configuracion,
  disciplinas,
  horarios,
  leadDisciplinas,
  leads,
  origenesNegocio,
} from "@/db/schema";
import { requerirSeccion } from "@/lib/auth/guards";
import { hoyISO } from "@/lib/fechas";
import {
  CLAVE_MENSAJE_INTERESADOS,
  CLAVE_MENSAJE_RECORDATORIO_PRUEBA,
  MENSAJE_INTERESADOS_DEFAULT,
  MENSAJE_RECORDATORIO_PRUEBA_DEFAULT,
  linkWhatsApp,
  renderizarPlantilla,
} from "@/lib/mensajes";
import { DIAS, formatoHora } from "@/lib/operativa";
import {
  CLAVE_UMBRAL_LEAD_FRIO,
  UMBRAL_LEAD_FRIO_DEFAULT,
  diasEnEtapa,
  esLeadFrio,
  recordatorioDePrueba,
} from "@/lib/reglas-crm";
import { sedesVisibles } from "@/lib/sedes";
import { TableroKanban, type LeadDeTablero } from "./tablero-kanban";

export const metadata: Metadata = { title: "CRM" };

// El CRM es el pipeline de ventas de la admin: un tablero kanban aparte del
// gestor operativo. Los datos se arman acá (server) y el tablero (client)
// solo arrastra y dispara acciones validadas en backend.
export default async function PaginaCrm() {
  const usuario = await requerirSeccion("crm");
  const [
    todos,
    sedes,
    catalogoDisciplinas,
    origenes,
    listaHorarios,
    filas,
    catalogoCampanas,
  ] = await Promise.all([
      db.query.leads.findMany({ orderBy: desc(leads.creadoEn) }),
      sedesVisibles(usuario),
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
          id: horarios.id,
          sedeId: horarios.sedeId,
          diaSemana: horarios.diaSemana,
          hora: horarios.hora,
          nota: horarios.nota,
          disciplinaId: horarios.disciplinaId,
          disciplina: disciplinas.nombre,
        })
        .from(horarios)
        .innerJoin(disciplinas, eq(horarios.disciplinaId, disciplinas.id))
        .where(eq(horarios.activo, true))
        .orderBy(asc(horarios.sedeId), asc(horarios.diaSemana), asc(horarios.hora)),
      db.query.configuracion.findMany({
        where: inArray(configuracion.clave, [
          CLAVE_UMBRAL_LEAD_FRIO,
          CLAVE_MENSAJE_INTERESADOS,
          CLAVE_MENSAJE_RECORDATORIO_PRUEBA,
        ]),
      }),
      db.query.campanas.findMany({ orderBy: asc(campanas.nombre) }),
    ]);

  const interesesDeLeads =
    todos.length === 0
      ? []
      : await db
          .select({
            leadId: leadDisciplinas.leadId,
            disciplinaId: disciplinas.id,
            disciplina: disciplinas.nombre,
            sedeId: disciplinas.sedeId,
          })
          .from(leadDisciplinas)
          .innerJoin(disciplinas, eq(leadDisciplinas.disciplinaId, disciplinas.id))
          .where(
            inArray(
              leadDisciplinas.leadId,
              todos.map((l) => l.id),
            ),
          );

  const valorConfig = (clave: string) =>
    filas.find((f) => f.clave === clave)?.valor;
  const umbralFrio =
    Number(valorConfig(CLAVE_UMBRAL_LEAD_FRIO)) || UMBRAL_LEAD_FRIO_DEFAULT;
  const plantilla =
    valorConfig(CLAVE_MENSAJE_INTERESADOS) ?? MENSAJE_INTERESADOS_DEFAULT;
  const plantillaRecordatorio =
    valorConfig(CLAVE_MENSAJE_RECORDATORIO_PRUEBA) ??
    MENSAJE_RECORDATORIO_PRUEBA_DEFAULT;

  const nombreSede = (id: number) =>
    sedes.find((s) => s.id === id)?.nombre.replace("Sede ", "") ?? "";
  const origenDe = (id: number | null) =>
    origenes.find((o) => o.id === id)?.nombre ?? null;

  const ahora = new Date();
  const hoy = hoyISO();
  const tarjetas: LeadDeTablero[] = todos.map((lead) => {
    const intereses = interesesDeLeads.filter((i) => i.leadId === lead.id);
    // Recordatorio de la clase de prueba: solo el día antes y el mismo día.
    const cuando =
      lead.estado === "prueba_agendada"
        ? recordatorioDePrueba(lead.pruebaFecha, hoy)
        : null;
    const horarioPrueba = listaHorarios.find(
      (h) => h.id === lead.pruebaHorarioId,
    );
    return {
      id: lead.id,
      nombre: lead.nombre,
      estado: lead.estado,
      disciplinas: intereses.map((i) => ({
        id: i.disciplinaId,
        nombre: i.disciplina,
        sede: nombreSede(i.sedeId),
      })),
      origen: origenDe(lead.origenNegocioId),
      campana:
        catalogoCampanas.find((c) => c.id === lead.campanaId)?.nombre ?? null,
      viaApi: lead.origen === "api" ? (lead.fuente ?? "API") : null,
      diasEnEtapa: diasEnEtapa(lead.etapaDesde, ahora),
      frio: esLeadFrio(lead.estado, lead.etapaDesde, ahora, umbralFrio),
      pruebaFecha: lead.pruebaFecha,
      motivoPerdida: lead.motivoPerdida,
      alumnoId: lead.alumnoId,
      // Para reconocer al lead de un vistazo (varios se llaman igual).
      telefonoUltimos4: lead.telefono.replace(/\D/g, "").slice(-4),
      recordatorio: cuando
        ? {
            cuando,
            recordada: lead.pruebaRecordadaEn !== null,
            link: linkWhatsApp(
              lead.telefono,
              renderizarPlantilla(plantillaRecordatorio, {
                nombre: lead.nombre,
                dia: cuando === "hoy" ? "hoy" : "mañana",
                disciplina: horarioPrueba?.disciplina ?? "baile",
                hora: horarioPrueba ? formatoHora(horarioPrueba.hora) : "",
              }),
            ),
          }
        : null,
      whatsapp: linkWhatsApp(
        lead.telefono,
        renderizarPlantilla(plantilla, { nombre: lead.nombre }),
      ),
    };
  });

  // La etiqueta no repite la disciplina: en el modal de prueba el horario se
  // elige DESPUÉS de la disciplina (que ya trae su sede), filtrado por ella.
  const opcionesHorario = listaHorarios.map((h) => ({
    id: h.id,
    disciplinaId: h.disciplinaId,
    etiqueta: `${DIAS[h.diaSemana]} ${formatoHora(h.hora)}${
      h.nota ? ` (${h.nota})` : ""
    }`,
  }));

  return (
    <TableroKanban
      tarjetas={tarjetas}
      umbralFrio={umbralFrio}
      hoy={hoy}
      opcionesHorario={opcionesHorario}
      opcionesDisciplina={catalogoDisciplinas.map((d) => ({
        id: d.id,
        etiqueta: `${d.nombre} · ${nombreSede(d.sedeId)}`,
      }))}
      opcionesOrigen={origenes.map((o) => ({ id: o.id, nombre: o.nombre }))}
    />
  );
}
