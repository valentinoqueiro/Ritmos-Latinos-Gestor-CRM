import { formatoFecha } from "@/lib/fechas";
import type { EstadoCuota } from "@/lib/vencimientos";

// Chip de estado de cuota: legible de un vistazo en el mostrador.
export function EstadoCuotaChip({
  estado,
  vence,
  diasRestantes,
}: {
  estado: EstadoCuota;
  vence: string | null;
  diasRestantes: number | null;
}) {
  if (estado === "al_dia" && vence) {
    return (
      <span className="rounded-full bg-ok/10 px-2.5 py-1 text-xs font-semibold text-ok">
        Al día · hasta el {formatoFecha(vence)}
      </span>
    );
  }
  if (estado === "por_vencer" && vence) {
    const texto =
      diasRestantes === 0
        ? "vence hoy"
        : diasRestantes === 1
          ? "vence mañana"
          : `vence en ${diasRestantes} días`;
    return (
      <span className="rounded-full bg-alerta/10 px-2.5 py-1 text-xs font-semibold text-alerta">
        Por vencer · {texto}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-marca-suave px-2.5 py-1 text-xs font-semibold text-peligro">
      {vence === null
        ? "Sin pagos"
        : `Vencida hace ${Math.abs(diasRestantes ?? 0)} ${Math.abs(diasRestantes ?? 0) === 1 ? "día" : "días"}`}
    </span>
  );
}
