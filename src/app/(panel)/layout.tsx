import Image from "next/image";
import Link from "next/link";
import { requerirUsuario } from "@/lib/auth/guards";
import { puedeAcceder } from "@/lib/auth/permissions";
import { itemsParaRol } from "@/lib/navegacion";
import { sedeActiva, sedesVisibles } from "@/lib/sedes";
import { BarraInferior, NavLateral } from "@/componentes/nav";
import { SelectorSede } from "@/componentes/selector-sede";
import { IconoCrm, IconoSalir, IconoSede } from "@/componentes/iconos";
import { cambiarSede } from "./actions";
import { salir } from "../login/actions";

export default async function PanelLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const usuario = await requerirUsuario();
  const [visibles, activa] = await Promise.all([
    sedesVisibles(usuario),
    sedeActiva(usuario),
  ]);
  const items = itemsParaRol(usuario.rol);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-tinta/90 text-white backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center gap-3 px-4 md:px-6">
          <Link href="/inicio" className="flex items-center gap-2.5">
            <Image
              src="/logo.png"
              alt="Logo Ritmos Latinos"
              width={36}
              height={27}
              priority
              className="h-7 w-auto"
            />
            <p className="titulo-display hidden text-xl leading-none sm:block">
              Ritmos <span className="text-marca">Latinos</span>
            </p>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            {/* El CRM vive aparte del gestor: se abre desde acá. */}
            {puedeAcceder(usuario.rol, "crm") ? (
              <Link
                href="/crm"
                className="flex items-center gap-1.5 rounded-full bg-marca px-3 py-1.5 text-xs font-semibold text-white shadow-boton transition hover:bg-marca-oscuro"
              >
                <IconoCrm className="h-4 w-4" />
                <span className="hidden sm:inline">Abrir&nbsp;</span>CRM
              </Link>
            ) : null}

            {usuario.rol === "admin" && activa ? (
              <SelectorSede
                sedes={visibles.map((s) => ({ id: s.id, nombre: s.nombre }))}
                sedeActivaId={activa.id}
                accion={cambiarSede}
              />
            ) : usuario.rol === "secretaria" && activa ? (
              <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium">
                <IconoSede className="h-4 w-4" />
                {activa.nombre}
              </span>
            ) : usuario.rol === "owner" ? (
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium">
                Todas las sedes
              </span>
            ) : null}

            <form action={salir}>
              <button
                type="submit"
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                <IconoSalir className="h-5 w-5" />
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1600px] flex-1">
        <NavLateral items={items} />
        <main className="min-w-0 flex-1 px-4 pb-32 pt-5 md:px-6 md:pb-10 lg:px-8">
          {children}
        </main>
      </div>

      <BarraInferior items={items} />
    </div>
  );
}
