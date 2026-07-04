import type { Metadata } from "next";
import Link from "next/link";
import { requerirSeccion } from "@/lib/auth/guards";
import { cobrosDeSede, type CobroDeSuscripcion } from "@/lib/cobros";
import { formatoMonto } from "@/lib/operativa";
import { ZONA_HORARIA } from "@/lib/fechas";
import { sedeActiva } from "@/lib/sedes";
import { ChipBanner, EncabezadoSeccion } from "@/componentes/encabezado";

export const metadata: Metadata = { title: "Inicio" };

// En el inicio solo mostramos las cuotas que vencieron en los últimos días:
// las deudas más viejas viven en Cobros (y el dashboard las trata aparte).
const DIAS_VENCIDAS_RECIENTES = 7;

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
            <span className="flex min-w-0 items-center gap-1.5">
              <Link
                href={`/alumnos/${c.alumnoId}`}
                className="min-w-0 truncate font-medium hover:underline"
              >
                {c.alumno}
              </Link>
              {c.saldoPendiente > 0 ? (
                <span className="shrink-0 rounded-full bg-marca-suave px-2 py-0.5 text-[11px] font-semibold text-marca-oscuro">
                  debe {formatoMonto(c.saldoPendiente)}
                </span>
              ) : null}
            </span>
            <a
              href={`https://wa.me/${wa}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-full bg-ok/10 px-2.5 py-1 text-xs font-semibold text-ok transition hover:bg-ok/20"
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
  const vencidas = cobros.filter(
    (c) =>
      c.estado === "vencida" &&
      c.diasRestantes !== null &&
      c.diasRestantes >= -DIAS_VENCIDAS_RECIENTES,
  );
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
      <EncabezadoSeccion
        titulo={`¡Hola, ${usuario.nombre.split(" ")[0]}!`}
        subtitulo={hoy}
        extra={
          sede ? (
            <ChipBanner etiqueta="Te encontrás en">{sede.nombre}</ChipBanner>
          ) : null
        }
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <article className="tarjeta p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-tinta-suave">
              Cuotas vencidas · últimos {DIAS_VENCIDAS_RECIENTES} días
            </h2>
            <Link href="/cobros" className="text-xs font-medium underline">
              ver todas
            </Link>
          </div>
          <p className="titulo-display mt-2 text-4xl text-peligro">
            {vencidas.length}
          </p>
          {vencidas.length > 0 ? (
            <ListaCorta cobros={vencidas} />
          ) : (
            <p className="mt-2 text-xs text-tinta-suave">
              Nadie venció en los últimos {DIAS_VENCIDAS_RECIENTES} días.
            </p>
          )}
        </article>
        <article className="tarjeta p-5">
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
          {porVencer.length > 0 ? (
            <ListaCorta cobros={porVencer} />
          ) : (
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
        <Link href="/alumnos/nuevo" className="boton-primario">
          + Nuevo alumno
        </Link>
        <Link href="/cobros" className="boton-secundario">
          Registrar pagos
        </Link>
      </div>
    </div>
  );
}
