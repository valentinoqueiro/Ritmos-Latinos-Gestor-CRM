"use client";

import { useState } from "react";
import { InputFecha } from "@/componentes/campo-fecha";
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
 * vivo si queda saldo (pago parcial → deudor). La bonificación/recargo ajusta
 * el TOTAL a cobrar: un pago bonificado cobrado entero queda completo, no
 * parcial. La validación real vive en el servidor (registrarPago); acá solo
 * se anticipa el resultado.
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
  const [base, setBase] = useState(precioSugerido ?? 0);
  const [bonificacion, setBonificacion] = useState(0);
  const [recargo, setRecargo] = useState(0);
  const [efectivo, setEfectivo] = useState(precioSugerido ?? 0);
  const [transferencia, setTransferencia] = useState(0);

  const acordado = Math.max(
    Math.round((base - bonificacion + recargo) * 100) / 100,
    0,
  );
  const total = efectivo + transferencia;
  const saldo = Math.round((acordado - total) * 100) / 100;
  const hayAjuste = bonificacion > 0 || recargo > 0;

  const aNumero = (v: string) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  // Si todavía no repartió el cobro en dos medios, el efectivo acompaña al
  // total ajustado para no obligar a re-tipearlo tras cada bonificación.
  const sincronizarEfectivo = (nuevaBase: number, bonif: number, rec: number) => {
    if (transferencia === 0) {
      setEfectivo(Math.max(Math.round((nuevaBase - bonif + rec) * 100) / 100, 0));
    }
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
          value={base || ""}
          onChange={(e) => {
            const n = aNumero(e.target.value);
            setBase(n);
            sincronizarEfectivo(n, bonificacion, recargo);
          }}
        />
      </Campo>
      {precioSugerido !== null ? (
        <p className="-mt-2 text-xs text-tinta-suave">
          Precio vigente del plan: {formatoMonto(precioSugerido)}.
        </p>
      ) : null}

      <details open={hayAjuste}>
        <summary className="cursor-pointer text-sm font-medium text-marca-oscuro">
          Bonificación o recargo…
        </summary>
        <div className="mt-2 grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Bonificación ($)">
              <Input
                name="bonificacion"
                inputMode="numeric"
                value={bonificacion || ""}
                placeholder="0"
                onChange={(e) => {
                  const n = aNumero(e.target.value);
                  setBonificacion(n);
                  sincronizarEfectivo(base, n, recargo);
                }}
              />
            </Campo>
            <Campo etiqueta="Recargo ($)">
              <Input
                name="recargo"
                inputMode="numeric"
                value={recargo || ""}
                placeholder="0"
                onChange={(e) => {
                  const n = aNumero(e.target.value);
                  setRecargo(n);
                  sincronizarEfectivo(base, bonificacion, n);
                }}
              />
            </Campo>
          </div>
          <Campo etiqueta="Motivo del ajuste (opcional)">
            <Input
              name="ajusteMotivo"
              placeholder="Ej.: promo hermanas, pagó fuera de término"
            />
          </Campo>
          <p className="-mt-1 text-xs text-tinta-suave">
            La bonificación descuenta y el recargo suma sobre el monto de la
            cuota. Cobrando el total ajustado, el pago queda completo (no
            parcial) y el ajuste queda registrado.
          </p>
        </div>
      </details>

      {hayAjuste ? (
        <p className="rounded-lg bg-fondo px-3 py-2 text-sm">
          Total a cobrar: <strong>{formatoMonto(acordado)}</strong>
          <span className="ml-1 text-xs text-tinta-suave">
            ({formatoMonto(base)}
            {bonificacion > 0 ? ` − ${formatoMonto(bonificacion)} bonif.` : ""}
            {recargo > 0 ? ` + ${formatoMonto(recargo)} recargo` : ""})
          </span>
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
          Lo cobrado ({formatoMonto(total)}) supera el total a cobrar.
        </p>
      ) : saldo > 0 && total > 0 ? (
        <p className="rounded-lg bg-alerta/10 px-3 py-2 text-sm font-medium text-alerta">
          Cobro parcial: queda como deudor por {formatoMonto(saldo)}. La deuda
          se ve en su ficha y en Inicio hasta que la complete.
        </p>
      ) : null}

      <Campo etiqueta="Fecha de inicio del contrato">
        <InputFecha
          name="fechaContrato"
          required
          defaultValue={hoy}
          max={hoy}
          mensajeMax="La fecha de inicio del contrato no puede ser futura"
        />
      </Campo>
      <p className="-mt-2 text-xs text-tinta-suave">
        El vencimiento se cuenta desde esta fecha: si empezó a venir antes y
        el pago se registra hoy, poné el día en que empezó.
      </p>
    </FormAccion>
  );
}
