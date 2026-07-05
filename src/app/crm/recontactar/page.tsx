import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { configuracion } from "@/db/schema";
import { requerirSeccion } from "@/lib/auth/guards";
import { cobrosDeSedes, type CobroDeSuscripcion } from "@/lib/cobros";
import { formatoFecha } from "@/lib/fechas";
import {
  CLAVE_MENSAJE_RECONTACTO,
  MENSAJE_RECONTACTO_DEFAULT,
  linkWhatsApp,
  renderizarPlantilla,
} from "@/lib/mensajes";
import { formatoMonto } from "@/lib/operativa";
import { sedesVisibles } from "@/lib/sedes";
import { DIAS_HASTA_ABANDONO, esAbandono } from "@/lib/vencimientos";

export const metadata: Metadata = { title: "A recontactar" };

// Retención DENTRO del CRM: como no se toma asistencia, la señal de que un
// alumno se está yendo es su cuota (por vencer → vencida → abandono). Es una
// lista accionable con WhatsApp prellenado — NO un segundo pipeline: acá no
// hay etapas, se contacta y listo. Reutiliza la misma lógica derivada de
// cobros que usan la secretaria y el dashboard.

function nombreDePila(alumno: string): string {
  // cobros devuelve "Apellido, Nombre".
  const [, nombre] = alumno.split(", ");
  return nombre ?? alumno;
}

function Fila({
  cobro,
  sede,
  plantilla,
}: {
  cobro: CobroDeSuscripcion;
  sede: string;
  plantilla: string;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-b border-borde px-4 py-3 last:border-0">
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <Link
            href={`/alumnos/${cobro.alumnoId}`}
            className="font-medium hover:underline"
          >
            {cobro.alumno}
          </Link>
          {cobro.saldoPendiente > 0 ? (
            <span className="rounded-full bg-marca-suave px-2 py-0.5 text-[11px] font-semibold text-marca-oscuro">
              debe {formatoMonto(cobro.saldoPendiente)}
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-xs text-tinta-suave">
          {cobro.plan} · {sede} ·{" "}
          {cobro.vence
            ? cobro.estado === "vencida"
              ? `venció el ${formatoFecha(cobro.vence)}`
              : `vence el ${formatoFecha(cobro.vence)}`
            : "nunca pagó"}
        </span>
      </span>
      <a
        href={linkWhatsApp(
          cobro.telefono,
          renderizarPlantilla(plantilla, { nombre: nombreDePila(cobro.alumno) }),
        )}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 rounded-full bg-ok/10 px-3 py-1.5 text-xs font-semibold text-ok transition hover:bg-ok/20"
      >
        Recontactar por WhatsApp
      </a>
    </li>
  );
}

function Grupo({
  titulo,
  descripcion,
  color,
  cobros,
  vacio,
  nombreSede,
  plantilla,
}: {
  titulo: string;
  descripcion: string;
  color: string;
  cobros: CobroDeSuscripcion[];
  vacio: string;
  nombreSede: (id: number) => string;
  plantilla: string;
}) {
  return (
    <section className="mt-6">
      <h2 className={`titulo-display text-2xl ${color}`}>
        {titulo} ({cobros.length})
      </h2>
      <p className="mt-0.5 text-xs text-tinta-suave">{descripcion}</p>
      {cobros.length === 0 ? (
        <p className="tarjeta mt-3 border-dashed px-4 py-5 text-center text-sm text-tinta-suave">
          {vacio}
        </p>
      ) : (
        <ul className="tarjeta mt-3 overflow-hidden">
          {cobros.map((c) => (
            <Fila
              key={c.suscripcionId}
              cobro={c}
              sede={nombreSede(c.sedeId)}
              plantilla={plantilla}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function PaginaRecontactar() {
  const usuario = await requerirSeccion("crm");
  const sedes = await sedesVisibles(usuario);
  const [cobros, filaMensaje] = await Promise.all([
    cobrosDeSedes(
      usuario,
      sedes.map((s) => s.id),
    ),
    db.query.configuracion.findFirst({
      where: eq(configuracion.clave, CLAVE_MENSAJE_RECONTACTO),
    }),
  ]);
  const plantilla = filaMensaje?.valor ?? MENSAJE_RECONTACTO_DEFAULT;
  const nombreSede = (id: number) =>
    sedes.find((s) => s.id === id)?.nombre.replace("Sede ", "") ?? "";

  const vencidas = cobros.filter((c) => c.estado === "vencida");
  const recientes = vencidas.filter((c) => !esAbandono(c.diasRestantes));
  const abandonos = vencidas.filter((c) => esAbandono(c.diasRestantes));
  const porVencer = cobros.filter((c) => c.estado === "por_vencer");

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="titulo-display text-4xl">A recontactar</h1>
          <p className="mt-0.5 text-sm text-tinta-suave">
            La cuota es la señal de que un alumno se aleja: escribile antes de
            que deje de venir. El mensaje se configura en Configuración.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full bg-peligro/10 px-3 py-1.5 text-peligro">
            {recientes.length} vencidas
          </span>
          <span className="rounded-full bg-alerta/10 px-3 py-1.5 text-alerta">
            {porVencer.length} por vencer
          </span>
          <span className="rounded-full bg-tinta px-3 py-1.5 text-white">
            {abandonos.length} dejaron
          </span>
        </div>
      </div>

      <Grupo
        titulo="Vencidas recientes"
        descripcion={`Deben la cuota hace menos de ${DIAS_HASTA_ABANDONO} días (o nunca pagaron): todavía están cerca.`}
        color="text-peligro"
        cobros={recientes}
        vacio="Nadie debe la cuota. 🎉"
        nombreSede={nombreSede}
        plantilla={plantilla}
      />
      <Grupo
        titulo="Por vencer"
        descripcion="Se les vence en los próximos días: un mensaje a tiempo evita la deuda."
        color="text-alerta"
        cobros={porVencer}
        vacio="Nada por vencer en los próximos días."
        nombreSede={nombreSede}
        plantilla={plantilla}
      />
      <Grupo
        titulo="Dejaron de venir"
        descripcion={`Más de ${DIAS_HASTA_ABANDONO} días vencidos: recuperarlos es la venta más barata.`}
        color="text-tinta"
        cobros={abandonos}
        vacio="Nadie abandonó. 💪"
        nombreSede={nombreSede}
        plantilla={plantilla}
      />
    </div>
  );
}
