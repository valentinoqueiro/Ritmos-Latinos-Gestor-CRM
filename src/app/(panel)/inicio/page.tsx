import type { Metadata } from "next";
import Link from "next/link";
import { and, count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { requerirSeccion } from "@/lib/auth/guards";
import { detalleDeTurno, turnoAbierto } from "@/lib/caja";
import {
  cobrosDeSede,
  deudoresDeHoy,
  type CobroDeSuscripcion,
  type DeudorDeHoy,
} from "@/lib/cobros";
import { linkWhatsApp } from "@/lib/mensajes";
import { formatoHora, formatoMonto } from "@/lib/operativa";
import { formatoFecha, hoyISO, ZONA_HORARIA } from "@/lib/fechas";
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
                <span className="shrink-0 rounded-full bg-marca-suave px-2 py-0.5 text-xs font-semibold text-marca-oscuro">
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
  const hoyEnAR = sql`to_char(${leads.creadoEn} at time zone ${ZONA_HORARIA}, 'YYYY-MM-DD')`;
  const [cobros, turno, deudoresHoy, [interesadosHoy]] = await Promise.all([
    sede ? cobrosDeSede(usuario, sede.id) : [],
    sede ? turnoAbierto(sede.id) : null,
    sede ? deudoresDeHoy(usuario, sede.id) : [],
    sede
      ? db
          .select({ n: count() })
          .from(leads)
          .where(
            and(
              eq(leads.sedeInteresId, sede.id),
              sql`${hoyEnAR} = ${hoyISO()}`,
            ),
          )
      : [{ n: 0 }],
  ]);
  const turnoDetalle = turno ? await detalleDeTurno(usuario, turno.id) : null;
  const deudoresPorDisciplina = new Map<string, DeudorDeHoy[]>();
  for (const d of deudoresHoy) {
    deudoresPorDisciplina.set(d.disciplina, [
      ...(deudoresPorDisciplina.get(d.disciplina) ?? []),
      d,
    ]);
  }
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

      {/* Estado de la caja del turno */}
      {sede ? (
        <article
          className={`mt-6 tarjeta flex flex-wrap items-center justify-between gap-3 border-t-4 p-5 ${
            turnoDetalle ? "border-t-ok" : "border-t-alerta"
          }`}
        >
          {turnoDetalle ? (
            <>
              <div>
                <h2 className="text-sm font-semibold text-tinta-suave">
                  Caja · turno abierto
                </h2>
                <p className="mt-1 text-sm">
                  {turnoDetalle.resumen.nuevos + turnoDetalle.resumen.renovados}{" "}
                  pagos en el turno · Efectivo{" "}
                  <strong>
                    {formatoMonto(turnoDetalle.resumen.totalEfectivo)}
                  </strong>{" "}
                  · Transferencia{" "}
                  <strong>
                    {formatoMonto(turnoDetalle.resumen.totalTransferencia)}
                  </strong>
                </p>
                <p className="mt-0.5 text-xs text-tinta-suave">
                  Debería haber{" "}
                  {formatoMonto(turnoDetalle.resumen.efectivoEsperado)} en la
                  caja física.
                </p>
              </div>
              <Link href="/caja" className="boton-secundario shrink-0">
                Ver caja
              </Link>
            </>
          ) : (
            <>
              <div>
                <h2 className="text-sm font-semibold text-tinta-suave">
                  Caja · sin turno abierto
                </h2>
                <p className="mt-1 text-sm text-tinta-suave">
                  Abrí el turno para que los cobros del día queden en tu
                  cierre.
                </p>
              </div>
              <Link href="/caja" className="boton-primario shrink-0">
                Abrir turno
              </Link>
            </>
          )}
        </article>
      ) : null}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
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

      {/* Interesados del día: acceso directo al mostrador */}
      {sede ? (
        <article className="mt-4 tarjeta flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <h2 className="text-sm font-semibold text-tinta-suave">
              Interesados de hoy
            </h2>
            <p className="titulo-display mt-1 text-4xl">{interesadosHoy.n}</p>
            <p className="mt-0.5 text-xs text-tinta-suave">
              Gente que vino o escribió a averiguar hoy.
            </p>
          </div>
          <Link href="/interesados" className="boton-secundario shrink-0">
            + Cargar interesado
          </Link>
        </article>
      ) : null}

      {/* Deudores con clase hoy: para encararlos cuando llegan al mostrador */}
      <section className="mt-6 tarjeta p-5">
        <h2 className="text-sm font-semibold text-tinta-suave">
          Deudores que vienen hoy
        </h2>
        {deudoresHoy.length === 0 ? (
          <p className="mt-2 text-sm text-tinta-suave">
            Nadie con deuda tiene clase hoy. 🎉
          </p>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {[...deudoresPorDisciplina.entries()].map(([disciplina, lista]) => (
              <div key={disciplina}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-tinta-suave">
                  {disciplina}
                </h3>
                <ul className="mt-1.5 grid gap-1.5">
                  {lista.map((d) => (
                    <li
                      key={`${d.alumnoId}-${d.hora}`}
                      className="flex items-center justify-between gap-2 rounded-lg bg-fondo px-3 py-2 text-sm"
                    >
                      <span className="min-w-0">
                        <Link
                          href={`/alumnos/${d.alumnoId}`}
                          className="font-medium hover:underline"
                        >
                          {d.alumno}
                        </Link>
                        <span className="ml-1.5 text-xs text-tinta-suave">
                          {formatoHora(d.hora)} hs
                        </span>
                        <span
                          className={`ml-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
                            d.motivo === "vencida"
                              ? "bg-marca-suave text-marca-oscuro"
                              : "bg-alerta/10 text-alerta"
                          }`}
                        >
                          {d.motivo === "vencida"
                            ? d.vence
                              ? `venció el ${formatoFecha(d.vence)}`
                              : "nunca pagó"
                            : `debe ${formatoMonto(d.saldoPendiente)}`}
                        </span>
                      </span>
                      <a
                        href={linkWhatsApp(d.telefono)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 rounded-full bg-ok/10 px-2.5 py-1 text-xs font-semibold text-ok transition hover:bg-ok/20"
                      >
                        WhatsApp
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

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
