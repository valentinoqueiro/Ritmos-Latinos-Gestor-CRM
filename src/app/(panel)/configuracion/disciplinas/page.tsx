import type { Metadata } from "next";
import Link from "next/link";
import { requerirSeccion } from "@/lib/auth/guards";
import {
  DIAS,
  disciplinasDeSede,
  formatoHora,
  horariosConOcupacion,
} from "@/lib/operativa";
import { sedeActiva } from "@/lib/sedes";
import { Campo, Input, Select } from "@/componentes/campos";
import { FormAccion } from "@/componentes/form-accion";
import {
  alternarDisciplina,
  alternarHorario,
  crearDisciplina,
  crearHorario,
  editarCupo,
} from "../acciones";

export const metadata: Metadata = { title: "Disciplinas y horarios" };

export default async function PaginaConfigDisciplinas() {
  const usuario = await requerirSeccion("configuracion");
  const sede = await sedeActiva(usuario);
  if (!sede) return null;
  const [lista, horarios] = await Promise.all([
    disciplinasDeSede(usuario, sede.id, { incluirInactivas: true }),
    horariosConOcupacion(usuario, sede.id, { incluirInactivos: true }),
  ]);
  const activas = lista.filter((d) => d.activa);

  return (
    <div>
      <p className="text-sm text-tinta-suave">
        <Link href="/configuracion" className="underline">
          Configuración
        </Link>{" "}
        · {sede.nombre}
      </p>
      <h1 className="titulo-display mt-1 text-4xl">Disciplinas y horarios</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="grid gap-4">
          {lista.length === 0 ? (
            <p className="tarjeta border-dashed px-6 py-10 text-center text-sm text-tinta-suave">
              Todavía no hay disciplinas en esta sede. Creá la primera con el
              formulario.
            </p>
          ) : (
            lista.map((disciplina) => {
              const propios = horarios.filter(
                (h) => h.disciplinaId === disciplina.id,
              );
              return (
                <section
                  key={disciplina.id}
                  className={`tarjeta p-4 ${
                    disciplina.activa ? "" : "opacity-60"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-semibold">
                      {disciplina.nombre}
                      {!disciplina.activa ? " (inactiva)" : ""}
                    </h2>
                    <form action={alternarDisciplina}>
                      <input type="hidden" name="id" value={disciplina.id} />
                      <button
                        type="submit"
                        className="text-xs font-medium text-tinta-suave underline"
                      >
                        {disciplina.activa ? "Desactivar" : "Reactivar"}
                      </button>
                    </form>
                  </div>

                  {propios.length === 0 ? (
                    <p className="mt-2 text-sm text-tinta-suave">
                      Sin horarios cargados.
                    </p>
                  ) : (
                    <ul className="mt-3 grid gap-2">
                      {propios.map((h) => (
                        <li
                          key={h.id}
                          className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border border-borde px-3 py-2 text-sm ${
                            h.activo ? "" : "opacity-60"
                          }`}
                        >
                          <span className="font-medium">
                            {DIAS[h.diaSemana]} {formatoHora(h.hora)}
                            {h.nota ? (
                              <span className="text-tinta-suave"> · {h.nota}</span>
                            ) : null}
                            {!h.activo ? " (inactivo)" : ""}
                          </span>
                          <span className="flex items-center gap-2">
                            <form
                              action={editarCupo}
                              className="flex items-center gap-1"
                            >
                              <input type="hidden" name="id" value={h.id} />
                              <label className="text-xs text-tinta-suave">
                                Cupo
                                <input
                                  name="cupo"
                                  defaultValue={h.cupo ?? ""}
                                  inputMode="numeric"
                                  placeholder="—"
                                  className="ml-1 w-14 rounded-md border border-borde px-1.5 py-1 text-center text-xs"
                                />
                              </label>
                              <button
                                type="submit"
                                className="text-xs font-medium underline"
                              >
                                OK
                              </button>
                            </form>
                            <span className="text-xs text-tinta-suave">
                              {h.inscriptos} insc.
                            </span>
                            <form action={alternarHorario}>
                              <input type="hidden" name="id" value={h.id} />
                              <button
                                type="submit"
                                className="text-xs font-medium text-tinta-suave underline"
                              >
                                {h.activo ? "Desactivar" : "Reactivar"}
                              </button>
                            </form>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })
          )}
        </div>

        <div className="grid gap-4 self-start">
          <section className="tarjeta p-4">
            <h2 className="font-semibold">Nueva disciplina</h2>
            <FormAccion
              accion={crearDisciplina}
              textoBoton="Crear disciplina"
              className="mt-3 grid gap-3"
            >
              <input type="hidden" name="sedeId" value={sede.id} />
              <Campo etiqueta="Nombre">
                <Input name="nombre" required placeholder="Ej.: Pole Sport" />
              </Campo>
            </FormAccion>
          </section>

          <section className="tarjeta p-4">
            <h2 className="font-semibold">Nuevo horario</h2>
            {activas.length === 0 ? (
              <p className="mt-2 text-sm text-tinta-suave">
                Primero creá una disciplina.
              </p>
            ) : (
              <FormAccion
                accion={crearHorario}
                textoBoton="Agregar horario"
                className="mt-3 grid gap-3"
              >
                <Campo etiqueta="Disciplina">
                  <Select name="disciplinaId" required>
                    {activas.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nombre}
                      </option>
                    ))}
                  </Select>
                </Campo>
                <div className="grid grid-cols-2 gap-3">
                  <Campo etiqueta="Día">
                    <Select name="diaSemana" required>
                      {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                        <option key={d} value={d}>
                          {DIAS[d]}
                        </option>
                      ))}
                    </Select>
                  </Campo>
                  <Campo etiqueta="Hora">
                    <Input name="hora" type="time" required />
                  </Campo>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Campo etiqueta="Cupo (opcional)">
                    <Input name="cupo" inputMode="numeric" placeholder="Sin límite" />
                  </Campo>
                  <Campo etiqueta="Nota (opcional)">
                    <Input name="nota" placeholder="Ej.: Principiantes" />
                  </Campo>
                </div>
              </FormAccion>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
