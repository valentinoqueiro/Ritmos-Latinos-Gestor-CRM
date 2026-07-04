import type { Metadata } from "next";
import Link from "next/link";
import { requerirUsuario } from "@/lib/auth/guards";
import { puedeAcceder } from "@/lib/auth/permissions";
import { itemsParaRol, MAX_ITEMS_BARRA } from "@/lib/navegacion";
import { EncabezadoSeccion } from "@/componentes/encabezado";
import { IconoCrm, IconoNavPorNombre, IconoSalir } from "@/componentes/iconos";
import { salir } from "../../login/actions";

export const metadata: Metadata = { title: "Más" };

// Secciones que no entran en la barra inferior del celular + cerrar sesión.
export default async function PaginaMas() {
  const usuario = await requerirUsuario();
  const items = itemsParaRol(usuario.rol);
  const restantes =
    items.length > MAX_ITEMS_BARRA ? items.slice(MAX_ITEMS_BARRA - 1) : [];

  return (
    <div>
      <EncabezadoSeccion
        titulo="Más"
        subtitulo={`${usuario.nombre} · ${usuario.email}`}
      />

      <ul className="tarjeta mt-6 overflow-hidden">
        {puedeAcceder(usuario.rol, "crm") ? (
          <li className="border-b border-borde">
            <Link
              href="/crm"
              className="flex items-center gap-3 px-4 py-3.5 text-sm font-medium transition hover:bg-fondo"
            >
              <IconoCrm className="h-5 w-5 text-marca" />
              Abrir CRM
              <span className="ml-auto rounded-full bg-marca-suave px-2 py-0.5 text-[11px] font-semibold text-marca-oscuro">
                App aparte
              </span>
            </Link>
          </li>
        ) : null}
        {restantes.map((item) => (
          <li key={item.href} className="border-b border-borde last:border-0">
            <Link
              href={item.href}
              className="flex items-center gap-3 px-4 py-3.5 text-sm font-medium transition hover:bg-fondo"
            >
              <IconoNavPorNombre
                nombre={item.icono}
                className="h-5 w-5 text-tinta-suave"
              />
              {item.etiqueta}
            </Link>
          </li>
        ))}
        <li>
          <form action={salir}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 px-4 py-3.5 text-sm font-medium text-marca-oscuro transition hover:bg-marca-suave"
            >
              <IconoSalir className="h-5 w-5" />
              Cerrar sesión
            </button>
          </form>
        </li>
      </ul>
    </div>
  );
}
