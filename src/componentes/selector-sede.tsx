"use client";

import { useRef } from "react";
import { IconoSede } from "./iconos";

type SedeOpcion = { id: number; nombre: string };

// Selector de sede del admin: pastilla translúcida estilo iOS con el select
// nativo invisible encima. Al elegir, envía el formulario que ejecuta la
// server action cambiarSede (validada en backend contra las sedes permitidas).
export function SelectorSede({
  sedes,
  sedeActivaId,
  accion,
}: {
  sedes: SedeOpcion[];
  sedeActivaId: number;
  accion: (formData: FormData) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={accion}>
      <label className="flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-white/10 pl-3 pr-2.5 ring-1 ring-white/15 backdrop-blur-sm transition hover:bg-white/20">
        <IconoSede className="h-4 w-4 shrink-0 text-marca" />
        <select
          name="sedeId"
          defaultValue={sedeActivaId}
          onChange={() => formRef.current?.requestSubmit()}
          aria-label="Sede activa"
          className="max-w-32 appearance-none truncate bg-transparent text-xs font-semibold text-white outline-none sm:max-w-none"
        >
          {sedes.map((sede) => (
            <option key={sede.id} value={sede.id} className="text-tinta">
              {sede.nombre}
            </option>
          ))}
        </select>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className="h-3.5 w-3.5 shrink-0 text-white/60"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </label>
    </form>
  );
}
