"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Pestañas del CRM: el pipeline de ventas y la retención de alumnos son dos
// trabajos distintos dentro del mismo paradigma comercial.
const PESTANAS = [
  { href: "/crm", etiqueta: "Pipeline" },
  { href: "/crm/recontactar", etiqueta: "A recontactar" },
];

export function PestanasCrm() {
  const pathname = usePathname();
  const activa = (href: string) =>
    href === "/crm"
      ? !pathname.startsWith("/crm/recontactar")
      : pathname.startsWith(href);

  return (
    <nav className="flex items-center gap-1 rounded-full bg-white/10 p-1">
      {PESTANAS.map((p) => (
        <Link
          key={p.href}
          href={p.href}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
            activa(p.href)
              ? "bg-marca text-white shadow-boton"
              : "text-white/70 hover:text-white"
          }`}
        >
          {p.etiqueta}
        </Link>
      ))}
    </nav>
  );
}
