import type { Metadata } from "next";
import { requerirSeccion } from "@/lib/auth/guards";
import {
  DIAS,
  formatoHora,
  horariosConOcupacion,
  type HorarioConOcupacion,
} from "@/lib/operativa";
import { estaLleno } from "@/lib/reglas-suscripcion";
import { sedeActiva } from "@/lib/sedes";
import { ChipBanner, EncabezadoSeccion } from "@/componentes/encabezado";

export const metadata: Metadata = { title: "Horarios" };

function ChipOcupacion({ horario }: { horario: HorarioConOcupacion }) {
  if (horario.cupo === null) {
    return (
      <span className="rounded-full bg-fondo px-2.5 py-1 text-xs font-semibold text-tinta-suave ring-1 ring-borde">
        {horario.inscriptos} insc.
      </span>
    );
  }
  const lleno = estaLleno(horario);
  const casiLleno = !lleno && horario.inscriptos >= horario.cupo * 0.8;
  const estilos = lleno
    ? "bg-marca-suave text-peligro"
    : casiLleno
      ? "bg-alerta/10 text-alerta"
      : "bg-ok/10 text-ok";
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${estilos}`}
    >
      {horario.inscriptos}/{horario.cupo}
      {lleno ? " · Lleno" : ""}
    </span>
  );
}

// Grilla semanal tipo agenda: una columna por día, todos a la vista en
// escritorio (nada queda "abajo"). La ocupación es inscriptos por horario.
export default async function PaginaHorarios() {
  const usuario = await requerirSeccion("operativa");
  const sede = await sedeActiva(usuario);
  const lista = sede ? await horariosConOcupacion(usuario, sede.id) : [];

  const porDia = new Map<number, HorarioConOcupacion[]>();
  for (const h of lista) {
    porDia.set(h.diaSemana, [...(porDia.get(h.diaSemana) ?? []), h]);
  }
  const dias = [...porDia.keys()].sort((a, b) => a - b);

  return (
    <div>
      <EncabezadoSeccion
        titulo="Horarios"
        subtitulo={`Semana tipo de ${sede?.nombre ?? "la sede"} (se repite igual todas las semanas).`}
        extra={
          <ChipBanner etiqueta="Clases por semana">{lista.length}</ChipBanner>
        }
      />

      {lista.length === 0 ? (
        <div className="tarjeta mt-6 border-dashed px-6 py-12 text-center">
          <p className="font-medium">No hay horarios cargados en esta sede.</p>
          <p className="mt-1 text-sm text-tinta-suave">
            El admin los configura en Configuración → Disciplinas y horarios.
          </p>
        </div>
      ) : (
        <div
          className="mt-6 grid items-start gap-4"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(15rem, 1fr))",
          }}
        >
          {dias.map((dia) => {
            const clases = porDia.get(dia)!;
            return (
              <section key={dia} className="tarjeta overflow-hidden">
                <header className="flex items-center justify-between gap-2 border-b border-borde bg-fondo/60 px-4 py-3">
                  <h2 className="titulo-display text-xl leading-none">
                    {DIAS[dia]}
                  </h2>
                  <span className="rounded-full bg-superficie px-2 py-0.5 text-[11px] font-semibold text-tinta-suave ring-1 ring-borde">
                    {clases.length} {clases.length === 1 ? "clase" : "clases"}
                  </span>
                </header>
                <ul className="grid gap-2 p-3">
                  {clases.map((h) => (
                    <li
                      key={h.id}
                      className="rounded-xl border border-borde bg-fondo/40 p-3 transition hover:border-marca/40 hover:bg-superficie"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="titulo-display text-lg leading-none text-marca-oscuro">
                          {formatoHora(h.hora)}
                        </p>
                        <ChipOcupacion horario={h} />
                      </div>
                      <p className="mt-1.5 text-sm font-semibold leading-snug">
                        {h.disciplina}
                      </p>
                      {h.nota ? (
                        <p className="mt-0.5 text-xs text-tinta-suave">
                          {h.nota}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
