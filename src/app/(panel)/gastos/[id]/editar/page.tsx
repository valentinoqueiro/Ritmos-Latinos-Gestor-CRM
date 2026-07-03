import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { categoriasGasto, gastos } from "@/db/schema";
import { requerirSeccion } from "@/lib/auth/guards";
import { sedesVisibles } from "@/lib/sedes";
import { FormAccion } from "@/componentes/form-accion";
import { editarGasto } from "../../acciones";
import { FormularioCampos } from "../../formulario-campos";

export const metadata: Metadata = { title: "Editar gasto" };

export default async function PaginaEditarGasto({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await requerirSeccion("gastos");
  const { id } = await params;
  const gasto = Number.isInteger(Number(id))
    ? await db.query.gastos.findFirst({ where: eq(gastos.id, Number(id)) })
    : undefined;
  if (!gasto) notFound();

  const [sedes, categorias] = await Promise.all([
    sedesVisibles(usuario),
    db.query.categoriasGasto.findMany({
      where: eq(categoriasGasto.activa, true),
      orderBy: asc(categoriasGasto.nombre),
    }),
  ]);

  return (
    <div className="max-w-md">
      <p className="text-sm text-tinta-suave">
        <Link href="/gastos" className="underline">
          Gastos
        </Link>
      </p>
      <h1 className="titulo-display mt-1 text-4xl">Editar gasto</h1>
      <FormAccion
        accion={editarGasto}
        textoBoton="Guardar cambios"
        className="mt-6 grid gap-3"
      >
        <input type="hidden" name="gastoId" value={gasto.id} />
        <FormularioCampos
          sedes={sedes.map((s) => ({ id: s.id, nombre: s.nombre }))}
          categorias={categorias.map((c) => ({ id: c.id, nombre: c.nombre }))}
          gasto={gasto}
        />
      </FormAccion>
    </div>
  );
}
