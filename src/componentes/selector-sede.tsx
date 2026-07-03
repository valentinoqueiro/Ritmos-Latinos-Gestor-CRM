"use client";

import { useRef } from "react";

type SedeOpcion = { id: number; nombre: string };

// Selector de sede del admin: al elegir, envía el formulario que ejecuta la
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
      <select
        name="sedeId"
        defaultValue={sedeActivaId}
        onChange={() => formRef.current?.requestSubmit()}
        aria-label="Sede activa"
        className="h-9 max-w-40 rounded-lg border border-white/20 bg-white/10 px-2 text-sm font-medium text-white outline-none transition focus:border-white/50 sm:max-w-none"
      >
        {sedes.map((sede) => (
          <option key={sede.id} value={sede.id} className="text-tinta">
            {sede.nombre}
          </option>
        ))}
      </select>
    </form>
  );
}
