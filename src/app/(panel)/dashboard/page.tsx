import type { Metadata } from "next";
import Link from "next/link";
import { requerirSeccion } from "@/lib/auth/guards";
import { cobrosDeSedes, type CobroDeSuscripcion } from "@/lib/cobros";
import {
  cumpleanosDelMes,
  kpisAlumnos,
  kpisCrm,
  serieFinanciera,
} from "@/lib/kpis";
import { ETIQUETA_ESTADO_LEAD, type EstadoLead } from "@/lib/reglas-leads";
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
import { DIAS_HASTA_ABANDONO, esAbandono } from "@/lib/vencimientos";
import { GraficoLineas } from "@/componentes/grafico-lineas";
import { EncabezadoSeccion } from "@/componentes/encabezado";

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

// Fila de ocupación: la info arriba (truncada, nunca se desborda) y la barra
// ocupando todo el ancho abajo, con el número al final.
function FilaOcupacion({ horario }: { horario: HorarioConOcupacion }) {
  const proporcion =
    horario.cupo === null
      ? null
      : Math.min(1, horario.inscriptos / horario.cupo);
  const lleno = horario.cupo !== null && estaLleno(horario);
  const color =
    lleno ? "#c32935" : (proporcion ?? 0) >= 0.8 ? "#c2410c" : "#1d8a4e";

  return (
    <li className="rounded-xl bg-fondo/70 px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-medium">
          {horario.disciplina}
          {horario.nota ? (
            <span className="text-tinta-suave"> · {horario.nota}</span>
          ) : null}
        </p>
        <p className="shrink-0 text-xs font-medium text-tinta-suave tabular-nums">
          {DIAS[horario.diaSemana].slice(0, 3)} {formatoHora(horario.hora)}
        </p>
      </div>
      <div className="mt-1.5 flex items-center gap-2.5">
        {proporcion === null ? (
          <span className="text-xs font-semibold text-tinta-suave">
            {horario.inscriptos} inscriptos · sin cupo
          </span>
        ) : (
          <>
            <span
              aria-hidden
              className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-borde"
            >
              <span
                className="block h-full rounded-full"
                style={{ width: `${proporcion * 100}%`, backgroundColor: color }}
              />
            </span>
            <span
              className="shrink-0 text-xs font-semibold tabular-nums"
              style={{ color }}
            >
              {horario.inscriptos}/{horario.cupo}
              {lleno ? " · Lleno" : ""}
            </span>
          </>
        )}
      </div>
    </li>
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

  const [serie, alumnosKpi, cumples, cobrosTodos, ocupacionPorSede, crm] =
    await Promise.all([
      serieFinanciera(usuario, sedeIds),
      kpisAlumnos(usuario, sedeIds),
      cumpleanosDelMes(usuario, sedeIds),
      cobrosDeSedes(usuario, sedeIds),
      Promise.all(alcance.map((s) => horariosConOcupacion(usuario, s.id))),
      kpisCrm(usuario),
    ]);

  const mesActual = serie[serie.length - 1];
  const nombrePorSede = new Map(alcance.map((s) => [s.id, s.nombre]));
  const cobros = cobrosTodos.map((c) => ({
    ...c,
    sede: nombrePorSede.get(c.sedeId) ?? "",
  }));
  const vencidas = cobros.filter((c) => c.estado === "vencida");
  // Moroso = vencida hasta 10 días; más de 10 días = dejó de venir (regla en
  // src/lib/vencimientos.ts). "Nunca pagó" cuenta como moroso, no abandono.
  const morosos = vencidas.filter((c) => !esAbandono(c.diasRestantes));
  const dejaron = vencidas.filter((c) => esAbandono(c.diasRestantes));
  const porVencer = cobros.filter((c) => c.estado === "por_vencer");
  const nombreSede = (id: number) =>
    sedes.find((s) => s.id === id)?.nombre.replace("Sede ", "") ?? "";
  const meses = ultimosMeses(6);

  return (
    <div>
      <EncabezadoSeccion
        titulo="Dashboard"
        subtitulo={
          esOwner
            ? "Vista de solo lectura para los dueños."
            : "Los números del negocio, con las mismas reglas que la operatoria."
        }
      >
        {/* Selector sede / consolidado */}
        <nav className="flex flex-wrap gap-2">
          <Link
            href="/dashboard"
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              !sedeElegida
                ? "bg-marca text-white shadow-boton"
                : "bg-white/10 text-white/80 ring-1 ring-white/20 hover:bg-white/20"
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
                  ? "bg-marca text-white shadow-boton"
                  : "bg-white/10 text-white/80 ring-1 ring-white/20 hover:bg-white/20"
              }`}
            >
              {s.nombre}
            </Link>
          ))}
        </nav>
      </EncabezadoSeccion>

      {/* KPIs del mes */}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <article className="tarjeta p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-tinta-suave">
            Ingresos del mes
          </h2>
          <p className="titulo-display mt-1 text-3xl">
            {formatoMonto(mesActual.ingresos)}
          </p>
        </article>
        <article className="tarjeta p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-tinta-suave">
            Gastos del mes
          </h2>
          <p className="titulo-display mt-1 text-3xl">
            {formatoMonto(mesActual.gastos)}
          </p>
        </article>
        <article className="tarjeta p-4">
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
        <article className="tarjeta p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-tinta-suave">
            Alumnos activos
          </h2>
          <p className="titulo-display mt-1 text-3xl">{alumnosKpi.activos}</p>
          <p className="mt-1 text-xs text-tinta-suave">
            {alumnosKpi.altasDelMes} altas · {alumnosKpi.bajasDelMes} bajas este
            mes
          </p>
        </article>
        <article className="tarjeta border-t-4 border-t-peligro p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-tinta-suave">
            Dejaron de venir
          </h2>
          <p className="titulo-display mt-1 text-3xl text-peligro">
            {dejaron.length}
          </p>
          <p className="mt-1 text-xs text-tinta-suave">
            cuota vencida hace más de {DIAS_HASTA_ABANDONO} días
          </p>
        </article>
      </div>

      {/* Evolución */}
      <section className="mt-6 tarjeta p-4">
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
            <div key={sede.id} className="tarjeta p-4">
              <h3 className="text-sm font-semibold">{sede.nombre}</h3>
              <ul className="mt-3 grid gap-2">
                {ocupacionPorSede[i].map((h) => (
                  <FilaOcupacion key={h.id} horario={h} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Morosos, por vencer y abandonos */}
      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="tarjeta p-4">
          <h2 className="titulo-display text-2xl text-peligro">
            Morosos ({morosos.length})
          </h2>
          <p className="mt-0.5 text-xs text-tinta-suave">
            Vencida hasta {DIAS_HASTA_ABANDONO} días (o sin pagos).
          </p>
          <ListaCobros cobros={morosos} esOwner={esOwner} conSede={!sedeElegida} />
        </div>
        <div className="tarjeta p-4">
          <h2 className="titulo-display text-2xl text-alerta">
            Por vencer ({porVencer.length})
          </h2>
          <p className="mt-0.5 text-xs text-tinta-suave">
            Se vencen en los próximos días.
          </p>
          <ListaCobros cobros={porVencer} esOwner={esOwner} conSede={!sedeElegida} />
        </div>
        <div className="tarjeta p-4">
          <h2 className="titulo-display text-2xl">
            Dejaron ({dejaron.length})
          </h2>
          <p className="mt-0.5 text-xs text-tinta-suave">
            Más de {DIAS_HASTA_ABANDONO} días vencida: los damos por baja.
          </p>
          <ListaCobros cobros={dejaron} esOwner={esOwner} conSede={!sedeElegida} />
        </div>
      </section>

      {/* CRM (cross-sede) */}
      <section className="mt-6 tarjeta p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="titulo-display text-2xl">CRM · Interesados</h2>
          {!esOwner ? (
            <Link
              href="/crm"
              className="rounded-lg bg-marca px-3 py-1.5 text-xs font-semibold text-white shadow-boton transition hover:bg-marca-oscuro"
            >
              Abrir CRM →
            </Link>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-tinta-suave">
          Todas las sedes (el CRM es transversal).
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(ETIQUETA_ESTADO_LEAD) as EstadoLead[]).map((estado) => (
            <span
              key={estado}
              className="rounded-full border border-borde bg-fondo px-3 py-1.5 text-xs font-medium"
            >
              {ETIQUETA_ESTADO_LEAD[estado]}:{" "}
              <strong>{crm.porEstado[estado]}</strong>
            </span>
          ))}
          <span className="rounded-full bg-tinta px-3 py-1.5 text-xs font-semibold text-white">
            Conversión:{" "}
            {crm.tasa === null ? "—" : `${Math.round(crm.tasa * 100)}%`}
          </span>
        </div>
      </section>

      {/* Cumpleaños del mes */}
      <section className="mt-6 tarjeta p-4">
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
}: {
  cobros: (CobroDeSuscripcion & { sede: string })[];
  esOwner: boolean;
  conSede: boolean;
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
