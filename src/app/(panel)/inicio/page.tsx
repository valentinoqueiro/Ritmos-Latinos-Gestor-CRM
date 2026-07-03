import type { Metadata } from "next";
import { requerirSeccion } from "@/lib/auth/guards";
import { sedeActiva } from "@/lib/sedes";

export const metadata: Metadata = { title: "Inicio" };

const ZONA_HORARIA = "America/Argentina/Buenos_Aires";

export default async function PaginaInicio() {
  const usuario = await requerirSeccion("operativa");
  const sede = await sedeActiva(usuario);

  const fecha = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: ZONA_HORARIA,
  }).format(new Date());
  const hoy = fecha.charAt(0).toUpperCase() + fecha.slice(1);

  return (
    <div>
      <p className="text-sm text-tinta-suave">{hoy}</p>
      <h1 className="titulo-display mt-1 text-4xl">
        Hola, {usuario.nombre.split(" ")[0]}
      </h1>
      {sede ? (
        <p className="mt-1 text-sm text-tinta-suave">
          Estás operando <strong>{sede.nombre}</strong>.
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <article className="rounded-2xl border border-borde bg-superficie p-5">
          <h2 className="text-sm font-semibold text-tinta-suave">
            Cuotas por vencer
          </h2>
          <p className="titulo-display mt-2 text-4xl text-alerta">—</p>
          <p className="mt-2 text-xs text-tinta-suave">
            Se activa en la fase 3 (cobros y estado de cuenta).
          </p>
        </article>
        <article className="rounded-2xl border border-borde bg-superficie p-5">
          <h2 className="text-sm font-semibold text-tinta-suave">
            Cuotas vencidas
          </h2>
          <p className="titulo-display mt-2 text-4xl text-peligro">—</p>
          <p className="mt-2 text-xs text-tinta-suave">
            Se activa en la fase 3 (cobros y estado de cuenta).
          </p>
        </article>
      </div>

      <h2 className="mt-8 text-sm font-semibold text-tinta-suave">
        Accesos rápidos
      </h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="cursor-not-allowed rounded-full border border-borde bg-superficie px-4 py-2 text-sm text-tinta-suave/60">
          + Nuevo alumno · fase 2
        </span>
        <span className="cursor-not-allowed rounded-full border border-borde bg-superficie px-4 py-2 text-sm text-tinta-suave/60">
          + Registrar pago · fase 3
        </span>
      </div>
    </div>
  );
}
