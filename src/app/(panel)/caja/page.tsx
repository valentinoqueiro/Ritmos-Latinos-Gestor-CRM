import type { Metadata } from "next";
import Link from "next/link";
import { requerirSeccion } from "@/lib/auth/guards";
import {
  detalleDeTurno,
  historialDeTurnos,
  turnoAbierto,
  turnosRecientesGlobal,
  type DetalleTurno,
} from "@/lib/caja";
import { ZONA_HORARIA } from "@/lib/fechas";
import { formatoMonto } from "@/lib/operativa";
import { sedeActiva, sedesVisibles } from "@/lib/sedes";
import { Campo, Input } from "@/componentes/campos";
import { ChipBanner, EncabezadoSeccion } from "@/componentes/encabezado";
import { FormAccion } from "@/componentes/form-accion";
import { abrirTurno, cerrarTurno, registrarMovimientoCaja } from "./acciones";

export const metadata: Metadata = { title: "Caja" };

const HORAS_TURNO_LARGO = 16;

// Aviso de turno olvidado (¿quedó abierto del día anterior?).
function esTurnoLargo(abiertoEn: Date): boolean {
  return Date.now() - abiertoEn.getTime() > HORAS_TURNO_LARGO * 3_600_000;
}

function formatoHora(fecha: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: ZONA_HORARIA,
    hour: "2-digit",
    minute: "2-digit",
  }).format(fecha);
}

function formatoFechaHora(fecha: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: ZONA_HORARIA,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(fecha);
}

function TilesResumen({ detalle }: { detalle: DetalleTurno }) {
  const { resumen } = detalle;
  const tiles = [
    { etiqueta: "Nuevos", valor: String(resumen.nuevos) },
    { etiqueta: "Renovados", valor: String(resumen.renovados) },
    { etiqueta: "Efectivo", valor: formatoMonto(resumen.totalEfectivo) },
    {
      etiqueta: "Transferencia",
      valor: formatoMonto(resumen.totalTransferencia),
    },
    { etiqueta: "Egresos", valor: formatoMonto(resumen.egresos) },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {tiles.map((t) => (
        <div key={t.etiqueta} className="rounded-xl bg-fondo/70 px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-tinta-suave">
            {t.etiqueta}
          </p>
          <p className="titulo-display mt-0.5 text-2xl">{t.valor}</p>
        </div>
      ))}
    </div>
  );
}

// La caja es el día a día de la secretaria: abre al llegar, registra egresos
// y cierra al irse. Todo el resumen es derivado (reglas-caja.ts).
export default async function PaginaCaja({
  searchParams,
}: {
  searchParams: Promise<{ cierre?: string; detalle?: string }>;
}) {
  const usuario = await requerirSeccion("operativa");
  const [sede, { cierre, detalle: detalleParam }] = await Promise.all([
    sedeActiva(usuario),
    searchParams,
  ]);
  const esAdmin = usuario.rol === "admin";

  const turno = sede ? await turnoAbierto(sede.id) : null;
  const [detalle, cierreDetalle, historial, turnosGlobal, detalleElegido] =
    await Promise.all([
      turno ? detalleDeTurno(usuario, turno.id) : null,
      cierre ? detalleDeTurno(usuario, Number(cierre)) : null,
      sede && !esAdmin ? historialDeTurnos(usuario, sede.id) : [],
      esAdmin ? turnosRecientesGlobal(usuario) : [],
      esAdmin && detalleParam
        ? detalleDeTurno(usuario, Number(detalleParam))
        : null,
    ]);
  const sedeDeDetalle = detalleElegido
    ? (await sedesVisibles(usuario)).find(
        (s) => s.id === detalleElegido.turno.sedeId,
      )?.nombre
    : undefined;

  return (
    <div>
      <EncabezadoSeccion
        titulo="Caja"
        subtitulo={
          turno
            ? `Turno abierto desde las ${formatoHora(turno.abiertoEn)}.`
            : "Abrí el turno al llegar para que los cobros del día queden en tu cierre."
        }
        extra={sede ? <ChipBanner etiqueta="Sede">{sede.nombre}</ChipBanner> : null}
      />

      {/* Resumen del turno recién cerrado */}
      {cierreDetalle && cierreDetalle.turno.cerradoEn ? (
        <section className="mt-6 tarjeta border-t-4 border-t-ok p-5">
          <h2 className="titulo-display text-2xl text-ok">Turno cerrado ✔</h2>
          <p className="mt-1 text-sm text-tinta-suave">
            {formatoFechaHora(cierreDetalle.turno.abiertoEn)} →{" "}
            {formatoFechaHora(cierreDetalle.turno.cerradoEn)}
            {cierreDetalle.turno.notaCierre
              ? ` · ${cierreDetalle.turno.notaCierre}`
              : ""}
          </p>
          <div className="mt-4">
            <TilesResumen detalle={cierreDetalle} />
          </div>
          <p className="mt-4 text-sm">
            Efectivo que debería quedar en caja:{" "}
            <strong
              className={
                cierreDetalle.resumen.efectivoEsperado < 0
                  ? "text-peligro"
                  : ""
              }
            >
              {formatoMonto(cierreDetalle.resumen.efectivoEsperado)}
            </strong>
            {cierreDetalle.turno.efectivoInicial
              ? ` (incluye ${formatoMonto(cierreDetalle.turno.efectivoInicial)} de apertura)`
              : ""}
          </p>
        </section>
      ) : null}

      {!sede ? (
        <div className="mt-6 tarjeta border-dashed px-6 py-12 text-center">
          <p className="font-medium">No tenés una sede asignada.</p>
          <p className="mt-1 text-sm text-tinta-suave">
            Pedile al administrador que te asigne una para operar la caja.
          </p>
        </div>
      ) : turno && detalle ? (
        <>
          {/* Turno en curso */}
          <section className="mt-6 tarjeta p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="titulo-display text-2xl">Turno en curso</h2>
              <p className="text-sm text-tinta-suave">
                Abierto a las {formatoHora(turno.abiertoEn)}
                {turno.efectivoInicial
                  ? ` con ${formatoMonto(turno.efectivoInicial)} en caja`
                  : ""}
              </p>
            </div>
            {esTurnoLargo(turno.abiertoEn) ? (
              <p className="mt-3 rounded-lg bg-alerta/10 px-3 py-2 text-sm font-medium text-alerta">
                Este turno lleva más de {HORAS_TURNO_LARGO} horas abierto.
                ¿Quedó sin cerrar del día anterior?
              </p>
            ) : null}
            <div className="mt-4">
              <TilesResumen detalle={detalle} />
            </div>
            <p className="mt-4 rounded-xl bg-tinta px-4 py-3 text-sm text-white">
              Efectivo que debería haber en caja ahora:{" "}
              <strong
                className={
                  detalle.resumen.efectivoEsperado < 0 ? "text-marca" : ""
                }
              >
                {formatoMonto(detalle.resumen.efectivoEsperado)}
              </strong>
            </p>
          </section>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {/* Egresos */}
            <section className="tarjeta p-5">
              <h2 className="text-sm font-semibold text-tinta-suave">
                Egresos del turno
              </h2>
              {detalle.movimientos.length === 0 ? (
                <p className="mt-2 text-sm text-tinta-suave">
                  Sin egresos por ahora.
                </p>
              ) : (
                <ul className="mt-2 grid gap-1.5 text-sm">
                  {detalle.movimientos.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center justify-between gap-2 rounded-lg bg-fondo px-3 py-2"
                    >
                      <span className="min-w-0 truncate">
                        {formatoHora(m.creadoEn)} · {m.concepto}
                      </span>
                      <span className="shrink-0 font-medium">
                        −{formatoMonto(m.monto)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-medium text-marca-oscuro">
                  Registrar egreso…
                </summary>
                <FormAccion
                  accion={registrarMovimientoCaja}
                  textoBoton="Registrar egreso"
                  variante="secundario"
                  className="mt-2"
                >
                  <input type="hidden" name="turnoId" value={turno.id} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Campo etiqueta="Monto ($)">
                      <Input name="monto" inputMode="numeric" required />
                    </Campo>
                    <Campo etiqueta="Concepto">
                      <Input
                        name="concepto"
                        required
                        placeholder="Ej.: agua y descartables"
                      />
                    </Campo>
                  </div>
                </FormAccion>
              </details>
            </section>

            {/* Cierre */}
            <section className="tarjeta p-5">
              <h2 className="text-sm font-semibold text-tinta-suave">
                Cierre de turno
              </h2>
              <p className="mt-2 text-sm text-tinta-suave">
                Al cerrar queda el resumen final: renovados, nuevos, efectivo,
                transferencia y egresos. Los cobros posteriores van al turno
                siguiente.
              </p>
              <FormAccion
                accion={cerrarTurno}
                textoBoton="Cerrar turno"
                textoEnviando="Cerrando…"
                variante="peligro"
                className="mt-3"
              >
                <input type="hidden" name="turnoId" value={turno.id} />
                <Campo etiqueta="Nota de cierre (opcional)">
                  <Input
                    name="notaCierre"
                    placeholder="Ej.: faltó cambio, quedó $2.000 de menos"
                  />
                </Campo>
              </FormAccion>
            </section>
          </div>
        </>
      ) : (
        /* Caja cerrada: abrir turno */
        <section className="mt-6 tarjeta p-5">
          <h2 className="titulo-display text-2xl">Abrir turno</h2>
          <p className="mt-1 text-sm text-tinta-suave">
            Declarar el efectivo con el que arranca la caja permite saber
            cuánto debería quedar al cierre.
          </p>
          <FormAccion
            accion={abrirTurno}
            textoBoton="Abrir turno"
            className="mt-3 max-w-sm"
          >
            <input type="hidden" name="sedeId" value={sede.id} />
            <Campo etiqueta="Efectivo inicial en caja ($)">
              <Input
                name="efectivoInicial"
                inputMode="numeric"
                placeholder="0"
              />
            </Campo>
          </FormAccion>
        </section>
      )}

      {/* Historial de cierres de la sede (secretaria) */}
      {historial.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-tinta-suave">
            Últimos cierres
          </h2>
          <ul className="tarjeta mt-3 overflow-hidden">
            {historial.map(({ turno: t, ...totales }) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-borde px-4 py-3 text-sm last:border-0"
              >
                <span className="text-tinta-suave">
                  {formatoFechaHora(t.abiertoEn)} →{" "}
                  {t.cerradoEn ? formatoHora(t.cerradoEn) : "—"}
                  {t.notaCierre ? ` · ${t.notaCierre}` : ""}
                </span>
                <span className="flex flex-wrap gap-3 font-medium tabular-nums">
                  <span>Ef. {formatoMonto(totales.totalEfectivo)}</span>
                  <span>Transf. {formatoMonto(totales.totalTransferencia)}</span>
                  <span className="text-tinta-suave">
                    Egresos {formatoMonto(totales.egresos)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Todas las cajas, de todas las sedes (solo admin) */}
      {esAdmin ? (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-tinta-suave">
            Cajas de todas las sedes
          </h2>

          {detalleElegido ? (
            <div className="tarjeta mt-3 border-t-4 border-t-marca p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="titulo-display text-2xl">
                  {sedeDeDetalle ?? "Sede"} ·{" "}
                  {detalleElegido.turno.cerradoEn ? "Turno cerrado" : "Turno abierto"}
                </h3>
                <Link
                  href="/caja"
                  className="text-sm font-medium text-marca-oscuro underline"
                >
                  Cerrar detalle
                </Link>
              </div>
              <p className="mt-1 text-sm text-tinta-suave">
                {formatoFechaHora(detalleElegido.turno.abiertoEn)} →{" "}
                {detalleElegido.turno.cerradoEn
                  ? formatoFechaHora(detalleElegido.turno.cerradoEn)
                  : "en curso"}
                {detalleElegido.turno.notaCierre
                  ? ` · ${detalleElegido.turno.notaCierre}`
                  : ""}
              </p>
              <div className="mt-4">
                <TilesResumen detalle={detalleElegido} />
              </div>
              <h4 className="mt-4 text-sm font-semibold text-tinta-suave">
                Egresos del turno
              </h4>
              {detalleElegido.movimientos.length === 0 ? (
                <p className="mt-1 text-sm text-tinta-suave">Sin egresos.</p>
              ) : (
                <ul className="mt-1.5 grid gap-1.5 text-sm">
                  {detalleElegido.movimientos.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center justify-between gap-2 rounded-lg bg-fondo px-3 py-2"
                    >
                      <span className="min-w-0 truncate">
                        {formatoFechaHora(m.creadoEn)} · {m.concepto}
                      </span>
                      <span className="shrink-0 font-medium">
                        −{formatoMonto(m.monto)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-4 text-sm">
                Efectivo que{" "}
                {detalleElegido.turno.cerradoEn ? "debería haber quedado" : "debería haber"}{" "}
                en caja:{" "}
                <strong>
                  {formatoMonto(detalleElegido.resumen.efectivoEsperado)}
                </strong>
                {detalleElegido.turno.efectivoInicial
                  ? ` (incluye ${formatoMonto(detalleElegido.turno.efectivoInicial)} de apertura)`
                  : ""}
              </p>
            </div>
          ) : null}

          {turnosGlobal.length === 0 ? (
            <p className="mt-3 text-sm text-tinta-suave">
              Todavía no hay turnos de caja en ninguna sede.
            </p>
          ) : (
            <ul className="tarjeta mt-3 overflow-hidden">
              {turnosGlobal.map(({ turno: t, sedeNombre, ...totales }) => (
                <li key={t.id} className="border-b border-borde last:border-0">
                  <Link
                    href={`/caja?detalle=${t.id}`}
                    className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm transition hover:bg-fondo ${
                      detalleElegido?.turno.id === t.id ? "bg-marca-suave/40" : ""
                    }`}
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-fondo px-2.5 py-0.5 text-xs font-semibold ring-1 ring-borde">
                        {sedeNombre}
                      </span>
                      {!t.cerradoEn ? (
                        <span className="rounded-full bg-ok/10 px-2.5 py-0.5 text-xs font-semibold text-ok">
                          Abierto
                        </span>
                      ) : null}
                      <span className="text-tinta-suave">
                        {formatoFechaHora(t.abiertoEn)} →{" "}
                        {t.cerradoEn ? formatoHora(t.cerradoEn) : "—"}
                        {t.notaCierre ? ` · ${t.notaCierre}` : ""}
                      </span>
                    </span>
                    <span className="flex flex-wrap gap-3 font-medium tabular-nums">
                      <span>Ef. {formatoMonto(totales.totalEfectivo)}</span>
                      <span>
                        Transf. {formatoMonto(totales.totalTransferencia)}
                      </span>
                      <span className="text-tinta-suave">
                        Egresos {formatoMonto(totales.egresos)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
