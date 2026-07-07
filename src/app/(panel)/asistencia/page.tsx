import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, sum } from "drizzle-orm";
import { db } from "@/db";
import { asistenciasClase } from "@/db/schema";
import { requerirSeccion } from "@/lib/auth/guards";
import {
  diaSemanaISO,
  formatoFecha,
  hoyISO,
  sumarDias,
} from "@/lib/fechas";
import { DIAS, formatoHora, horariosConOcupacion } from "@/lib/operativa";
import { sedeActiva } from "@/lib/sedes";
import { Campo, Input } from "@/componentes/campos";
import { ChipBanner, EncabezadoSeccion } from "@/componentes/encabezado";
import { FormAccion } from "@/componentes/form-accion";
import { registrarAsistencia } from "./acciones";

export const metadata: Metadata = { title: "Asistencia" };

const FORMATO_ISO = /^\d{4}-\d{2}-\d{2}$/;

function BotonDia({
  href,
  children,
  deshabilitado,
}: {
  href: string;
  children: React.ReactNode;
  deshabilitado?: boolean;
}) {
  if (deshabilitado) {
    return (
      <span className="rounded-lg border border-borde bg-fondo px-3 py-2 text-sm font-semibold text-tinta-suave/50">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="rounded-lg border border-borde bg-superficie px-3 py-2 text-sm font-semibold transition hover:bg-fondo"
    >
      {children}
    </Link>
  );
}

// Registro de cuántos alumnos hubo en cada clase del día: un número por
// clase, editable si se cargó mal. Sirve como historial de concurrencia.
export default async function PaginaAsistencia({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string }>;
}) {
  const usuario = await requerirSeccion("operativa");
  const [sede, { fecha: fechaParam }] = await Promise.all([
    sedeActiva(usuario),
    searchParams,
  ]);
  const hoy = hoyISO();
  const fecha =
    fechaParam && FORMATO_ISO.test(fechaParam) && fechaParam <= hoy
      ? fechaParam
      : hoy;
  const dia = diaSemanaISO(fecha);

  const [clases, registros, ultimosDias] = await Promise.all([
    sede ? horariosConOcupacion(usuario, sede.id) : [],
    sede
      ? db
          .select()
          .from(asistenciasClase)
          .where(
            and(
              eq(asistenciasClase.sedeId, sede.id),
              eq(asistenciasClase.fecha, fecha),
            ),
          )
      : [],
    sede
      ? db
          .select({
            fecha: asistenciasClase.fecha,
            total: sum(asistenciasClase.cantidad),
          })
          .from(asistenciasClase)
          .where(eq(asistenciasClase.sedeId, sede.id))
          .groupBy(asistenciasClase.fecha)
          .orderBy(desc(asistenciasClase.fecha))
          .limit(14)
      : [],
  ]);

  const clasesDelDia = clases.filter((h) => h.diaSemana === dia);
  const registroDe = new Map(registros.map((r) => [r.horarioId, r]));
  const totalDelDia = registros.reduce((s, r) => s + r.cantidad, 0);

  return (
    <div>
      <EncabezadoSeccion
        titulo="Asistencia"
        subtitulo="Anotá cuántos alumnos hubo en cada clase para tener registro de concurrencia."
        extra={sede ? <ChipBanner etiqueta="Sede">{sede.nombre}</ChipBanner> : null}
      />

      {!sede ? (
        <div className="mt-6 tarjeta border-dashed px-6 py-12 text-center">
          <p className="font-medium">No tenés una sede asignada.</p>
          <p className="mt-1 text-sm text-tinta-suave">
            Pedile al administrador que te asigne una para registrar asistencia.
          </p>
        </div>
      ) : (
        <>
          {/* Navegación por día */}
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <BotonDia href={`/asistencia?fecha=${sumarDias(fecha, -1)}`}>
              ← {formatoFecha(sumarDias(fecha, -1))}
            </BotonDia>
            <span className="rounded-lg bg-tinta px-4 py-2 text-sm font-semibold text-white">
              {DIAS[dia]} {formatoFecha(fecha)}
              {fecha === hoy ? " · Hoy" : ""}
            </span>
            <BotonDia
              href={`/asistencia?fecha=${sumarDias(fecha, 1)}`}
              deshabilitado={fecha >= hoy}
            >
              {formatoFecha(sumarDias(fecha, 1))} →
            </BotonDia>
            {fecha !== hoy ? (
              <Link
                href="/asistencia"
                className="text-sm font-medium text-marca-oscuro underline"
              >
                Volver a hoy
              </Link>
            ) : null}
          </div>

          {/* Clases del día elegido */}
          {clasesDelDia.length === 0 ? (
            <div className="mt-4 tarjeta border-dashed px-6 py-10 text-center">
              <p className="font-medium">
                No hay clases los {DIAS[dia].toLowerCase()} en esta sede.
              </p>
            </div>
          ) : (
            <>
              {totalDelDia > 0 ? (
                <p className="mt-4 text-sm text-tinta-suave">
                  Total registrado del día:{" "}
                  <strong className="text-tinta">{totalDelDia} alumnos</strong>{" "}
                  en {registros.length} de {clasesDelDia.length} clases.
                </p>
              ) : null}
              <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {clasesDelDia.map((h) => {
                  const registro = registroDe.get(h.id);
                  return (
                    <li key={h.id} className="tarjeta p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="titulo-display text-lg leading-none text-marca-oscuro">
                          {formatoHora(h.hora)}
                        </p>
                        {registro ? (
                          <span className="rounded-full bg-ok/10 px-2.5 py-1 text-xs font-semibold text-ok">
                            {registro.cantidad} anotados ✓
                          </span>
                        ) : (
                          <span className="rounded-full bg-fondo px-2.5 py-1 text-xs font-semibold text-tinta-suave ring-1 ring-borde">
                            Sin registro
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-sm font-semibold leading-snug">
                        {h.disciplina}
                      </p>
                      {h.nota ? (
                        <p className="mt-0.5 text-xs text-tinta-suave">{h.nota}</p>
                      ) : null}
                      <FormAccion
                        accion={registrarAsistencia}
                        textoBoton={registro ? "Corregir" : "Guardar"}
                        variante={registro ? "secundario" : "primario"}
                        className="mt-3"
                      >
                        <input type="hidden" name="horarioId" value={h.id} />
                        <input type="hidden" name="fecha" value={fecha} />
                        <Campo etiqueta="Cantidad de alumnos">
                          <Input
                            name="cantidad"
                            inputMode="numeric"
                            required
                            placeholder={`Inscriptos: ${h.inscriptos}`}
                            defaultValue={registro?.cantidad}
                          />
                        </Campo>
                      </FormAccion>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {/* Días ya registrados, para volver a mirarlos o corregirlos */}
          {ultimosDias.length > 0 ? (
            <section className="mt-8">
              <h2 className="text-sm font-semibold text-tinta-suave">
                Últimos días con registro
              </h2>
              <ul className="tarjeta mt-3 overflow-hidden">
                {ultimosDias.map((d) => (
                  <li key={d.fecha} className="border-b border-borde last:border-0">
                    <Link
                      href={`/asistencia?fecha=${d.fecha}`}
                      className="flex items-center justify-between gap-2 px-4 py-3 text-sm transition hover:bg-fondo"
                    >
                      <span className="text-tinta-suave">
                        {DIAS[diaSemanaISO(d.fecha)]} {formatoFecha(d.fecha)}
                      </span>
                      <span className="font-medium tabular-nums">
                        {Number(d.total)} alumnos
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
