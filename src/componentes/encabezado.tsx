import Image from "next/image";

// Banner de encabezado de cada sección: título display sobre fondo tinta con
// brillo de marca y el logo como marca de agua. `extra` va a la derecha
// (chips, botones); `children` debajo del título (filtros, resúmenes).
export function EncabezadoSeccion({
  titulo,
  subtitulo,
  extra,
  children,
}: {
  titulo: React.ReactNode;
  subtitulo?: React.ReactNode;
  extra?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="banner-seccion px-5 py-6 sm:px-7 sm:py-7">
      <Image
        src="/logo.png"
        alt=""
        aria-hidden
        width={260}
        height={194}
        className="pointer-events-none absolute -bottom-8 -right-4 w-40 rotate-6 opacity-15 select-none sm:w-52"
      />
      {/* El título conserva su ancho natural (flex-auto): si el chip `extra`
          no entra al lado, baja a su propia fila en vez de pisar el texto. */}
      <div className="relative flex flex-wrap items-center gap-x-6 gap-y-4">
        <div className="min-w-0 flex-auto">
          <h1 className="titulo-display break-words text-4xl leading-none sm:text-5xl">
            {titulo}
          </h1>
          {subtitulo ? (
            <p className="mt-2 text-sm text-white/70">{subtitulo}</p>
          ) : null}
        </div>
        {extra ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:pr-24">
            {extra}
          </div>
        ) : null}
      </div>
      {children ? <div className="relative mt-5">{children}</div> : null}
    </section>
  );
}

/* Chip translúcido para usar dentro del banner (sede activa, totales, etc.). */
export function ChipBanner({
  etiqueta,
  children,
}: {
  etiqueta?: string;
  children: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2 text-sm font-medium backdrop-blur-sm ring-1 ring-white/15">
      {etiqueta ? (
        <span className="text-[11px] font-normal uppercase tracking-wide text-white/55">
          {etiqueta}
        </span>
      ) : null}
      {children}
    </span>
  );
}
