"use client";

import { useActionState } from "react";

type Estado = { error?: string; ok?: boolean };
type Accion = (estado: Estado, formData: FormData) => Promise<Estado>;

// Formulario genérico para server actions con manejo de error y estado de envío.
// Los campos llegan como children (server-rendered); acá solo vive el pegamento.
export function FormAccion({
  accion,
  textoBoton,
  textoEnviando = "Guardando…",
  className,
  variante = "primario",
  children,
}: {
  accion: Accion;
  textoBoton: string;
  textoEnviando?: string;
  className?: string;
  variante?: "primario" | "secundario" | "peligro";
  children?: React.ReactNode;
}) {
  const [estado, despachar, pendiente] = useActionState(accion, {});
  const estilosBoton =
    variante === "primario"
      ? "bg-marca text-white hover:bg-marca-oscuro"
      : variante === "peligro"
        ? "bg-marca-suave text-marca-oscuro hover:bg-marca/20"
        : "border border-borde bg-superficie text-tinta hover:bg-fondo";

  return (
    <form action={despachar} className={className}>
      {children}
      {estado.error ? (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-marca-suave px-3 py-2 text-sm font-medium text-marca-oscuro"
        >
          {estado.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pendiente}
        className={`mt-3 h-11 w-full rounded-lg px-4 text-sm font-semibold transition disabled:opacity-60 sm:w-auto ${estilosBoton}`}
      >
        {pendiente ? textoEnviando : textoBoton}
      </button>
    </form>
  );
}
