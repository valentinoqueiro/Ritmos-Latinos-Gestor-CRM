import Image from "next/image";
import Link from "next/link";
import { requerirSeccion } from "@/lib/auth/guards";
import { IconoSalir } from "@/componentes/iconos";
import { salir } from "../login/actions";
import { PestanasCrm } from "./pestanas";

// El CRM es una app aparte del gestor: shell propio, sin la navegación del
// panel. Se entra con el botón "Abrir CRM" del header y se vuelve desde acá.
export default async function CrmLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requerirSeccion("crm");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b-2 border-marca bg-tinta/90 text-white backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 md:px-6">
          <Link href="/crm" className="flex items-center gap-2.5">
            <span className="flex h-8 w-9 items-center justify-center rounded-lg bg-white">
              <Image
                src="/logo.png"
                alt="Logo Ritmos Latinos"
                width={28}
                height={21}
                className="h-5 w-auto"
              />
            </span>
            <p className="titulo-display text-xl leading-none">
              CRM <span className="text-marca">Ritmos</span>
            </p>
          </Link>
          <div className="order-last w-full sm:order-none sm:w-auto">
            <PestanasCrm />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/inicio"
              className="rounded-lg border border-white/25 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10"
            >
              ← Volver al gestor
            </Link>
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

      <main className="mx-auto w-full min-w-0 max-w-[1600px] flex-1 px-4 pb-16 pt-5 md:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
