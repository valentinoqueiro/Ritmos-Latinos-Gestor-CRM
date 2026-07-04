"use client";

import { useState } from "react";
import { Campo, Input } from "@/componentes/campos";
import { FormAccion } from "@/componentes/form-accion";
import { registrarPago } from "./acciones";

function formatoMonto(monto: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(monto);
}

/**
 * Cobro de una cuota repartido entre efectivo y transferencia, con aviso en
 * vivo si queda saldo (pago parcial → deudor). La validación real vive en el
 * servidor (registrarPago); acá solo se anticipa el resultado.
 */
export function FormularioPago({
  suscripcionId,
  precioSugerido,
  hoy,
}: {
  suscripcionId: number;
  precioSugerido: number | null;
  hoy: string;
}) {
  const [acordado, setAcordado] = useState(precioSugerido ?? 0);
  const [efectivo, setEfectivo] = useState(precioSugerido ?? 0);
  const [transferencia, setTransferencia] = useState(0);

  const total = efectivo + transferencia;
  const saldo = Math.round((acordado - total) * 100) / 100;

  const aNumero = (v: string) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  return (
    <FormAccion
      accion={registrarPago}
      textoBoton={
        saldo > 0 && total > 0
          ? `Registrar pago parcial (debe ${formatoMonto(saldo)})`
          : "Registrar pago"
      }
      className="mt-6 grid gap-4"
    >
      <input type="hidden" name="suscripcionId" value={suscripcionId} />

      <Campo etiqueta="Monto de la cuota ($)">
        <Input
          name="montoAcordado"
          inputMode="numeric"
          required
          value={acordado || ""}
          onChange={(e) => setAcordado(aNumero(e.target.value))}
        />
      </Campo>
      {precioSugerido !== null ? (
        <p className="-mt-2 text-xs text-tinta-suave">
          Precio vigente del plan: {formatoMonto(precioSugerido)}. Podés
          ajustarlo si este caso es distinto (descuento, promo).
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-4">
        <Campo etiqueta="Efectivo ($)">
          <Input
            name="efectivo"
            inputMode="numeric"
            value={efectivo || ""}
            placeholder="0"
            onChange={(e) => setEfectivo(aNumero(e.target.value))}
          />
        </Campo>
        <Campo etiqueta="Transferencia ($)">
          <Input
            name="transferencia"
            inputMode="numeric"
            value={transferencia || ""}
            placeholder="0"
            onChange={(e) => setTransferencia(aNumero(e.target.value))}
          />
        </Campo>
      </div>

      {total > acordado ? (
        <p className="rounded-lg bg-marca-suave px-3 py-2 text-sm font-medium text-marca-oscuro">
          Lo cobrado ({formatoMonto(total)}) supera el monto de la cuota.
        </p>
      ) : saldo > 0 && total > 0 ? (
        <p className="rounded-lg bg-alerta/10 px-3 py-2 text-sm font-medium text-alerta">
          Cobro parcial: queda como deudor por {formatoMonto(saldo)}. La deuda
          se ve en su ficha y en Inicio hasta que la complete.
        </p>
      ) : null}

      <Campo etiqueta="Fecha de inicio del contrato">
        <Input name="fechaContrato" type="date" required defaultValue={hoy} />
      </Campo>
      <p className="-mt-2 text-xs text-tinta-suave">
        El vencimiento se cuenta desde esta fecha: si empezó a venir antes y
        el pago se registra hoy, poné el día en que empezó.
      </p>
    </FormAccion>
  );
}
