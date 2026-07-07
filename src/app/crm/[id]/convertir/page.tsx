import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { requerirSeccion } from "@/lib/auth/guards";
import { puedeTransicionar } from "@/lib/reglas-leads";
import { sedesVisibles } from "@/lib/sedes";
import { InputFecha } from "@/componentes/campo-fecha";
import { Campo, Input, Select } from "@/componentes/campos";
import { FormAccion } from "@/componentes/form-accion";
import { convertirLead } from "../../acciones";

export const metadata: Metadata = { title: "Convertir en alumno" };

export default async function PaginaConvertirLead({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await requerirSeccion("crm");
  const { id } = await params;
  const lead = Number.isInteger(Number(id))
    ? await db.query.leads.findFirst({ where: eq(leads.id, Number(id)) })
    : undefined;
  if (!lead || !puedeTransicionar(lead.estado, "convertido")) notFound();

  const sedes = await sedesVisibles(usuario);
  // Precarga: primera palabra como nombre, el resto como apellido.
  const [nombre, ...resto] = lead.nombre.trim().split(/\s+/);
  const apellido = resto.join(" ");

  return (
    <div className="max-w-xl">
      <p className="text-sm text-tinta-suave">
        <Link href="/crm" className="underline">
          CRM
        </Link>{" "}
        · {lead.nombre}
      </p>
      <h1 className="titulo-display mt-1 text-4xl">Convertir en alumno</h1>
      <p className="mt-1 text-sm text-tinta-suave">
        Los datos del lead ya están precargados; completá lo que falta de la
        ficha. Después seguís directo con la suscripción.
      </p>

      <FormAccion
        accion={convertirLead}
        textoBoton="Crear alumno y elegir plan"
        className="mt-6 grid gap-4 sm:grid-cols-2"
      >
        <input type="hidden" name="leadId" value={lead.id} />
        <Campo etiqueta="Sede">
          <Select
            name="sedeId"
            required
            defaultValue={lead.sedeInteresId ?? sedes[0]?.id}
          >
            {sedes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </Select>
        </Campo>
        <Campo etiqueta="DNI (sin puntos)">
          <Input name="dni" required inputMode="numeric" placeholder="40123456" />
        </Campo>
        <Campo etiqueta="Nombre">
          <Input name="nombre" required defaultValue={nombre} />
        </Campo>
        <Campo etiqueta="Apellido">
          <Input name="apellido" required defaultValue={apellido} placeholder="Completar" />
        </Campo>
        <Campo etiqueta="Teléfono / WhatsApp">
          <Input name="telefono" required defaultValue={lead.telefono} />
        </Campo>
        <Campo etiqueta="Email (opcional)">
          <Input name="email" type="email" defaultValue={lead.email ?? ""} />
        </Campo>
        <Campo etiqueta="Fecha de nacimiento (opcional)">
          <InputFecha name="fechaNacimiento" />
        </Campo>
      </FormAccion>
    </div>
  );
}
