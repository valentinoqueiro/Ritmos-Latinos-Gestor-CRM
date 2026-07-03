import type { Metadata } from "next";
import Link from "next/link";
import { requerirSeccion } from "@/lib/auth/guards";
import { buscarAlumnos } from "@/lib/operativa";
import { sedeActiva } from "@/lib/sedes";
import { claseInput } from "@/componentes/campos";

export const metadata: Metadata = { title: "Alumnos" };

export default async function PaginaAlumnos({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const usuario = await requerirSeccion("operativa");
  const sede = await sedeActiva(usuario);
  const { q = "" } = await searchParams;
  const lista = sede ? await buscarAlumnos(usuario, sede.id, q) : [];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="titulo-display text-4xl">Alumnos</h1>
        <Link
          href="/alumnos/nuevo"
          className="rounded-lg bg-marca px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-marca-oscuro"
        >
          + Nuevo alumno
        </Link>
      </div>

      <form className="mt-5" action="/alumnos" method="get">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre, apellido o DNI…"
          className={`${claseInput} w-full max-w-md`}
        />
      </form>

      {lista.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-borde bg-superficie px-6 py-12 text-center">
          <p className="font-medium">
            {q ? "No encontramos alumnos con esa búsqueda." : "Todavía no hay alumnos cargados."}
          </p>
          <p className="mt-1 text-sm text-tinta-suave">
            {q ? "Probá con otro nombre o DNI." : "Creá el primero con el botón «Nuevo alumno»."}
          </p>
        </div>
      ) : (
        <ul className="mt-6 overflow-hidden rounded-2xl border border-borde bg-superficie">
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
      )}
    </div>
  );
}
