"use client";

import { useActionState, useEffect } from "react";

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
  alCompletar,
  children,
}: {
  accion: Accion;
  textoBoton: string;
  textoEnviando?: string;
  className?: string;
  variante?: "primario" | "secundario" | "peligro";
  // Aviso de éxito para el padre (ej.: cerrar el modal que contiene el form).
  alCompletar?: () => void;
  children?: React.ReactNode;
}) {
  const [estado, despachar, pendiente] = useActionState(accion, {});
  useEffect(() => {
    if (estado.ok) alCompletar?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);
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
