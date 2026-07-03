import type { IconoNav } from "@/lib/navegacion";

// Set mínimo de íconos propios (SVG inline, trazo 1.8) para no sumar dependencias.

type Props = { className?: string };

function Svg({
  children,
  className,
}: Props & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {children}
    </svg>
  );
}

export function IconoInicio(p: Props) {
  return (
    <Svg {...p}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M10 21v-6h4v6" />
    </Svg>
  );
}

export function IconoAlumnos(p: Props) {
  return (
    <Svg {...p}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.8 20c.7-3.2 3.2-5 6.2-5s5.5 1.8 6.2 5" />
      <circle cx="17" cy="9.5" r="2.4" />
      <path d="M15.5 14.6c2.9.1 5 1.6 5.7 4.4" />
    </Svg>
  );
}

export function IconoHorarios(p: Props) {
  return (
    <Svg {...p}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9.5h18M8 3v4M16 3v4" />
      <path d="M8 14h3M13 14h3M8 17.5h3" />
    </Svg>
  );
}

export function IconoDashboard(p: Props) {
  return (
    <Svg {...p}>
      <path d="M4 20V10M10 20V4M16 20v-7M21 20H3" />
    </Svg>
  );
}

export function IconoGastos(p: Props) {
  return (
    <Svg {...p}>
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M3 10h18" />
      <path d="M7 15h4" />
    </Svg>
  );
}

export function IconoCrm(p: Props) {
  return (
    <Svg {...p}>
      <path d="M4 4h16l-6 8v6l-4 2v-8L4 4Z" />
    </Svg>
  );
}

export function IconoConfiguracion(p: Props) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 0 0-.2-1.6l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2.7-1.6L13.4 2h-2.8l-.4 2.9a7 7 0 0 0-2.7 1.6l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .55.07 1.08.2 1.6l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2.7 1.6l.4 2.9h2.8l.4-2.9a7 7 0 0 0 2.7-1.6l2.3 1 2-3.4-2-1.5c.13-.52.2-1.05.2-1.6Z" />
    </Svg>
  );
}

export function IconoMas(p: Props) {
  return (
    <Svg {...p}>
      <circle cx="5" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.1" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconoSalir(p: Props) {
  return (
    <Svg {...p}>
      <path d="M14 4h-8v16h8" />
      <path d="M10 12h11M17.5 8.5 21 12l-3.5 3.5" />
    </Svg>
  );
}

export function IconoSede(p: Props) {
  return (
    <Svg {...p}>
      <path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.3" />
    </Svg>
  );
}

export function IconoCobros(p: Props) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6.5v11M15 8.8c-.7-.8-1.8-1.3-3-1.3-1.8 0-3.2 1-3.2 2.4 0 3.1 6.4 1.6 6.4 4.6 0 1.4-1.4 2.4-3.2 2.4-1.2 0-2.3-.5-3-1.3" />
    </Svg>
  );
}

export function IconoNavPorNombre({
  nombre,
  className,
}: Props & { nombre: IconoNav }) {
  switch (nombre) {
    case "inicio":
      return <IconoInicio className={className} />;
    case "alumnos":
      return <IconoAlumnos className={className} />;
    case "cobros":
      return <IconoCobros className={className} />;
    case "horarios":
      return <IconoHorarios className={className} />;
    case "dashboard":
      return <IconoDashboard className={className} />;
    case "gastos":
      return <IconoGastos className={className} />;
    case "crm":
      return <IconoCrm className={className} />;
    case "configuracion":
      return <IconoConfiguracion className={className} />;
  }
}
