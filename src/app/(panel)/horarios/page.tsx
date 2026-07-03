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

export const metadata: Metadata = { title: "Horarios" };

function ChipOcupacion({ horario }: { horario: HorarioConOcupacion }) {
  if (horario.cupo === null) {
    return (
      <span className="rounded-full bg-fondo px-2.5 py-1 text-xs font-semibold text-tinta-suave ring-1 ring-borde">
        {horario.inscriptos} inscriptos
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
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${estilos}`}>
      {horario.inscriptos}/{horario.cupo}
      {lleno ? " · Completo" : ""}
    </span>
  );
}

// Grilla semanal: la ocupación es inscriptos por horario (no hay asistencia).
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
      <h1 className="titulo-display text-4xl">Horarios</h1>
      <p className="mt-1 text-sm text-tinta-suave">
        Inscriptos por clase de {sede?.nombre ?? "la sede"}. Semana tipo (se
        repite igual todas las semanas).
      </p>

      {lista.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-borde bg-superficie px-6 py-12 text-center">
          <p className="font-medium">No hay horarios cargados en esta sede.</p>
          <p className="mt-1 text-sm text-tinta-suave">
            El admin los configura en Configuración → Disciplinas y horarios.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {dias.map((dia) => (
            <section key={dia}>
              <h2 className="titulo-display text-xl text-tinta-suave">
                {DIAS[dia]}
              </h2>
              <ul className="mt-2 grid gap-2">
                {porDia.get(dia)!.map((h) => (
                  <li
                    key={h.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-borde bg-superficie px-3.5 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold">
                        {formatoHora(h.hora)} · {h.disciplina}
                      </p>
                      {h.nota ? (
                        <p className="text-xs text-tinta-suave">{h.nota}</p>
                      ) : null}
                    </div>
                    <ChipOcupacion horario={h} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
