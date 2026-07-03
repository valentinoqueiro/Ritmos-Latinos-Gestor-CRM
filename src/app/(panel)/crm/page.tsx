import type { Metadata } from "next";
import { requerirSeccion } from "@/lib/auth/guards";
import { Proximamente } from "@/componentes/proximamente";

export const metadata: Metadata = { title: "CRM" };

export default async function PaginaCrm() {
  await requerirSeccion("crm");
  return (
    <div>
      <h1 className="titulo-display text-4xl">CRM</h1>
      <Proximamente
        fase={6}
        titulo="Pipeline de interesados"
        detalle="Leads de todas las sedes: nuevo, contactado, clase de prueba, convertido o perdido."
      />
    </div>
  );
}
