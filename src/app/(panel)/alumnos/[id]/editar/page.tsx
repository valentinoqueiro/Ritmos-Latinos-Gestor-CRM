import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requerirSeccion } from "@/lib/auth/guards";
import { fichaDeAlumno } from "@/lib/operativa";
import { FormularioAlumno } from "../../formulario-alumno";

export const metadata: Metadata = { title: "Editar alumno" };

export default async function PaginaEditarAlumno({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await requerirSeccion("operativa");
  const { id } = await params;
  const ficha = await fichaDeAlumno(usuario, Number(id));
  if (!ficha) notFound();

  return (
    <div>
      <h1 className="titulo-display text-4xl">
        Editar a {ficha.alumno.nombre} {ficha.alumno.apellido}
      </h1>
      <FormularioAlumno sedeId={ficha.alumno.sedeId} alumno={ficha.alumno} />
    </div>
  );
}
