import { requerirUsuario } from "@/lib/auth/guards";
import { itemsParaRol } from "@/lib/navegacion";
import { sedeActiva, sedesVisibles } from "@/lib/sedes";
import { BarraInferior, NavLateral } from "@/componentes/nav";
import { SelectorSede } from "@/componentes/selector-sede";
import { IconoSalir, IconoSede } from "@/componentes/iconos";
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
      <header className="sticky top-0 z-20 bg-tinta text-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <p className="titulo-display text-xl leading-none">
            Ritmos <span className="text-marca">Latinos</span>
          </p>

          <div className="ml-auto flex items-center gap-2">
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

      <div className="mx-auto flex w-full max-w-6xl flex-1">
        <NavLateral items={items} />
        <main className="min-w-0 flex-1 px-4 pb-24 pt-6 md:px-8 md:pb-10">
          {children}
        </main>
      </div>

      <BarraInferior items={items} />
    </div>
  );
}
