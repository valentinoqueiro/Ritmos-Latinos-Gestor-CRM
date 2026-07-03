import type { Metadata } from "next";
import Link from "next/link";
import { requerirSeccion } from "@/lib/auth/guards";
import { cobrosDeSede, type CobroDeSuscripcion } from "@/lib/cobros";
import { ZONA_HORARIA } from "@/lib/fechas";
import { sedeActiva } from "@/lib/sedes";

export const metadata: Metadata = { title: "Inicio" };

function ListaCorta({ cobros }: { cobros: CobroDeSuscripcion[] }) {
  return (
    <ul className="mt-3 grid gap-1.5">
      {cobros.slice(0, 4).map((c) => {
        const wa = c.telefono.replace(/\D/g, "");
        return (
          <li
            key={c.suscripcionId}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <Link
              href={`/alumnos/${c.alumnoId}`}
              className="min-w-0 truncate font-medium hover:underline"
            >
              {c.alumno}
            </Link>
            <a
              href={`https://wa.me/${wa}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-full bg-ok/10 px-2.5 py-1 text-xs font-semibold text-ok"
            >
              WhatsApp
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export default async function PaginaInicio() {
  const usuario = await requerirSeccion("operativa");
  const sede = await sedeActiva(usuario);
  const cobros = sede ? await cobrosDeSede(usuario, sede.id) : [];
  const vencidas = cobros.filter((c) => c.estado === "vencida");
  const porVencer = cobros.filter((c) => c.estado === "por_vencer");

  const fecha = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: ZONA_HORARIA,
  }).format(new Date());
  const hoy = fecha.charAt(0).toUpperCase() + fecha.slice(1);

  return (
    <div>
      <p className="text-sm text-tinta-suave">{hoy}</p>
      <h1 className="titulo-display mt-1 text-4xl">
        Hola, {usuario.nombre.split(" ")[0]}
      </h1>
      {sede ? (
        <p className="mt-1 text-sm text-tinta-suave">
          Estás operando <strong>{sede.nombre}</strong>.
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <article className="rounded-2xl border border-borde bg-superficie p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-tinta-suave">
              Cuotas vencidas
            </h2>
            <Link href="/cobros" className="text-xs font-medium underline">
              ver todas
            </Link>
          </div>
          <p className="titulo-display mt-2 text-4xl text-peligro">
            {vencidas.length}
          </p>
          {vencidas.length > 0 ? <ListaCorta cobros={vencidas} /> : (
            <p className="mt-2 text-xs text-tinta-suave">Nadie debe la cuota.</p>
          )}
        </article>
        <article className="rounded-2xl border border-borde bg-superficie p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-tinta-suave">
              Cuotas por vencer
            </h2>
            <Link href="/cobros" className="text-xs font-medium underline">
              ver todas
            </Link>
          </div>
          <p className="titulo-display mt-2 text-4xl text-alerta">
            {porVencer.length}
          </p>
          {porVencer.length > 0 ? <ListaCorta cobros={porVencer} /> : (
            <p className="mt-2 text-xs text-tinta-suave">
              Nada por vencer en los próximos días.
            </p>
          )}
        </article>
      </div>

      <h2 className="mt-8 text-sm font-semibold text-tinta-suave">
        Accesos rápidos
      </h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href="/alumnos/nuevo"
          className="rounded-full bg-marca px-4 py-2 text-sm font-semibold text-white transition hover:bg-marca-oscuro"
        >
          + Nuevo alumno
        </Link>
        <Link
          href="/cobros"
          className="rounded-full border border-borde bg-superficie px-4 py-2 text-sm font-medium transition hover:border-marca"
        >
          Registrar pagos
        </Link>
        <Link
          href="/horarios"
          className="rounded-full border border-borde bg-superficie px-4 py-2 text-sm font-medium transition hover:border-marca"
        >
          Ver horarios
        </Link>
      </div>
    </div>
  );
}
