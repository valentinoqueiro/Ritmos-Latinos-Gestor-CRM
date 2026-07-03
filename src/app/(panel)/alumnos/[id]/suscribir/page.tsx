import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirSeccion } from "@/lib/auth/guards";
import {
  DIAS,
  fichaDeAlumno,
  formatoHora,
  formatoMonto,
  horariosConOcupacion,
  planesDeSede,
} from "@/lib/operativa";
import { estaLleno, lugaresLibres } from "@/lib/reglas-suscripcion";
import { FormAccion } from "@/componentes/form-accion";
import { crearSuscripcion } from "../../acciones";

export const metadata: Metadata = { title: "Nueva suscripción" };

const ETIQUETA_TIPO = {
  disciplina: "Disciplina completa",
  pack: "Pack de disciplinas",
  frecuencia: "Por frecuencia",
} as const;

export default async function PaginaSuscribir({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ plan?: string }>;
}) {
  const usuario = await requerirSeccion("operativa");
  const { id } = await params;
  const { plan: planParam } = await searchParams;
  const ficha = await fichaDeAlumno(usuario, Number(id));
  if (!ficha) notFound();
  const { alumno } = ficha;

  const planes = await planesDeSede(usuario, alumno.sedeId);
  const planElegido = planParam
    ? (planes.find((p) => p.id === Number(planParam)) ?? null)
    : null;

  return (
    <div>
      <p className="text-sm text-tinta-suave">
        <Link href={`/alumnos/${alumno.id}`} className="underline">
          {alumno.nombre} {alumno.apellido}
        </Link>
      </p>
      <h1 className="titulo-display mt-1 text-4xl">Nueva suscripción</h1>

      {!planElegido ? (
        <>
          <p className="mt-1 text-sm text-tinta-suave">
            Elegí el plan. Los precios son los vigentes de hoy.
          </p>
          {planes.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-borde bg-superficie px-6 py-10 text-center text-sm text-tinta-suave">
              No hay planes activos en esta sede. El admin puede crearlos en
              Configuración.
            </div>
          ) : (
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {planes.map((plan) => (
                <li key={plan.id}>
                  <Link
                    href={`/alumnos/${alumno.id}/suscribir?plan=${plan.id}`}
                    className="block rounded-2xl border border-borde bg-superficie p-4 transition hover:border-marca"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold">{plan.nombre}</p>
                      <p className="titulo-display text-2xl text-marca">
                        {plan.precioVigente
                          ? formatoMonto(plan.precioVigente)
                          : "Sin precio"}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-tinta-suave">
                      {ETIQUETA_TIPO[plan.tipo]}
                      {plan.tipo === "frecuencia"
                        ? ` · ${plan.frecuenciaSemanal}x por semana`
                        : ""}{" "}
                      · {plan.disciplinas.map((d) => d.nombre).join(" + ")}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <PasoHorarios
          usuario={usuario}
          alumnoId={alumno.id}
          sedeId={alumno.sedeId}
          plan={planElegido}
        />
      )}
    </div>
  );
}

async function PasoHorarios({
  usuario,
  alumnoId,
  sedeId,
  plan,
}: {
  usuario: Awaited<ReturnType<typeof requerirSeccion>>;
  alumnoId: number;
  sedeId: number;
  plan: NonNullable<Awaited<ReturnType<typeof planesDeSede>>[number]>;
}) {
  const todos = await horariosConOcupacion(usuario, sedeId);
  const disciplinaIds = plan.disciplinas.map((d) => d.id);
  const disponibles = todos.filter((h) =>
    disciplinaIds.includes(h.disciplinaId),
  );
  const esFrecuencia = plan.tipo === "frecuencia";

  return (
    <div className="mt-4 max-w-xl">
      <div className="rounded-2xl border border-borde bg-superficie p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold">{plan.nombre}</p>
          <p className="titulo-display text-2xl text-marca">
            {plan.precioVigente ? formatoMonto(plan.precioVigente) : "—"}
          </p>
        </div>
        <p className="mt-1 text-xs text-tinta-suave">
          {ETIQUETA_TIPO[plan.tipo]} ·{" "}
          {plan.disciplinas.map((d) => d.nombre).join(" + ")} ·{" "}
          <Link href={`/alumnos/${alumnoId}/suscribir`} className="underline">
            cambiar plan
          </Link>
        </p>
      </div>

      <FormAccion
        accion={crearSuscripcion}
        textoBoton="Confirmar suscripción"
        className="mt-4"
      >
        <input type="hidden" name="alumnoId" value={alumnoId} />
        <input type="hidden" name="planId" value={plan.id} />

        {esFrecuencia ? (
          <>
            <p className="text-sm font-medium">
              Elegí exactamente {plan.frecuenciaSemanal}{" "}
              {plan.frecuenciaSemanal === 1 ? "horario" : "horarios"} fijos de
              la semana:
            </p>
            <ul className="mt-3 grid gap-2">
              {disponibles.map((h) => {
                const lleno = estaLleno(h);
                const libres = lugaresLibres(h);
                return (
                  <li key={h.id}>
                    <label
                      className={`flex items-center gap-3 rounded-xl border border-borde bg-superficie px-3 py-2.5 text-sm ${
                        lleno ? "opacity-50" : "cursor-pointer hover:border-marca"
                      }`}
                    >
                      <input
                        type="checkbox"
                        name="horarioIds"
                        value={h.id}
                        disabled={lleno}
                        className="h-4 w-4 accent-[#d93240]"
                      />
                      <span className="flex-1">
                        <span className="font-medium">
                          {DIAS[h.diaSemana]} {formatoHora(h.hora)}
                        </span>{" "}
                        · {h.disciplina}
                        {h.nota ? ` (${h.nota})` : ""}
                      </span>
                      <span
                        className={`text-xs font-medium ${
                          lleno ? "text-peligro" : "text-tinta-suave"
                        }`}
                      >
                        {h.cupo === null
                          ? `${h.inscriptos} inscriptos`
                          : lleno
                            ? "Completo"
                            : `${libres} ${libres === 1 ? "lugar" : "lugares"}`}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <>
            <p className="text-sm font-medium">
              Este plan incluye todas estas clases:
            </p>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {disponibles.map((h) => (
                <li
                  key={h.id}
                  className="rounded-full bg-fondo px-2.5 py-1 text-xs font-medium text-tinta-suave ring-1 ring-borde"
                >
                  {h.disciplina} · {DIAS[h.diaSemana]} {formatoHora(h.hora)}
                  {h.nota ? ` (${h.nota})` : ""}
                  {h.cupo !== null ? ` · ${h.inscriptos}/${h.cupo}` : ""}
                </li>
              ))}
            </ul>
          </>
        )}
      </FormAccion>
    </div>
  );
}
