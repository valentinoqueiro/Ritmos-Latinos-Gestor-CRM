"use client";

import { useActionState, useEffect, useRef } from "react";

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
  const formRef = useRef<HTMLFormElement>(null);
  const ultimoEnvio = useRef<FormData | null>(null);

  // React 19 resetea el <form> después de CADA action, también cuando vuelve
  // con error. Sin esto, un solo dato mal (DNI corto, email inválido…) borra
  // todo lo que el usuario ya había cargado. Guardamos lo enviado y, si hubo
  // error, lo reponemos; en el éxito dejamos que el reset limpie el form.
  function despacharYRecordar(formData: FormData) {
    ultimoEnvio.current = formData;
    despachar(formData);
  }

  useEffect(() => {
    if (estado.ok) {
      alCompletar?.();
      return;
    }
    if (estado.error) reponerValores(formRef.current, ultimoEnvio.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);
  const estilosBoton =
    variante === "primario"
      ? "bg-marca text-white hover:bg-marca-oscuro"
      : variante === "peligro"
        ? "bg-marca-suave text-marca-oscuro hover:bg-marca/20"
        : "border border-borde bg-superficie text-tinta hover:bg-fondo";

  return (
    <form ref={formRef} action={despacharYRecordar} className={className}>
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

// Repone en el DOM los valores que el usuario había enviado, después de que
// React reseteó el form por un error. Cubre inputs de texto, textareas, selects
// (simples y múltiples) y checkboxes/radios. Los campos controlados (los que
// manejan su propio estado, como InputFecha) ya conservan su valor solos.
function reponerValores(
  form: HTMLFormElement | null,
  datos: FormData | null,
): void {
  if (!form || !datos) return;
  // Un mismo name puede venir varias veces (checkboxes, select múltiple).
  const porNombre = new Map<string, string[]>();
  for (const [name, value] of datos.entries()) {
    if (typeof value !== "string") continue;
    const lista = porNombre.get(name) ?? [];
    lista.push(value);
    porNombre.set(name, lista);
  }
  for (const elemento of Array.from(form.elements)) {
    if (
      !(elemento instanceof HTMLInputElement) &&
      !(elemento instanceof HTMLSelectElement) &&
      !(elemento instanceof HTMLTextAreaElement)
    ) {
      continue;
    }
    const name = elemento.name;
    if (!name) continue;
    const valores = porNombre.get(name);
    if (
      elemento instanceof HTMLInputElement &&
      (elemento.type === "checkbox" || elemento.type === "radio")
    ) {
      // Los desmarcados no viajan en el FormData: ausencia = desmarcado.
      elemento.checked = valores?.includes(elemento.value) ?? false;
    } else if (elemento instanceof HTMLSelectElement && elemento.multiple) {
      const elegidos = new Set(valores ?? []);
      for (const opcion of Array.from(elemento.options)) {
        opcion.selected = elegidos.has(opcion.value);
      }
    } else if (valores && valores.length > 0) {
      elemento.value = valores[0];
    }
  }
}
