// Estado vacío estándar de las secciones que llegan en fases posteriores del PLAN.md.
export function Proximamente({
  titulo,
  detalle,
  fase,
}: {
  titulo: string;
  detalle: string;
  fase: number;
}) {
  return (
    <div className="mt-6 flex flex-col items-center tarjeta border-dashed px-6 py-14 text-center">
      <span className="rounded-full bg-marca-suave px-3 py-1 text-xs font-semibold uppercase tracking-wide text-marca-oscuro">
        Llega en la fase {fase}
      </span>
      <h2 className="titulo-display mt-4 text-3xl">{titulo}</h2>
      <p className="mt-2 max-w-md text-sm text-tinta-suave">{detalle}</p>
    </div>
  );
}
