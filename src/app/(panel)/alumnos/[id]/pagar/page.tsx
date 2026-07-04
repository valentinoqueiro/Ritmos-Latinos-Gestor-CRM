import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { preciosPlan } from "@/db/schema";
import { requerirSeccion } from "@/lib/auth/guards";
import { fichaDeAlumno } from "@/lib/operativa";
import { umbralPorVencer, venceVigente } from "@/lib/cobros";
import { formatoFecha, hoyISO } from "@/lib/fechas";
import { calcularVencimiento, estadoCuota } from "@/lib/vencimientos";
import { EstadoCuotaChip } from "@/componentes/estado-cuota";
import { FormularioPago } from "../../formulario-pago";
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

      <FormularioPago
        suscripcionId={sub.id}
        precioSugerido={precio ? Number(precio.monto) : null}
        hoy={hoy}
      />
    </div>
  );
}
