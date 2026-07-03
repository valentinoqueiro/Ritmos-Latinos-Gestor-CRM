import type { Metadata } from "next";
import { requerirSeccion } from "@/lib/auth/guards";
import { sedeActiva } from "@/lib/sedes";
import { FormularioAlumno } from "../formulario-alumno";

export const metadata: Metadata = { title: "Nuevo alumno" };

export default async function PaginaNuevoAlumno() {
  const usuario = await requerirSeccion("operativa");
  const sede = await sedeActiva(usuario);
  if (!sede) return null;

  return (
    <div>
      <h1 className="titulo-display text-4xl">Nuevo alumno</h1>
      <p className="mt-1 text-sm text-tinta-suave">
        Se crea en <strong>{sede.nombre}</strong>.
      </p>
      <FormularioAlumno sedeId={sede.id} />
    </div>
  );
}
