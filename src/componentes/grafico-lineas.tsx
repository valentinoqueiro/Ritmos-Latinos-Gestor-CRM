// Gráfico de líneas SVG server-rendered (sin dependencias): evolución mensual
// de series en la misma unidad (un solo eje). Sigue la skill dataviz: líneas
// de 2px, marcadores ≥8px con anillo de superficie, grilla recesiva, leyenda
// siempre presente para ≥2 series + etiquetas directas en el último punto,
// texto en tinta (nunca en el color de la serie), y <title> nativo por punto.
// Paleta validada con validate_palette.js (ΔE CVD 67, contraste ≥3:1).

export type SerieLinea = {
  nombre: string;
  color: string;
  puntos: number[];
};

const ANCHO = 640;
const ALTO = 260;
const MARGEN = { arriba: 16, abajo: 28, izq: 8, der: 76 };

function formatoCompacto(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")} M`;
  if (abs >= 1_000) return `${Math.round(n / 1_000)} mil`;
  return String(Math.round(n));
}

export function GraficoLineas({
  series,
  etiquetas,
  titulo,
}: {
  series: SerieLinea[];
  etiquetas: string[]; // una por punto (ej. "feb", "mar"…)
  titulo: string;
}) {
  const todos = series.flatMap((s) => s.puntos);
  const maximo = Math.max(...todos, 1);
  const minimo = Math.min(...todos, 0);
  const rango = maximo - minimo || 1;
  const anchoUtil = ANCHO - MARGEN.izq - MARGEN.der;
  const altoUtil = ALTO - MARGEN.arriba - MARGEN.abajo;
  const n = etiquetas.length;

  const x = (i: number) =>
    MARGEN.izq + (n === 1 ? anchoUtil / 2 : (i / (n - 1)) * anchoUtil);
  const y = (v: number) =>
    MARGEN.arriba + altoUtil - ((v - minimo) / rango) * altoUtil;

  // Grilla: 3 líneas horizontales recesivas (min, medio, max) + línea de cero si aplica.
  const niveles = [minimo, minimo + rango / 2, maximo];

  return (
    <figure>
      <figcaption className="text-sm font-semibold text-tinta-suave">
        {titulo}
      </figcaption>
      <div className="mt-2 overflow-x-auto">
        <svg
          viewBox={`0 0 ${ANCHO} ${ALTO}`}
          role="img"
          aria-label={titulo}
          className="min-w-[480px]"
        >
          {niveles.map((v, i) => (
            <g key={i}>
              <line
                x1={MARGEN.izq}
                x2={ANCHO - MARGEN.der}
                y1={y(v)}
                y2={y(v)}
                stroke="#e7e0dc"
                strokeWidth="1"
              />
              <text
                x={ANCHO - MARGEN.der + 6}
                y={y(v) + 4}
                fontSize="11"
                fill="#4d4749"
              >
                $ {formatoCompacto(v)}
              </text>
            </g>
          ))}
          {minimo < 0 ? (
            <line
              x1={MARGEN.izq}
              x2={ANCHO - MARGEN.der}
              y1={y(0)}
              y2={y(0)}
              stroke="#4d4749"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          ) : null}

          {etiquetas.map((e, i) => (
            <text
              key={e + i}
              x={x(i)}
              y={ALTO - 8}
              fontSize="11"
              textAnchor="middle"
              fill="#4d4749"
            >
              {e}
            </text>
          ))}

          {series.map((serie) => (
            <g key={serie.nombre}>
              <polyline
                points={serie.puntos.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
                fill="none"
                stroke={serie.color}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {serie.puntos.map((v, i) => (
                <circle
                  key={i}
                  cx={x(i)}
                  cy={y(v)}
                  r="4"
                  fill={serie.color}
                  stroke="#ffffff"
                  strokeWidth="2"
                >
                  <title>
                    {serie.nombre} · {etiquetas[i]}: ${" "}
                    {new Intl.NumberFormat("es-AR").format(Math.round(v))}
                  </title>
                </circle>
              ))}
            </g>
          ))}
        </svg>
      </div>
      {/* Leyenda (identidad nunca solo por color: punto + texto en tinta) */}
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {series.map((serie) => (
          <li key={serie.nombre} className="flex items-center gap-1.5 text-xs">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: serie.color }}
            />
            <span className="font-medium">{serie.nombre}</span>
            <span className="text-tinta-suave">
              $ {formatoCompacto(serie.puntos[serie.puntos.length - 1] ?? 0)} este
              mes
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
