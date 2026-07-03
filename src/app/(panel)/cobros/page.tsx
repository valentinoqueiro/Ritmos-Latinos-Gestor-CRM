import type { Metadata } from "next";
import Link from "next/link";
import { requerirSeccion } from "@/lib/auth/guards";
import { cobrosDeSede, type CobroDeSuscripcion } from "@/lib/cobros";
import { formatoMonto } from "@/lib/operativa";
import { formatoFecha } from "@/lib/fechas";
import { sedeActiva } from "@/lib/sedes";

export const metadata: Metadata = { title: "Cobros" };

function FilaCobro({ cobro }: { cobro: CobroDeSuscripcion }) {
  const wa = cobro.telefono.replace(/\D/g, "");
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 border-b border-borde px-4 py-3 last:border-0">
      <div className="min-w-0">
        <Link
          href={`/alumnos/${cobro.alumnoId}`}
          className="font-medium hover:underline"
        >
          {cobro.alumno}
        </Link>
        <p className="text-xs text-tinta-suave">
          {cobro.plan}
          {cobro.vence
            ? ` · venció/vence el ${formatoFecha(cobro.vence)}`
            : " · nunca pagó"}
          {cobro.precioVigente
            ? ` · cuota ${formatoMonto(cobro.precioVigente)}`
            : ""}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <a
          href={`https://wa.me/${wa}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-ok/10 px-3 py-1.5 text-xs font-semibold text-ok transition hover:bg-ok/20"
        >
          WhatsApp
        </a>
        <Link
          href={`/alumnos/${cobro.alumnoId}/pagar?sub=${cobro.suscripcionId}`}
          className="rounded-full bg-marca px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-marca-oscuro"
        >
          Cobrar
        </Link>
      </div>
    </li>
  );
}

// El estado de cada cuota es derivado (src/lib/vencimientos.ts); este listado
// es el mismo que alimentará los KPIs de morosidad del dashboard (fase 5).
export default async function PaginaCobros() {
  const usuario = await requerirSeccion("operativa");
  const sede = await sedeActiva(usuario);
  const cobros = sede ? await cobrosDeSede(usuario, sede.id) : [];

  const vencidas = cobros.filter((c) => c.estado === "vencida");
  const porVencer = cobros.filter((c) => c.estado === "por_vencer");
  const alDia = cobros.filter((c) => c.estado === "al_dia");

  return (
    <div>
      <h1 className="titulo-display text-4xl">Cobros</h1>
      <p className="mt-1 text-sm text-tinta-suave">
        Estado de las cuotas de {sede?.nombre ?? "la sede"} ·{" "}
        {alDia.length} al día
      </p>

      <section className="mt-6">
        <h2 className="titulo-display text-2xl text-peligro">
          Vencidas ({vencidas.length})
        </h2>
        {vencidas.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-dashed border-borde bg-superficie px-4 py-6 text-center text-sm text-tinta-suave">
            Nadie debe la cuota. 🎉
          </p>
        ) : (
          <ul className="mt-2 rounded-2xl border border-borde bg-superficie">
            {vencidas.map((c) => (
              <FilaCobro key={c.suscripcionId} cobro={c} />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="titulo-display text-2xl text-alerta">
          Por vencer ({porVencer.length})
        </h2>
        {porVencer.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-dashed border-borde bg-superficie px-4 py-6 text-center text-sm text-tinta-suave">
            Nada por vencer en los próximos días.
          </p>
        ) : (
          <ul className="mt-2 rounded-2xl border border-borde bg-superficie">
            {porVencer.map((c) => (
              <FilaCobro key={c.suscripcionId} cobro={c} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
