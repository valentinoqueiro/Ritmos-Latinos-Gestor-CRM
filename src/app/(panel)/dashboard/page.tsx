import type { Metadata } from "next";
import Link from "next/link";
import { requerirSeccion } from "@/lib/auth/guards";
import { cobrosDeSede, type CobroDeSuscripcion } from "@/lib/cobros";
import { cumpleanosDelMes, kpisAlumnos, serieFinanciera } from "@/lib/kpis";
import {
  DIAS,
  formatoHora,
  formatoMonto,
  horariosConOcupacion,
  type HorarioConOcupacion,
} from "@/lib/operativa";
import { ZONA_HORARIA, formatoFecha, ultimosMeses } from "@/lib/fechas";
import { sedesVisibles } from "@/lib/sedes";
import { estaLleno } from "@/lib/reglas-suscripcion";
import { GraficoLineas } from "@/componentes/grafico-lineas";

export const metadata: Metadata = { title: "Dashboard" };

// Paleta de series validada con la skill dataviz (validate_palette.js):
// ΔE CVD 67 entre pares adyacentes, contraste ≥ 3:1 sobre superficie clara.
const COLOR_INGRESOS = "#2563b8";
const COLOR_GASTOS = "#d93240";
const COLOR_RESULTADO = "#7c4dbe";

function etiquetaMes(mes: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    month: "short",
    timeZone: ZONA_HORARIA,
  })
    .format(new Date(`${mes}-15T12:00:00Z`))
    .replace(".", "");
}

function BarraOcupacion({ horario }: { horario: HorarioConOcupacion }) {
  if (horario.cupo === null) {
    return (
      <span className="text-xs font-semibold text-tinta-suave">
        {horario.inscriptos} inscriptos
      </span>
    );
  }
  const proporcion = Math.min(1, horario.inscriptos / horario.cupo);
  const lleno = estaLleno(horario);
  const color = lleno ? "#c32935" : proporcion >= 0.8 ? "#b7791f" : "#1d8a4e";
  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden
        className="h-2 w-24 overflow-hidden rounded-full bg-borde"
      >
        <span
          className="block h-full rounded-full"
          style={{ width: `${proporcion * 100}%`, backgroundColor: color }}
        />
      </span>
      <span className="w-12 text-right text-xs font-semibold tabular-nums">
        {horario.inscriptos}/{horario.cupo}
      </span>
    </span>
  );
}

export default async function PaginaDashboard({
  searchParams,
}: {
  searchParams: Promise<{ sede?: string }>;
}) {
  const usuario = await requerirSeccion("dashboard");
  const { sede: sedeParam } = await searchParams;
  const sedes = await sedesVisibles(usuario);
  const sedeElegida = sedes.find((s) => s.id === Number(sedeParam));
  const alcance = sedeElegida ? [sedeElegida] : sedes;
  const sedeIds = alcance.map((s) => s.id);
  const esOwner = usuario.rol === "owner";

  const [serie, alumnosKpi, cumples, cobrosPorSede, ocupacionPorSede] =
    await Promise.all([
      serieFinanciera(usuario, sedeIds),
      kpisAlumnos(usuario, sedeIds),
      cumpleanosDelMes(usuario, sedeIds),
      Promise.all(alcance.map((s) => cobrosDeSede(usuario, s.id))),
      Promise.all(alcance.map((s) => horariosConOcupacion(usuario, s.id))),
    ]);

  const mesActual = serie[serie.length - 1];
  const cobros = cobrosPorSede.flatMap((lista, i) =>
    lista.map((c) => ({ ...c, sede: alcance[i].nombre })),
  );
  const vencidas = cobros.filter((c) => c.estado === "vencida");
  const porVencer = cobros.filter((c) => c.estado === "por_vencer");
  const nombreSede = (id: number) =>
    sedes.find((s) => s.id === id)?.nombre.replace("Sede ", "") ?? "";
  const meses = ultimosMeses(6);

  return (
    <div>
      <h1 className="titulo-display text-4xl">Dashboard</h1>
      {esOwner ? (
        <p className="mt-1 text-sm text-tinta-suave">
          Vista de solo lectura para los dueños.
        </p>
      ) : null}

      {/* Selector sede / consolidado */}
      <nav className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/dashboard"
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            !sedeElegida
              ? "bg-tinta text-white"
              : "border border-borde bg-superficie hover:border-marca"
          }`}
        >
          Consolidado
        </Link>
        {sedes.map((s) => (
          <Link
            key={s.id}
            href={`/dashboard?sede=${s.id}`}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              sedeElegida?.id === s.id
                ? "bg-tinta text-white"
                : "border border-borde bg-superficie hover:border-marca"
            }`}
          >
            {s.nombre}
          </Link>
        ))}
      </nav>

      {/* KPIs del mes */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <article className="rounded-2xl border border-borde bg-superficie p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-tinta-suave">
            Ingresos del mes
          </h2>
          <p className="titulo-display mt-1 text-3xl">
            {formatoMonto(mesActual.ingresos)}
          </p>
        </article>
        <article className="rounded-2xl border border-borde bg-superficie p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-tinta-suave">
            Gastos del mes
          </h2>
          <p className="titulo-display mt-1 text-3xl">
            {formatoMonto(mesActual.gastos)}
          </p>
        </article>
        <article className="rounded-2xl border border-borde bg-superficie p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-tinta-suave">
            Resultado del mes
          </h2>
          <p
            className={`titulo-display mt-1 text-3xl ${
              mesActual.resultado >= 0 ? "text-ok" : "text-peligro"
            }`}
          >
            {formatoMonto(mesActual.resultado)}
          </p>
        </article>
        <article className="rounded-2xl border border-borde bg-superficie p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-tinta-suave">
            Alumnos activos
          </h2>
          <p className="titulo-display mt-1 text-3xl">{alumnosKpi.activos}</p>
          <p className="mt-1 text-xs text-tinta-suave">
            {alumnosKpi.altasDelMes} altas · {alumnosKpi.bajasDelMes} bajas este
            mes
          </p>
        </article>
      </div>

      {/* Evolución */}
      <section className="mt-6 rounded-2xl border border-borde bg-superficie p-4">
        <GraficoLineas
          titulo="Evolución de los últimos 6 meses"
          etiquetas={meses.map(etiquetaMes)}
          series={[
            {
              nombre: "Ingresos",
              color: COLOR_INGRESOS,
              puntos: serie.map((p) => p.ingresos),
            },
            {
              nombre: "Gastos",
              color: COLOR_GASTOS,
              puntos: serie.map((p) => p.gastos),
            },
            {
              nombre: "Resultado",
              color: COLOR_RESULTADO,
              puntos: serie.map((p) => p.resultado),
            },
          ]}
        />
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-tinta-suave">
            Ver como tabla
          </summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-100 text-left text-sm">
              <thead>
                <tr className="border-b border-borde text-xs uppercase text-tinta-suave">
                  <th className="py-2 pr-4">Mes</th>
                  <th className="py-2 pr-4">Ingresos</th>
                  <th className="py-2 pr-4">Gastos</th>
                  <th className="py-2">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {serie.map((p) => (
                  <tr key={p.mes} className="border-b border-borde last:border-0">
                    <td className="py-2 pr-4 capitalize">{etiquetaMes(p.mes)}</td>
                    <td className="py-2 pr-4">{formatoMonto(p.ingresos)}</td>
                    <td className="py-2 pr-4">{formatoMonto(p.gastos)}</td>
                    <td className="py-2">{formatoMonto(p.resultado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      {/* Ocupación por clase */}
      <section className="mt-6">
        <h2 className="titulo-display text-2xl">Ocupación por clase</h2>
        <p className="mt-1 text-xs text-tinta-suave">
          Inscriptos por horario (no se toma asistencia).
        </p>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          {alcance.map((sede, i) => (
            <div
              key={sede.id}
              className="rounded-2xl border border-borde bg-superficie p-4"
            >
              <h3 className="text-sm font-semibold">{sede.nombre}</h3>
              <ul className="mt-2 grid gap-1.5">
                {ocupacionPorSede[i].map((h) => (
                  <li
                    key={h.id}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="min-w-0 truncate">
                      {h.disciplina} · {DIAS[h.diaSemana].slice(0, 3)}{" "}
                      {formatoHora(h.hora)}
                      {h.nota ? (
                        <span className="text-tinta-suave"> ({h.nota})</span>
                      ) : null}
                    </span>
                    <BarraOcupacion horario={h} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Morosos y por vencer */}
      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-borde bg-superficie p-4">
          <h2 className="titulo-display text-2xl text-peligro">
            Morosos ({vencidas.length})
          </h2>
          <ListaCobros cobros={vencidas} esOwner={esOwner} conSede={!sedeElegida} nombreSede={nombreSede} />
        </div>
        <div className="rounded-2xl border border-borde bg-superficie p-4">
          <h2 className="titulo-display text-2xl text-alerta">
            Por vencer ({porVencer.length})
          </h2>
          <ListaCobros cobros={porVencer} esOwner={esOwner} conSede={!sedeElegida} nombreSede={nombreSede} />
        </div>
      </section>

      {/* Cumpleaños del mes */}
      <section className="mt-6 rounded-2xl border border-borde bg-superficie p-4">
        <h2 className="titulo-display text-2xl">
          Cumpleaños del mes ({cumples.length})
        </h2>
        {cumples.length === 0 ? (
          <p className="mt-2 text-sm text-tinta-suave">
            Ningún alumno activo cumple años este mes.
          </p>
        ) : (
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {cumples.map((c) => (
              <li
                key={c.alumnoId}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span>
                  <strong>{String(c.dia).padStart(2, "0")}</strong> · {c.nombre}{" "}
                  <span className="text-tinta-suave">
                    (cumple {c.cumpleAnios})
                    {!sedeElegida ? ` · ${nombreSede(c.sedeId)}` : ""}
                  </span>
                </span>
                <a
                  href={`https://wa.me/${c.telefono.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-full bg-ok/10 px-2.5 py-1 text-xs font-semibold text-ok"
                >
                  WhatsApp
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ListaCobros({
  cobros,
  esOwner,
  conSede,
  nombreSede,
}: {
  cobros: (CobroDeSuscripcion & { sede: string })[];
  esOwner: boolean;
  conSede: boolean;
  nombreSede: (id: number) => string;
}) {
  if (cobros.length === 0) {
    return <p className="mt-2 text-sm text-tinta-suave">Nadie en esta lista. 🎉</p>;
  }
  return (
    <ul className="mt-2 grid gap-1.5">
      {cobros.map((c) => (
        <li
          key={c.suscripcionId}
          className="flex items-center justify-between gap-2 text-sm"
        >
          <span className="min-w-0 truncate">
            {esOwner ? (
              c.alumno
            ) : (
              <Link href={`/alumnos/${c.alumnoId}`} className="hover:underline">
                {c.alumno}
              </Link>
            )}{" "}
            <span className="text-tinta-suave">
              · {c.plan}
              {conSede ? ` · ${c.sede.replace("Sede ", "")}` : ""}
              {c.vence ? ` · ${formatoFecha(c.vence)}` : " · nunca pagó"}
            </span>
          </span>
          <span className="shrink-0 text-xs font-semibold">
            {c.precioVigente ? formatoMonto(c.precioVigente) : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}
