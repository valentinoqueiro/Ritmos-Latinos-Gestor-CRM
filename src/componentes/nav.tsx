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
    <nav className="hidden w-52 shrink-0 flex-col gap-1 p-4 md:flex">
      {items.map((item) => {
        const activo = rutaActual.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              activo
                ? "bg-marca-suave text-marca-oscuro"
                : "text-tinta-suave hover:bg-superficie hover:text-tinta"
            }`}
          >
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

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-borde bg-superficie/95 backdrop-blur md:hidden">
      <ul
        className="mx-auto grid max-w-md"
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
                className={`flex flex-col items-center gap-1 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] text-[11px] font-medium ${
                  activo ? "text-marca" : "text-tinta-suave"
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
              className={`flex flex-col items-center gap-1 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] text-[11px] font-medium ${
                rutaActual.startsWith("/mas") ? "text-marca" : "text-tinta-suave"
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
