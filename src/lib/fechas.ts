// Fechas del negocio: todo el sistema razona en fecha-calendario de Argentina.

export const ZONA_HORARIA = "America/Argentina/Buenos_Aires";

/** Hoy (YYYY-MM-DD) en hora argentina. */
export function hoyISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** DD/MM/AAAA para mostrar. */
export function formatoFecha(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}
