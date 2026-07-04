import type { Metadata } from "next";
import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { requerirSeccion } from "@/lib/auth/guards";
import { ETIQUETA_ALCANCE, PREFIJO_CLAVE, type AlcanceApi } from "@/lib/auth/api-keys";
import { ZONA_HORARIA } from "@/lib/fechas";
import { revocarApiKey } from "../acciones";
import { FormularioNuevaApiKey } from "./formulario-nueva";

export const metadata: Metadata = { title: "API keys" };

const formatoFechaHora = new Intl.DateTimeFormat("es-AR", {
  timeZone: ZONA_HORARIA,
  dateStyle: "short",
  timeStyle: "short",
});

export default async function PaginaApiKeys() {
  await requerirSeccion("configuracion");
  const lista = await db.query.apiKeys.findMany({
    orderBy: desc(apiKeys.creadaEn),
  });

  return (
    <div>
      <p className="text-sm text-tinta-suave">
        <Link href="/configuracion" className="underline">
          Configuración
        </Link>
      </p>
      <h1 className="titulo-display mt-1 text-4xl">API keys</h1>
      <p className="mt-2 max-w-2xl text-sm text-tinta-suave">
        Claves para que sistemas externos (n8n, agentes de IA, formularios,
        Meta Ads) carguen leads o lean datos vía la API pública{" "}
        <code className="rounded bg-fondo px-1.5 py-0.5 text-xs">/api/v1</code>
        . Ver <code className="rounded bg-fondo px-1.5 py-0.5 text-xs">docs/API_PUBLICA.md</code>{" "}
        para la guía completa de integración.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="grid gap-4">
          {lista.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-borde bg-superficie px-6 py-10 text-center text-sm text-tinta-suave">
              Todavía no hay ninguna API key creada.
            </p>
          ) : (
            lista.map((key) => (
              <section
                key={key.id}
                className={`rounded-2xl border border-borde bg-superficie p-4 ${
                  key.activa ? "" : "opacity-60"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-semibold">
                      {key.nombre}
                      {!key.activa ? " (revocada)" : ""}
                    </h2>
                    <p className="mt-0.5 font-mono text-xs text-tinta-suave">
                      {PREFIJO_CLAVE}••••{key.ultimosCaracteres}
                    </p>
                  </div>
                  {key.activa ? (
                    <form action={revocarApiKey}>
                      <input type="hidden" name="id" value={key.id} />
                      <button
                        type="submit"
                        className="text-xs font-medium text-marca underline"
                      >
                        Revocar
                      </button>
                    </form>
                  ) : null}
                </div>

                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {key.alcances.map((alcance) => (
                    <li
                      key={alcance}
                      className="rounded-full bg-fondo px-2.5 py-1 text-xs font-medium ring-1 ring-borde"
                    >
                      {ETIQUETA_ALCANCE[alcance as AlcanceApi] ?? alcance}
                    </li>
                  ))}
                </ul>

                <p className="mt-3 text-xs text-tinta-suave">
                  Creada el {formatoFechaHora.format(key.creadaEn)} · Último uso:{" "}
                  {key.ultimoUso ? formatoFechaHora.format(key.ultimoUso) : "nunca"}
                </p>
              </section>
            ))
          )}
        </div>

        <div className="grid gap-4 self-start">
          <section className="rounded-2xl border border-borde bg-superficie p-4">
            <h2 className="font-semibold">Nueva API key</h2>
            <p className="mt-1 text-sm text-tinta-suave">
              La clave se muestra una sola vez al crearla. Guardala en un
              lugar seguro: no se puede volver a ver.
            </p>
            <div className="mt-3">
              <FormularioNuevaApiKey />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
