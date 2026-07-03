import type { Metadata } from "next";
import { requerirSeccion } from "@/lib/auth/guards";
import { Proximamente } from "@/componentes/proximamente";

export const metadata: Metadata = { title: "Gastos" };

export default async function PaginaGastos() {
  await requerirSeccion("gastos");
  return (
    <div>
      <h1 className="titulo-display text-4xl">Gastos</h1>
      <Proximamente
        fase={4}
        titulo="Gastos por sede"
        detalle="Carga de gastos fijos y variables con categoría, y listados con totales por mes."
      />
    </div>
  );
}
