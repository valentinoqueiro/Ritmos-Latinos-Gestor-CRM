import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { categoriasGasto, gastos, type Gasto } from "@/db/schema";
import { requerirSeccion } from "@/lib/auth/guards";
import { formatoFecha, hoyISO } from "@/lib/fechas";
import { formatoMonto } from "@/lib/operativa";
import { sedesVisibles } from "@/lib/sedes";
import { Campo, Input, Select, claseInput } from "@/componentes/campos";
import { FormAccion } from "@/componentes/form-accion";
import { crearGasto, eliminarGasto } from "./acciones";
import { FormularioCampos } from "./formulario-campos";

export const metadata: Metadata = { title: "Gastos" };

function rangoDelMes(mes: string): { desde: string; hasta: string } {
  const [anio, m] = mes.split("-").map(Number);
  const ultimo = new Date(Date.UTC(anio, m, 0)).getUTCDate();
  return {
    desde: `${mes}-01`,
    hasta: `${mes}-${String(ultimo).padStart(2, "0")}`,
  };
}

export default async function PaginaGastos({
  searchParams,
}: {
  searchParams: Promise<{
    mes?: string;
    sede?: string;
    categoria?: string;
    tipo?: string;
  }>;
}) {
  const usuario = await requerirSeccion("gastos");
  const filtros = await searchParams;
  const mes = /^\d{4}-\d{2}$/.test(filtros.mes ?? "")
    ? filtros.mes!
    : hoyISO().slice(0, 7);
  const { desde, hasta } = rangoDelMes(mes);

  const [sedes, categorias] = await Promise.all([
    sedesVisibles(usuario),
    db.query.categoriasGasto.findMany({ orderBy: asc(categoriasGasto.nombre) }),
  ]);
  const sedeFiltro = sedes.find((s) => s.id === Number(filtros.sede))?.id;
  const categoriaFiltro = categorias.find(
    (c) => c.id === Number(filtros.categoria),
  )?.id;
  const tipoFiltro =
    filtros.tipo === "fijo" || filtros.tipo === "variable"
      ? filtros.tipo
      : undefined;

  const lista = await db
    .select({
      gasto: gastos,
      categoria: categoriasGasto.nombre,
    })
    .from(gastos)
    .innerJoin(categoriasGasto, eq(gastos.categoriaId, categoriasGasto.id))
    .where(
      and(
        gte(gastos.fecha, desde),
        lte(gastos.fecha, hasta),
        sedeFiltro ? eq(gastos.sedeId, sedeFiltro) : undefined,
        categoriaFiltro ? eq(gastos.categoriaId, categoriaFiltro) : undefined,
        tipoFiltro ? eq(gastos.tipo, tipoFiltro) : undefined,
      ),
    )
    .orderBy(desc(gastos.fecha), desc(gastos.creadoEn));

  const total = lista.reduce((suma, f) => suma + Number(f.gasto.monto), 0);
  const fijos = lista
    .filter((f) => f.gasto.tipo === "fijo")
    .reduce((suma, f) => suma + Number(f.gasto.monto), 0);
  const nombreSede = (id: number) =>
    sedes.find((s) => s.id === id)?.nombre ?? `Sede ${id}`;
  const categoriasActivas = categorias.filter((c) => c.activa);

  return (
    <div>
      <h1 className="titulo-display text-4xl">Gastos</h1>

      {/* Filtros */}
      <form
        method="get"
        action="/gastos"
        className="mt-5 flex flex-wrap items-end gap-3"
      >
        <Campo etiqueta="Mes">
          <input
            type="month"
            name="mes"
            defaultValue={mes}
            className={claseInput}
          />
        </Campo>
        <Campo etiqueta="Sede">
          <Select name="sede" defaultValue={sedeFiltro ?? ""}>
            <option value="">Todas</option>
            {sedes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </Select>
        </Campo>
        <Campo etiqueta="Categoría">
          <Select name="categoria" defaultValue={categoriaFiltro ?? ""}>
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </Select>
        </Campo>
        <Campo etiqueta="Tipo">
          <Select name="tipo" defaultValue={tipoFiltro ?? ""}>
            <option value="">Todos</option>
            <option value="fijo">Fijo</option>
            <option value="variable">Variable</option>
          </Select>
        </Campo>
        <button
          type="submit"
          className="h-11 rounded-lg border border-borde bg-superficie px-4 text-sm font-semibold transition hover:border-marca"
        >
          Filtrar
        </button>
      </form>

      {/* Totales del período filtrado */}
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-borde bg-superficie p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-tinta-suave">
            Total del período
          </h2>
          <p className="titulo-display mt-1 text-3xl">{formatoMonto(total)}</p>
        </article>
        <article className="rounded-2xl border border-borde bg-superficie p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-tinta-suave">
            Fijos
          </h2>
          <p className="titulo-display mt-1 text-3xl">{formatoMonto(fijos)}</p>
        </article>
        <article className="rounded-2xl border border-borde bg-superficie p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-tinta-suave">
            Variables
          </h2>
          <p className="titulo-display mt-1 text-3xl">
            {formatoMonto(total - fijos)}
          </p>
        </article>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
        {/* Listado */}
        {lista.length === 0 ? (
          <p className="self-start rounded-2xl border border-dashed border-borde bg-superficie px-6 py-10 text-center text-sm text-tinta-suave">
            No hay gastos cargados con estos filtros.
          </p>
        ) : (
          <ul className="self-start overflow-hidden rounded-2xl border border-borde bg-superficie">
            {lista.map(({ gasto, categoria }) => (
              <li
                key={gasto.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-borde px-4 py-3 last:border-0"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {categoria}
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        gasto.tipo === "fijo"
                          ? "bg-tinta/10 text-tinta-suave"
                          : "bg-alerta/10 text-alerta"
                      }`}
                    >
                      {gasto.tipo === "fijo" ? "Fijo" : "Variable"}
                    </span>
                  </p>
                  <p className="text-xs text-tinta-suave">
                    {formatoFecha(gasto.fecha)} · {nombreSede(gasto.sedeId)}
                    {gasto.descripcion ? ` · ${gasto.descripcion}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <p className="font-semibold">{formatoMonto(gasto.monto)}</p>
                  <Link
                    href={`/gastos/${gasto.id}/editar`}
                    className="text-xs font-medium underline"
                  >
                    Editar
                  </Link>
                  <form action={eliminarGasto}>
                    <input type="hidden" name="gastoId" value={gasto.id} />
                    <button
                      type="submit"
                      className="text-xs font-medium text-peligro underline"
                    >
                      Eliminar
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Alta */}
        <section className="self-start rounded-2xl border border-borde bg-superficie p-4">
          <h2 className="font-semibold">Nuevo gasto</h2>
          {categoriasActivas.length === 0 ? (
            <p className="mt-2 text-sm text-tinta-suave">
              Primero creá categorías en{" "}
              <Link href="/configuracion" className="underline">
                Configuración
              </Link>
              .
            </p>
          ) : (
            <FormAccion
              accion={crearGasto}
              textoBoton="Cargar gasto"
              className="mt-3 grid gap-3"
            >
              <FormularioCampos
                sedes={sedes.map((s) => ({ id: s.id, nombre: s.nombre }))}
                categorias={categoriasActivas.map((c) => ({
                  id: c.id,
                  nombre: c.nombre,
                }))}
              />
            </FormAccion>
          )}
        </section>
      </div>
    </div>
  );
}
