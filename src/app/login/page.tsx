import type { Metadata } from "next";
import { FormularioLogin } from "./formulario";

export const metadata: Metadata = { title: "Ingresar" };

export default function PaginaLogin() {
  return (
    <main className="flex min-h-dvh flex-col md:flex-row">
      {/* Franja de marca */}
      <section className="relative flex flex-col justify-between overflow-hidden bg-tinta px-6 py-8 text-white md:w-[45%] md:px-12 md:py-12">
        <div
          aria-hidden
          className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-marca/25 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-marca/15 blur-3xl"
        />
        <p className="titulo-display relative text-lg text-white/70">
          Ritmos Latinos
        </p>
        <div className="relative mt-10 md:mt-0">
          <h1 className="titulo-display text-5xl leading-[0.95] md:text-7xl">
            El gestor
            <br />
            de la academia
          </h1>
          <p className="mt-4 max-w-sm text-sm text-white/70 md:text-base">
            Alumnos, cuotas, clases y sedes en un solo lugar. Hecho a medida
            para el día a día del mostrador.
          </p>
        </div>
        <p className="relative mt-10 hidden text-xs text-white/40 md:block">
          Sistema interno · Tucumán, Argentina
        </p>
      </section>

      {/* Formulario */}
      <section className="flex flex-1 items-start justify-center px-6 py-10 md:items-center md:px-12">
        <div className="w-full max-w-sm">
          <h2 className="text-xl font-semibold">Ingresar</h2>
          <p className="mt-1 text-sm text-tinta-suave">
            Usá el usuario que te dio la administración.
          </p>
          <FormularioLogin />
          <p className="mt-8 text-center text-xs text-tinta-suave/70">
            ¿No podés entrar? Hablá con la administración de tu sede.
          </p>
        </div>
      </section>
    </main>
  );
}
