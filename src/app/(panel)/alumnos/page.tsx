import type { Metadata } from "next";
import { requerirSeccion } from "@/lib/auth/guards";
import { Proximamente } from "@/componentes/proximamente";

export const metadata: Metadata = { title: "Alumnos" };

export default async function PaginaAlumnos() {
  await requerirSeccion("operativa");
  return (
    <div>
      <h1 className="titulo-display text-4xl">Alumnos</h1>
      <Proximamente
        fase={2}
        titulo="Fichas de alumnos"
        detalle="Alta, búsqueda y edición de alumnos, con sus suscripciones y elección de horarios."
      />
    </div>
  );
}
