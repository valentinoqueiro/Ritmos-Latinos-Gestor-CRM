import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { preciosPlan } from "@/db/schema";
import { requerirSeccion } from "@/lib/auth/guards";
import { fichaDeAlumno, formatoMonto } from "@/lib/operativa";
import { umbralPorVencer, venceVigente } from "@/lib/cobros";
import { formatoFecha, hoyISO } from "@/lib/fechas";
import { calcularVencimiento, estadoCuota } from "@/lib/vencimientos";
import { Campo, Input, Select } from "@/componentes/campos";
import { EstadoCuotaChip } from "@/componentes/estado-cuota";
import { FormAccion } from "@/componentes/form-accion";
import { registrarPago } from "../../acciones";
import { diasParaVencer } from "@/lib/vencimientos";

export const metadata: Metadata = { title: "Registrar pago" };

export default async function PaginaRegistrarPago({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sub?: string }>;
}) {
  const usuario = await requerirSeccion("operativa");
  const { id } = await params;
  const { sub: subParam } = await searchParams;
  const ficha = await fichaDeAlumno(usuario, Number(id));
  if (!ficha) notFound();
  const sub = ficha.suscripciones.find(
    (s) => s.id === Number(subParam) && s.estado === "activa",
  );
  if (!sub) notFound();

  const hoy = hoyISO();
  const [vigente, umbral, [precio]] = await Promise.all([
    venceVigente(sub.id),
    umbralPorVencer(),
    db
      .select()
      .from(preciosPlan)
      .where(eq(preciosPlan.planId, sub.planId))
      .orderBy(desc(preciosPlan.vigenteDesde))
      .limit(1),
  ]);
  // Si paga hoy, hasta cuándo quedaría habilitado (informativo).
  const venceSiPagaHoy = calcularVencimiento(vigente, hoy);

  return (
    <div className="max-w-xl">
      <p className="text-sm text-tinta-suave">
        <Link href={`/alumnos/${ficha.alumno.id}`} className="underline">
          {ficha.alumno.nombre} {ficha.alumno.apellido}
        </Link>{" "}
        · {sub.plan}
      </p>
      <h1 className="titulo-display mt-1 text-4xl">Registrar pago</h1>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <EstadoCuotaChip
          estado={estadoCuota(vigente, hoy, umbral)}
          vence={vigente}
          diasRestantes={vigente ? diasParaVencer(vigente, hoy) : null}
        />
        <span className="text-sm text-tinta-suave">
          Pagando hoy queda habilitado hasta el{" "}
          <strong>{formatoFecha(venceSiPagaHoy)}</strong>.
        </span>
      </div>

      <FormAccion
        accion={registrarPago}
        textoBoton="Registrar pago"
        className="mt-6 grid gap-4"
      >
        <input type="hidden" name="suscripcionId" value={sub.id} />
        <Campo etiqueta="Monto cobrado ($)">
          <Input
            name="monto"
            inputMode="numeric"
            required
            defaultValue={precio ? Number(precio.monto) : undefined}
          />
        </Campo>
        {precio ? (
          <p className="-mt-2 text-xs text-tinta-suave">
            Precio vigente del plan: {formatoMonto(precio.monto)}. Podés
            ajustar el monto si este caso es distinto; queda registrado lo que
            se cobró de verdad.
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-4">
          <Campo etiqueta="Medio de pago">
            <Select name="medio" required defaultValue="efectivo">
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
            </Select>
          </Campo>
          <Campo etiqueta="Fecha del pago">
            <Input name="fechaPago" type="date" required defaultValue={hoy} />
          </Campo>
        </div>
      </FormAccion>
    </div>
  );
}
