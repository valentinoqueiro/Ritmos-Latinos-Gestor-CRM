"use client";

import { useActionState } from "react";
import { ALCANCES_API, ETIQUETA_ALCANCE } from "@/lib/auth/api-keys";
import { Campo, Input } from "@/componentes/campos";
import { crearApiKey, type EstadoCrearApiKey } from "../acciones";

// La clave completa solo existe en el `return` de la acción (una vez, en
// memoria del cliente): ni este componente ni la base la guardan de nuevo.
export function FormularioNuevaApiKey() {
  const [estado, despachar, pendiente] = useActionState<EstadoCrearApiKey, FormData>(
    crearApiKey,
    {},
  );

  return (
    <form action={despachar} className="grid gap-3">
      <Campo etiqueta="Nombre">
        <Input name="nombre" required placeholder="Ej.: n8n cumpleaños" />
      </Campo>
      <fieldset className="grid gap-1.5">
        <legend className="text-sm font-medium">Alcances</legend>
        {ALCANCES_API.map((alcance) => (
          <label key={alcance} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="alcances"
              value={alcance}
              className="h-4 w-4 rounded border-borde"
            />
            {ETIQUETA_ALCANCE[alcance]}
          </label>
        ))}
      </fieldset>

      {estado.error ? (
        <p
          role="alert"
          className="rounded-lg bg-marca-suave px-3 py-2 text-sm font-medium text-marca-oscuro"
        >
          {estado.error}
        </p>
      ) : null}

      {estado.clave ? (
        <div className="rounded-lg border border-ok/40 bg-ok/10 px-3 py-3 text-sm">
          <p className="font-semibold text-ok">
            Clave creada — copiala ahora, no se vuelve a mostrar:
          </p>
          <code className="mt-2 block overflow-x-auto rounded-md bg-fondo px-2 py-1.5 text-xs">
            {estado.clave}
          </code>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pendiente}
        className="h-11 rounded-lg bg-marca px-4 text-sm font-semibold text-white transition hover:bg-marca-oscuro disabled:opacity-60 sm:w-auto"
      >
        {pendiente ? "Creando…" : "Crear API key"}
      </button>
    </form>
  );
}
