import type { Metadata } from "next";
import { requerirSeccion } from "@/lib/auth/guards";
import { Proximamente } from "@/componentes/proximamente";

export const metadata: Metadata = { title: "Horarios" };

export default async function PaginaHorarios() {
  await requerirSeccion("operativa");
  return (
    <div>
      <h1 className="titulo-display text-4xl">Horarios</h1>
      <Proximamente
        fase={2}
        titulo="Grilla semanal"
        detalle="Las clases de la semana con inscriptos por horario y cupo cuando corresponda."
      />
    </div>
  );
}
