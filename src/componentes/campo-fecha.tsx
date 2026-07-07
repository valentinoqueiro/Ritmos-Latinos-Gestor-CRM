"use client";

import { useState } from "react";
import { claseInput } from "./campos";

// Fecha que se ESCRIBE (04/07/1965) en vez de elegirse del calendario: en el
// celular el picker nativo obliga a navegar mes por mes y es inusable para
// fechas lejanas (nacimientos). El usuario ve y tipea DD/MM/AAAA; el servidor
// sigue recibiendo YYYY-MM-DD por un input oculto, así ninguna acción cambia.

/** YYYY-MM-DD → DD/MM/AAAA (vacío si no hay valor). */
function aVisible(iso: string | null | undefined): string {
  if (!iso) return "";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

/** DD/MM/AAAA completo y válido → YYYY-MM-DD; si no, null. */
function aISO(visible: string): string | null {
  const m = visible.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dia, mes, anio] = m;
  const fecha = new Date(Date.UTC(Number(anio), Number(mes) - 1, Number(dia)));
  const valida =
    fecha.getUTCFullYear() === Number(anio) &&
    fecha.getUTCMonth() === Number(mes) - 1 &&
    fecha.getUTCDate() === Number(dia);
  return valida ? `${anio}-${mes}-${dia}` : null;
}

/** Deja solo dígitos y va metiendo las barras: "0471965" → "04/7/1965"… */
function formatearMientrasEscribe(texto: string): string {
  const digitos = texto.replace(/\D/g, "").slice(0, 8);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 4) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
  return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
}

export function InputFecha({
  name,
  defaultValue,
  required,
  min,
  max,
  mensajeMin,
  mensajeMax,
}: {
  name: string;
  /** Valor inicial en YYYY-MM-DD (como venía usándose con type="date"). */
  defaultValue?: string | null;
  required?: boolean;
  /** Cota inferior/superior en YYYY-MM-DD (inclusive). */
  min?: string;
  max?: string;
  mensajeMin?: string;
  mensajeMax?: string;
}) {
  const [visible, setVisible] = useState(aVisible(defaultValue));
  const iso = aISO(visible);

  // La validación viaja en el input visible (participa del required/reportValidity
  // del form); el servidor igual re-valida el formato en cada acción.
  function validar(input: HTMLInputElement, valorISO: string | null) {
    if (input.value === "") {
      input.setCustomValidity("");
      return;
    }
    if (valorISO === null) {
      input.setCustomValidity("Fecha incompleta o inválida. Escribila como DD/MM/AAAA, por ej. 04/07/1965");
      return;
    }
    if (min && valorISO < min) {
      input.setCustomValidity(mensajeMin ?? `La fecha no puede ser anterior al ${aVisible(min)}`);
      return;
    }
    if (max && valorISO > max) {
      input.setCustomValidity(mensajeMax ?? `La fecha no puede ser posterior al ${aVisible(max)}`);
      return;
    }
    input.setCustomValidity("");
  }

  return (
    <>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="DD/MM/AAAA"
        maxLength={10}
        required={required}
        value={visible}
        onChange={(e) => {
          const nuevo = formatearMientrasEscribe(e.target.value);
          setVisible(nuevo);
          validar(e.target, aISO(nuevo));
        }}
        className={claseInput}
      />
      <input type="hidden" name={name} value={iso ?? ""} />
    </>
  );
}
