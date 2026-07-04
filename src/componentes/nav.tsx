"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ItemNav } from "@/lib/navegacion";
import { MAX_ITEMS_BARRA } from "@/lib/navegacion";
import { IconoMas, IconoNavPorNombre } from "./iconos";

// Navegación por rol: barra inferior en celular, lateral en escritorio.
// Los items ya vienen filtrados por permisos desde el layout (servidor).

export function NavLateral({ items }: { items: ItemNav[] }) {
  const rutaActual = usePathname();
  return (
    <nav className="sticky top-14 hidden max-h-[calc(100dvh-3.5rem)] w-56 shrink-0 flex-col gap-1 self-start overflow-y-auto p-4 md:flex">
      {items.map((item) => {
        const activo = rutaActual.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
              activo
                ? "bg-superficie text-marca-oscuro shadow-tarjeta"
                : "text-tinta-suave hover:bg-superficie/70 hover:text-tinta"
            }`}
          >
            {activo ? (
              <span
                aria-hidden
                className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-marca"
              />
            ) : null}
            <IconoNavPorNombre nombre={item.icono} className="h-5 w-5" />
            {item.etiqueta}
          </Link>
        );
      })}
    </nav>
  );
}

export function BarraInferior({ items }: { items: ItemNav[] }) {
  const rutaActual = usePathname();
  const desborda = items.length > MAX_ITEMS_BARRA;
  const visibles = desborda ? items.slice(0, MAX_ITEMS_BARRA - 1) : items;

  // Barra flotante estilo "liquid glass" (iOS): pastilla translúcida con
  // blur, despegada de los bordes y por encima del safe area.
  return (
    <nav
      className="fixed inset-x-3 z-20 md:hidden"
      style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <ul
        className="vidrio mx-auto grid max-w-md rounded-[1.75rem] p-1.5"
        style={{
          gridTemplateColumns: `repeat(${visibles.length + (desborda ? 1 : 0)}, 1fr)`,
        }}
      >
        {visibles.map((item) => {
          const activo = rutaActual.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex flex-col items-center gap-0.5 rounded-3xl py-2 text-[10px] font-semibold transition-colors ${
                  activo
                    ? "bg-marca/10 text-marca"
                    : "text-tinta-suave active:bg-tinta/5"
                }`}
              >
                <IconoNavPorNombre nombre={item.icono} className="h-6 w-6" />
                {item.etiqueta}
              </Link>
            </li>
          );
        })}
        {desborda ? (
          <li>
            <Link
              href="/mas"
              className={`flex flex-col items-center gap-0.5 rounded-3xl py-2 text-[10px] font-semibold transition-colors ${
                rutaActual.startsWith("/mas")
                  ? "bg-marca/10 text-marca"
                  : "text-tinta-suave active:bg-tinta/5"
              }`}
            >
              <IconoMas className="h-6 w-6" />
              Más
            </Link>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
