import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { usuarios } from "@/db/schema";
import { requerirSeccion } from "@/lib/auth/guards";
import { sedesVisibles } from "@/lib/sedes";

export const metadata: Metadata = { title: "Configuración" };

const ETIQUETA_ROL: Record<string, string> = {
  secretaria: "Secretaría",
  admin: "Administración",
  owner: "Dueños (solo lectura)",
};

export default async function PaginaConfiguracion() {
  const usuario = await requerirSeccion("configuracion");
  const [sedes, listaUsuarios] = await Promise.all([
    sedesVisibles(usuario),
    db.query.usuarios.findMany({ orderBy: asc(usuarios.nombre) }),
  ]);
  const nombreSede = (sedeId: number | null) =>
    sedes.find((s) => s.id === sedeId)?.nombre ?? "Todas";

  return (
    <div>
      <h1 className="titulo-display text-4xl">Configuración</h1>
      <p className="mt-1 text-sm text-tinta-suave">
        Planes, precios, horarios y categorías se suman en las próximas fases.
      </p>

      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-tinta-suave">
          Sedes
        </h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {sedes.map((sede) => (
            <li
              key={sede.id}
              className="rounded-2xl border border-borde bg-superficie p-4"
            >
              <p className="font-semibold">{sede.nombre}</p>
              <p className="mt-0.5 text-sm text-tinta-suave">
                {sede.direccion}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-tinta-suave">
          Usuarios
        </h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-borde bg-superficie">
          <table className="w-full min-w-130 text-left text-sm">
            <thead>
              <tr className="border-b border-borde text-xs uppercase tracking-wide text-tinta-suave">
                <th className="px-4 py-3 font-semibold">Nombre</th>
                <th className="px-4 py-3 font-semibold">Rol</th>
                <th className="px-4 py-3 font-semibold">Sede</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody>
              {listaUsuarios.map((u) => (
                <tr key={u.id} className="border-b border-borde last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium">{u.nombre}</p>
                    <p className="text-xs text-tinta-suave">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">{ETIQUETA_ROL[u.rol] ?? u.rol}</td>
                  <td className="px-4 py-3">{nombreSede(u.sedeId)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        u.activo
                          ? "bg-ok/10 text-ok"
                          : "bg-borde text-tinta-suave"
                      }`}
                    >
                      {u.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-tinta-suave">
          El alta de usuarios se hace por ahora con la administración del
          sistema (ver README); la pantalla de alta llega con las próximas
          fases.
        </p>
      </section>
    </div>
  );
}
