import type { Metadata } from "next";
import Link from "next/link";
import { requerirSeccion } from "@/lib/auth/guards";
import {
  alumnosDeDisciplina,
  buscarAlumnos,
  disciplinasConInscriptos,
} from "@/lib/operativa";
import { sedeActiva } from "@/lib/sedes";
import { EncabezadoSeccion } from "@/componentes/encabezado";
import { IconoAlumnos } from "@/componentes/iconos";

export const metadata: Metadata = { title: "Alumnos" };

type Alumno = {
  id: number;
  nombre: string;
  apellido: string;
  dni: string;
  telefono: string;
};

function ListaAlumnos({ lista }: { lista: Alumno[] }) {
  return (
    <ul className="tarjeta mt-4 overflow-hidden">
      {lista.map((alumno) => (
        <li key={alumno.id} className="border-b border-borde last:border-0">
          <Link
            href={`/alumnos/${alumno.id}`}
            className="flex items-center justify-between gap-3 px-4 py-3.5 transition hover:bg-fondo"
          >
            <span>
              <span className="block font-medium">
                {alumno.apellido}, {alumno.nombre}
              </span>
              <span className="block text-xs text-tinta-suave">
                DNI {alumno.dni} · {alumno.telefono}
              </span>
            </span>
            <span aria-hidden className="text-tinta-suave">
              ›
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// Sin búsqueda activa NO se listan todos los alumnos: se muestran las cards
// de disciplinas para ver quiénes van a cada una. El listado aparece al
// buscar o al entrar a una disciplina.
export default async function PaginaAlumnos({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; disciplina?: string }>;
}) {
  const usuario = await requerirSeccion("operativa");
  const sede = await sedeActiva(usuario);
  const { q = "", disciplina: disciplinaParam } = await searchParams;
  const termino = q.trim();

  const disciplinas = sede
    ? await disciplinasConInscriptos(usuario, sede.id)
    : [];
  const disciplinaElegida = disciplinas.find(
    (d) => d.id === Number(disciplinaParam),
  );

  const resultados =
    sede && termino ? await buscarAlumnos(usuario, sede.id, termino) : [];
  const alumnosDisciplina =
    sede && !termino && disciplinaElegida
      ? await alumnosDeDisciplina(usuario, sede.id, disciplinaElegida.id)
      : [];

  return (
    <div>
      <EncabezadoSeccion
        titulo="Alumnos"
        subtitulo={`Buscá por nombre o DNI, o entrá a una disciplina para ver quiénes la cursan${sede ? ` en ${sede.nombre}` : ""}.`}
        extra={
          <Link href="/alumnos/nuevo" className="boton-primario">
            + Nuevo alumno
          </Link>
        }
      >
        <form action="/alumnos" method="get" className="max-w-md">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Buscar por nombre, apellido o DNI…"
            aria-label="Buscar alumnos"
            className="h-12 w-full rounded-xl border border-white/20 bg-white/10 px-4 text-base text-white placeholder:text-white/50 outline-none backdrop-blur-sm transition focus:border-white/50 focus:bg-white/15"
          />
        </form>
      </EncabezadoSeccion>

      {termino ? (
        /* --- Resultados de búsqueda --- */
        <section className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="titulo-display text-2xl">
              Resultados «{termino}» ({resultados.length})
            </h2>
            <Link href="/alumnos" className="text-xs font-medium underline">
              limpiar búsqueda
            </Link>
          </div>
          {resultados.length === 0 ? (
            <div className="tarjeta mt-4 border-dashed px-6 py-12 text-center">
              <p className="font-medium">
                No encontramos alumnos con esa búsqueda.
              </p>
              <p className="mt-1 text-sm text-tinta-suave">
                Probá con otro nombre o DNI.
              </p>
            </div>
          ) : (
            <ListaAlumnos lista={resultados} />
          )}
        </section>
      ) : disciplinaElegida ? (
        /* --- Alumnos de una disciplina --- */
        <section className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="titulo-display text-2xl">
              {disciplinaElegida.nombre} ({alumnosDisciplina.length}{" "}
              {alumnosDisciplina.length === 1 ? "alumno" : "alumnos"})
            </h2>
            <Link href="/alumnos" className="text-xs font-medium underline">
              ← todas las disciplinas
            </Link>
          </div>
          {alumnosDisciplina.length === 0 ? (
            <div className="tarjeta mt-4 border-dashed px-6 py-12 text-center">
              <p className="font-medium">
                Todavía nadie cursa {disciplinaElegida.nombre}.
              </p>
              <p className="mt-1 text-sm text-tinta-suave">
                Los alumnos aparecen acá cuando se suscriben a un horario de la
                disciplina.
              </p>
            </div>
          ) : (
            <ListaAlumnos lista={alumnosDisciplina} />
          )}
        </section>
      ) : (
        /* --- Cards de disciplinas --- */
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-tinta-suave">
            Disciplinas de la sede
          </h2>
          {disciplinas.length === 0 ? (
            <div className="tarjeta mt-3 border-dashed px-6 py-12 text-center">
              <p className="font-medium">
                No hay disciplinas cargadas en esta sede.
              </p>
              <p className="mt-1 text-sm text-tinta-suave">
                El admin las configura en Configuración → Disciplinas y
                horarios.
              </p>
            </div>
          ) : (
            <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {disciplinas.map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/alumnos?disciplina=${d.id}`}
                    className="tarjeta tarjeta-interactiva group flex h-full flex-col p-5"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-marca-suave text-marca">
                      <IconoAlumnos className="h-6 w-6" />
                    </span>
                    <span className="titulo-display mt-3 text-2xl leading-tight">
                      {d.nombre}
                    </span>
                    <span className="mt-1 text-sm text-tinta-suave">
                      {d.inscriptos}{" "}
                      {d.inscriptos === 1 ? "alumno activo" : "alumnos activos"}
                    </span>
                    <span className="mt-4 text-xs font-semibold text-marca-oscuro transition group-hover:translate-x-0.5">
                      Ver quiénes la cursan →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
