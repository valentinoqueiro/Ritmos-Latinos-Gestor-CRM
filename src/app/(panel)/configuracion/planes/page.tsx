import type { Metadata } from "next";
import Link from "next/link";
import { requerirSeccion } from "@/lib/auth/guards";
import { disciplinasDeSede, formatoMonto, planesDeSede } from "@/lib/operativa";
import { sedeActiva } from "@/lib/sedes";
import { Campo, Input, Select } from "@/componentes/campos";
import { FormAccion } from "@/componentes/form-accion";
import { actualizarPrecio, alternarPlan, crearPlan } from "../acciones";

export const metadata: Metadata = { title: "Planes y precios" };

const ETIQUETA_TIPO = {
  disciplina: "Disciplina completa",
  pack: "Pack de disciplinas",
  frecuencia: "Por frecuencia semanal",
} as const;

const ZONA = "America/Argentina/Buenos_Aires";

function formatoFechaHora(fecha: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: ZONA,
  }).format(fecha);
}

export default async function PaginaConfigPlanes() {
  const usuario = await requerirSeccion("configuracion");
  const sede = await sedeActiva(usuario);
  if (!sede) return null;
  const [planes, disciplinas] = await Promise.all([
    planesDeSede(usuario, sede.id, { incluirInactivos: true }),
    disciplinasDeSede(usuario, sede.id),
  ]);

  return (
    <div>
      <p className="text-sm text-tinta-suave">
        <Link href="/configuracion" className="underline">
          Configuración
        </Link>{" "}
        · {sede.nombre}
      </p>
      <h1 className="titulo-display mt-1 text-4xl">Planes y precios</h1>
      <p className="mt-1 text-sm text-tinta-suave">
        Cada actualización de precio queda en el historial; los planes con
        historia se desactivan, no se borran.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="grid gap-4">
          {planes.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-borde bg-superficie px-6 py-10 text-center text-sm text-tinta-suave">
              Todavía no hay planes en esta sede.
            </p>
          ) : (
            planes.map((plan) => (
              <section
                key={plan.id}
                className={`rounded-2xl border border-borde bg-superficie p-4 ${
                  plan.activo ? "" : "opacity-60"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-semibold">
                      {plan.nombre}
                      {!plan.activo ? " (inactivo)" : ""}
                    </h2>
                    <p className="text-xs text-tinta-suave">
                      {ETIQUETA_TIPO[plan.tipo]}
                      {plan.tipo === "frecuencia"
                        ? ` · ${plan.frecuenciaSemanal}x por semana`
                        : ""}{" "}
                      · {plan.disciplinas.map((d) => d.nombre).join(" + ")}
                    </p>
                  </div>
                  <p className="titulo-display text-3xl text-marca">
                    {plan.precioVigente
                      ? formatoMonto(plan.precioVigente)
                      : "Sin precio"}
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <FormAccion
                    accion={actualizarPrecio}
                    textoBoton="Actualizar precio"
                    variante="secundario"
                    className="flex items-end gap-2"
                  >
                    <input type="hidden" name="planId" value={plan.id} />
                    <Campo etiqueta="Precio nuevo ($)">
                      <Input
                        name="monto"
                        inputMode="numeric"
                        required
                        placeholder={plan.precioVigente ?? "0"}
                        className="w-32"
                      />
                    </Campo>
                  </FormAccion>
                  <form action={alternarPlan} className="pb-3">
                    <input type="hidden" name="id" value={plan.id} />
                    <button
                      type="submit"
                      className="text-xs font-medium text-tinta-suave underline"
                    >
                      {plan.activo ? "Desactivar plan" : "Reactivar plan"}
                    </button>
                  </form>
                </div>

                {plan.historialPrecios.length > 1 ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-medium text-tinta-suave">
                      Historial de precios ({plan.historialPrecios.length})
                    </summary>
                    <ul className="mt-2 grid gap-1 text-xs text-tinta-suave">
                      {plan.historialPrecios.map((p, i) => (
                        <li key={i}>
                          {formatoMonto(p.monto)} — vigente desde el{" "}
                          {formatoFechaHora(p.vigenteDesde)}
                          {i === 0 ? " (actual)" : ""}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </section>
            ))
          )}
        </div>

        <section className="self-start rounded-2xl border border-borde bg-superficie p-4">
          <h2 className="font-semibold">Nuevo plan</h2>
          {disciplinas.length === 0 ? (
            <p className="mt-2 text-sm text-tinta-suave">
              Primero creá las disciplinas de la sede.
            </p>
          ) : (
            <FormAccion
              accion={crearPlan}
              textoBoton="Crear plan"
              className="mt-3 grid gap-3"
            >
              <input type="hidden" name="sedeId" value={sede.id} />
              <Campo etiqueta="Nombre">
                <Input name="nombre" required placeholder="Ej.: Pole 2x semana" />
              </Campo>
              <Campo etiqueta="Tipo">
                <Select name="tipo" required defaultValue="disciplina">
                  <option value="disciplina">Disciplina completa</option>
                  <option value="frecuencia">
                    Por frecuencia (el alumno elige horarios)
                  </option>
                  <option value="pack">Pack de varias disciplinas</option>
                </Select>
              </Campo>
              <Campo etiqueta="Veces por semana (solo si es por frecuencia)">
                <Input
                  name="frecuenciaSemanal"
                  inputMode="numeric"
                  placeholder="Ej.: 2"
                />
              </Campo>
              <fieldset>
                <legend className="text-sm font-medium">Disciplinas</legend>
                <ul className="mt-1.5 grid gap-1.5">
                  {disciplinas.map((d) => (
                    <li key={d.id}>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          name="disciplinaIds"
                          value={d.id}
                          className="h-4 w-4 accent-[#d93240]"
                        />
                        {d.nombre}
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
              <Campo etiqueta="Precio inicial ($)">
                <Input name="precio" inputMode="numeric" required placeholder="45000" />
              </Campo>
            </FormAccion>
          )}
        </section>
      </div>
    </div>
  );
}
