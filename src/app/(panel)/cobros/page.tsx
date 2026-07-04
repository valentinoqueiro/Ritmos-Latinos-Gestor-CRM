import type { Metadata } from "next";
import Link from "next/link";
import { requerirSeccion } from "@/lib/auth/guards";
import { cobrosDeSede, type CobroDeSuscripcion } from "@/lib/cobros";
import { formatoMonto } from "@/lib/operativa";
import { formatoFecha } from "@/lib/fechas";
import { sedeActiva } from "@/lib/sedes";
import { ChipBanner, EncabezadoSeccion } from "@/componentes/encabezado";

export const metadata: Metadata = { title: "Cobros" };

function TarjetaCobro({ cobro }: { cobro: CobroDeSuscripcion }) {
  const wa = cobro.telefono.replace(/\D/g, "");
  const acento =
    cobro.estado === "vencida" ? "border-t-peligro" : "border-t-alerta";
  return (
    <li
      className={`tarjeta tarjeta-interactiva flex h-full flex-col border-t-4 p-4 ${acento}`}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/alumnos/${cobro.alumnoId}`}
          className="min-w-0 font-semibold leading-snug hover:underline"
        >
          {cobro.alumno}
        </Link>
        {cobro.precioVigente ? (
          <span className="shrink-0 rounded-lg bg-fondo px-2 py-1 text-xs font-bold tabular-nums">
            {formatoMonto(cobro.precioVigente)}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-tinta-suave">{cobro.plan}</p>
      <p
        className={`mt-0.5 text-xs font-medium ${
          cobro.estado === "vencida" ? "text-peligro" : "text-alerta"
        }`}
      >
        {cobro.vence
          ? cobro.estado === "vencida"
            ? `Venció el ${formatoFecha(cobro.vence)}`
            : `Vence el ${formatoFecha(cobro.vence)}`
          : "Nunca pagó"}
      </p>
      {cobro.saldoPendiente > 0 ? (
        <p className="mt-1">
          <span className="rounded-full bg-marca-suave px-2 py-0.5 text-xs font-semibold text-marca-oscuro">
            Debe {formatoMonto(cobro.saldoPendiente)} de un pago parcial
          </span>
        </p>
      ) : null}
      <div className="mt-auto flex gap-2 pt-3">
        <a
          href={`https://wa.me/${wa}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 rounded-xl bg-ok/10 py-2 text-center text-xs font-semibold text-ok transition hover:bg-ok/20"
        >
          WhatsApp
        </a>
        <Link
          href={`/alumnos/${cobro.alumnoId}/pagar?sub=${cobro.suscripcionId}`}
          className="flex-1 rounded-xl bg-marca py-2 text-center text-xs font-semibold text-white transition hover:bg-marca-oscuro"
        >
          Cobrar
        </Link>
      </div>
    </li>
  );
}

function GrillaCobros({ cobros }: { cobros: CobroDeSuscripcion[] }) {
  return (
    <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {cobros.map((c) => (
        <TarjetaCobro key={c.suscripcionId} cobro={c} />
      ))}
    </ul>
  );
}

// El estado de cada cuota es derivado (src/lib/vencimientos.ts); este listado
// es el mismo que alimenta los KPIs de morosidad del dashboard.
export default async function PaginaCobros() {
  const usuario = await requerirSeccion("operativa");
  const sede = await sedeActiva(usuario);
  const cobros = sede ? await cobrosDeSede(usuario, sede.id) : [];

  const vencidas = cobros.filter((c) => c.estado === "vencida");
  const porVencer = cobros.filter((c) => c.estado === "por_vencer");
  const alDia = cobros.filter((c) => c.estado === "al_dia");
  const deudores = cobros.filter((c) => c.saldoPendiente > 0);
  // Deudores con cuota vigente: sin esta franja no aparecerían en la pantalla.
  const deudoresAlDia = alDia.filter((c) => c.saldoPendiente > 0);

  return (
    <div>
      <EncabezadoSeccion
        titulo="Cobros"
        subtitulo={`Estado de las cuotas de ${sede?.nombre ?? "la sede"}.`}
        extra={
          <>
            <ChipBanner etiqueta="Al día">{alDia.length}</ChipBanner>
            <ChipBanner etiqueta="Por vencer">{porVencer.length}</ChipBanner>
            <ChipBanner etiqueta="Vencidas">{vencidas.length}</ChipBanner>
            {deudores.length > 0 ? (
              <ChipBanner etiqueta="Con deuda">{deudores.length}</ChipBanner>
            ) : null}
          </>
        }
      />

      {deudoresAlDia.length > 0 ? (
        <section className="mt-6">
          <h2 className="titulo-display text-2xl text-marca-oscuro">
            Pagos parciales a completar ({deudoresAlDia.length})
          </h2>
          <p className="mt-1 text-xs text-tinta-suave">
            Cuota vigente pero pagada en parte: falta que entreguen el resto.
          </p>
          <GrillaCobros cobros={deudoresAlDia} />
        </section>
      ) : null}

      <section className="mt-6">
        <h2 className="titulo-display text-2xl text-peligro">
          Vencidas ({vencidas.length})
        </h2>
        {vencidas.length === 0 ? (
          <p className="tarjeta mt-3 border-dashed px-4 py-6 text-center text-sm text-tinta-suave">
            Nadie debe la cuota. 🎉
          </p>
        ) : (
          <GrillaCobros cobros={vencidas} />
        )}
      </section>

      <section className="mt-8">
        <h2 className="titulo-display text-2xl text-alerta">
          Por vencer ({porVencer.length})
        </h2>
        {porVencer.length === 0 ? (
          <p className="tarjeta mt-3 border-dashed px-4 py-6 text-center text-sm text-tinta-suave">
            Nada por vencer en los próximos días.
          </p>
        ) : (
          <GrillaCobros cobros={porVencer} />
        )}
      </section>
    </div>
  );
}
