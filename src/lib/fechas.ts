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

/** Día de semana ISO (1 = lunes … 7 = domingo) de una fecha YYYY-MM-DD. */
export function diaSemanaISO(iso: string): number {
  const [a, m, d] = iso.split("-").map(Number);
  const dia = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  return dia === 0 ? 7 : dia;
}

/** Claves "YYYY-MM" de los últimos n meses, terminando en el mes de `hoy`. */
export function ultimosMeses(n: number, hoy: string = hoyISO()): string[] {
  const [anio, mes] = hoy.split("-").map(Number);
  const claves: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const total = anio * 12 + (mes - 1) - i;
    const a = Math.floor(total / 12);
    const m = (total % 12) + 1;
    claves.push(`${a}-${String(m).padStart(2, "0")}`);
  }
  return claves;
}
