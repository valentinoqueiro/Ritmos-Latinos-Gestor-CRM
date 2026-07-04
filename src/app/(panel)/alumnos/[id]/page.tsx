import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirSeccion } from "@/lib/auth/guards";
import { DIAS, fichaDeAlumno, formatoHora, formatoMonto } from "@/lib/operativa";
import { pagosDeSuscripciones, umbralPorVencer } from "@/lib/cobros";
import { formatoFecha, hoyISO } from "@/lib/fechas";
import { diasParaVencer, estadoCuota } from "@/lib/vencimientos";
import { Campo, Input } from "@/componentes/campos";
import { EstadoCuotaChip } from "@/componentes/estado-cuota";
import { FormAccion } from "@/componentes/form-accion";
import { darDeBajaSuscripcion, registrarEntrega } from "../acciones";

export const metadata: Metadata = { title: "Ficha del alumno" };

const ETIQUETA_MEDIO = { efectivo: "Efectivo", transferencia: "Transferencia" };

export default async function PaginaFichaAlumno({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pago?: string; saldo?: string }>;
}) {
  const usuario = await requerirSeccion("operativa");
  const { id } = await params;
  const { pago, saldo: saldoParam } = await searchParams;
  const ficha = await fichaDeAlumno(usuario, Number(id));
  if (!ficha) notFound();
  const { alumno, suscripciones } = ficha;
  const telefonoWa = alumno.telefono.replace(/\D/g, "");

  const [historial, umbral] = await Promise.all([
    pagosDeSuscripciones(suscripciones.map((s) => s.id)),
    umbralPorVencer(),
  ]);
  const hoy = hoyISO();
  const venceDe = (subId: number) =>
    historial
      .filter((p) => p.suscripcionId === subId)
      .reduce<string | null>((mx, p) => (mx && mx >= p.vence ? mx : p.vence), null);

  return (
    <div>
      {pago === "ok" ? (
        <p className="mb-4 rounded-xl bg-ok/10 px-4 py-3 text-sm font-medium text-ok">
          Pago registrado. Abajo ves hasta cuándo quedó habilitado.
        </p>
      ) : pago === "deudor" ? (
        <p className="mb-4 rounded-xl bg-alerta/10 px-4 py-3 text-sm font-medium text-alerta">
          Pago parcial registrado: queda debiendo{" "}
          {saldoParam ? formatoMonto(saldoParam) : "el resto"}. Podés completar
          la deuda desde el historial de pagos.
        </p>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="titulo-display text-4xl">
            {alumno.nombre} {alumno.apellido}
          </h1>
          <p className="mt-1 text-sm text-tinta-suave">
            DNI {alumno.dni}
            {alumno.fechaNacimiento
              ? ` · Nació el ${formatoFecha(alumno.fechaNacimiento)}`
              : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/alumnos/${alumno.id}/editar`}
            className="rounded-lg border border-borde bg-superficie px-4 py-2.5 text-sm font-semibold transition hover:bg-fondo"
          >
            Editar
          </Link>
          <Link
            href={`/alumnos/${alumno.id}/suscribir`}
            className="rounded-lg bg-marca px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-marca-oscuro"
          >
            + Suscripción
          </Link>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <a
          href={`https://wa.me/${telefonoWa}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-ok/10 px-3 py-1.5 font-medium text-ok transition hover:bg-ok/20"
        >
          WhatsApp {alumno.telefono}
        </a>
        {alumno.email ? (
          <span className="rounded-full bg-superficie px-3 py-1.5 text-tinta-suave ring-1 ring-borde">
            {alumno.email}
          </span>
        ) : null}
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-tinta-suave">
        Suscripciones y estado de cuota
      </h2>
      {suscripciones.length === 0 ? (
        <div className="mt-3 tarjeta border-dashed px-6 py-10 text-center">
          <p className="font-medium">Sin suscripciones todavía.</p>
          <p className="mt-1 text-sm text-tinta-suave">
            Creale una con el botón «+ Suscripción».
          </p>
        </div>
      ) : (
        <ul className="mt-3 grid gap-3">
          {suscripciones.map((sub) => {
            const vence = venceDe(sub.id);
            const pagosDeSub = historial.filter(
              (p) => p.suscripcionId === sub.id,
            );
            const deudaDeSub = pagosDeSub.reduce(
              (suma, p) => suma + p.saldoPendiente,
              0,
            );
            return (
              <li
                key={sub.id}
                className="tarjeta p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{sub.plan}</p>
                  <span className="flex flex-wrap items-center gap-1.5">
                    {deudaDeSub > 0 ? (
                      <span className="rounded-full bg-marca-suave px-2.5 py-1 text-xs font-semibold text-marca-oscuro">
                        Debe {formatoMonto(deudaDeSub)}
                      </span>
                    ) : null}
                    {sub.estado === "activa" ? (
                      <EstadoCuotaChip
                        estado={estadoCuota(vence, hoy, umbral)}
                        vence={vence}
                        diasRestantes={vence ? diasParaVencer(vence, hoy) : null}
                      />
                    ) : (
                      <span className="rounded-full bg-borde px-2.5 py-1 text-xs font-medium text-tinta-suave">
                        Dada de baja
                      </span>
                    )}
                  </span>
                </div>
                <p className="mt-1 text-sm text-tinta-suave">
                  Alta el {formatoFecha(sub.fechaAlta)}
                  {sub.fechaBaja
                    ? ` · Baja el ${formatoFecha(sub.fechaBaja)}${
                        sub.motivoBaja ? ` (${sub.motivoBaja})` : ""
                      }`
                    : ""}
                </p>
                {sub.horarios.length > 0 ? (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {sub.horarios.map((h, i) => (
                      <li
                        key={i}
                        className="rounded-full bg-fondo px-2.5 py-1 text-xs font-medium text-tinta-suave ring-1 ring-borde"
                      >
                        {h.disciplina} · {DIAS[h.diaSemana]} {formatoHora(h.hora)}
                        {h.nota ? ` (${h.nota})` : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {sub.estado === "activa" ? (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <Link
                      href={`/alumnos/${alumno.id}/pagar?sub=${sub.id}`}
                      className="rounded-lg bg-marca px-4 py-2 text-sm font-semibold text-white transition hover:bg-marca-oscuro"
                    >
                      Registrar pago
                    </Link>
                    <details>
                      <summary className="cursor-pointer text-sm font-medium text-tinta-suave">
                        Dar de baja…
                      </summary>
                      <FormAccion
                        accion={darDeBajaSuscripcion}
                        textoBoton="Confirmar baja"
                        variante="peligro"
                        className="mt-2 max-w-sm"
                      >
                        <input
                          type="hidden"
                          name="suscripcionId"
                          value={sub.id}
                        />
                        <Campo etiqueta="Motivo (opcional)">
                          <Input name="motivo" placeholder="Ej.: se mudó" />
                        </Campo>
                      </FormAccion>
                    </details>
                  </div>
                ) : null}

                {pagosDeSub.length > 0 ? (
                  <details className="mt-3" open={deudaDeSub > 0}>
                    <summary className="cursor-pointer text-sm font-medium text-tinta-suave">
                      Historial de pagos ({pagosDeSub.length})
                    </summary>
                    <ul className="mt-2 grid gap-1.5">
                      {pagosDeSub.map((p) => (
                        <li
                          key={p.id}
                          className="rounded-lg bg-fondo px-3 py-2 text-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span>
                              Contrato del {formatoFecha(p.fechaPago)}
                              {p.nota ? (
                                <span
                                  className="ml-1 text-xs text-tinta-suave"
                                  title={p.nota}
                                >
                                  · corregido
                                </span>
                              ) : null}
                            </span>
                            <span className="font-medium">
                              {formatoMonto(p.monto)}
                              <span className="ml-2 text-xs text-tinta-suave">
                                habilitó hasta el {formatoFecha(p.vence)}
                              </span>
                            </span>
                          </div>
                          {p.entregas.length > 0 ? (
                            <ul className="mt-1.5 grid gap-0.5 border-l-2 border-borde pl-3 text-xs text-tinta-suave">
                              {p.entregas.map((e) => (
                                <li key={e.id}>
                                  {formatoFecha(e.fecha)} ·{" "}
                                  {ETIQUETA_MEDIO[e.medio]} ·{" "}
                                  {formatoMonto(e.monto)}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                          {p.saldoPendiente > 0 ? (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-xs font-semibold text-marca-oscuro">
                                Completar deuda ({formatoMonto(p.saldoPendiente)})…
                              </summary>
                              <FormAccion
                                accion={registrarEntrega}
                                textoBoton="Registrar entrega"
                                className="mt-2 max-w-sm"
                              >
                                <input type="hidden" name="pagoId" value={p.id} />
                                <div className="grid grid-cols-2 gap-3">
                                  <Campo etiqueta="Efectivo ($)">
                                    <Input
                                      name="efectivo"
                                      inputMode="numeric"
                                      placeholder="0"
                                      defaultValue={p.saldoPendiente}
                                    />
                                  </Campo>
                                  <Campo etiqueta="Transferencia ($)">
                                    <Input
                                      name="transferencia"
                                      inputMode="numeric"
                                      placeholder="0"
                                    />
                                  </Campo>
                                </div>
                              </FormAccion>
                            </details>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
