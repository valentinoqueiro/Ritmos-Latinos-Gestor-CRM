import type { Metadata } from "next";
import { requerirSeccion } from "@/lib/auth/guards";
import { Proximamente } from "@/componentes/proximamente";

export const metadata: Metadata = { title: "Dashboard" };

export default async function PaginaDashboard() {
  const usuario = await requerirSeccion("dashboard");
  return (
    <div>
      <h1 className="titulo-display text-4xl">Dashboard</h1>
      {usuario.rol === "owner" ? (
        <p className="mt-1 text-sm text-tinta-suave">
          Tu usuario es de solo lectura: acá vas a ver los números de todas las
          sedes.
        </p>
      ) : null}
      <Proximamente
        fase={5}
        titulo="KPIs del negocio"
        detalle="Ingresos, gastos y resultado con su evolución, alumnos activos, altas y bajas, ocupación por clase, morosos y cumpleaños."
      />
    </div>
  );
}
