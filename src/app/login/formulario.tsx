"use client";

import { useActionState } from "react";
import { iniciarSesion, type EstadoLogin } from "./actions";

const estadoInicial: EstadoLogin = {};

export function FormularioLogin() {
  const [estado, accion, enviando] = useActionState(
    iniciarSesion,
    estadoInicial,
  );

  return (
    <form action={accion} className="mt-6 flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Email</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="username"
          inputMode="email"
          placeholder="tu-usuario@ritmoslatinos…"
          className="h-12 rounded-lg border border-borde bg-superficie px-4 text-base outline-none transition focus:border-marca focus:ring-2 focus:ring-marca/20"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Contraseña</span>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          className="h-12 rounded-lg border border-borde bg-superficie px-4 text-base outline-none transition focus:border-marca focus:ring-2 focus:ring-marca/20"
        />
      </label>

      {estado.error ? (
        <p
          role="alert"
          className="rounded-lg bg-marca-suave px-4 py-3 text-sm font-medium text-marca-oscuro"
        >
          {estado.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={enviando}
        className="mt-2 h-12 rounded-lg bg-marca text-base font-semibold text-white transition hover:bg-marca-oscuro disabled:opacity-60"
      >
        {enviando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
