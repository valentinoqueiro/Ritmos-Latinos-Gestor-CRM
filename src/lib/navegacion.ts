import {
  puedeAcceder,
  type Rol,
  type Seccion,
} from "./auth/permissions";

// Mapa de navegación por rol. El filtrado acá es solo de UI: cada pantalla
// vuelve a validar su sección en el servidor (requerirSeccion).

export type IconoNav =
  | "inicio"
  | "alumnos"
  | "horarios"
  | "dashboard"
  | "gastos"
  | "crm"
  | "configuracion";

export type ItemNav = {
  href: string;
  etiqueta: string;
  icono: IconoNav;
  seccion: Seccion;
};

const TODOS_LOS_ITEMS: ItemNav[] = [
  { href: "/inicio", etiqueta: "Inicio", icono: "inicio", seccion: "operativa" },
  { href: "/alumnos", etiqueta: "Alumnos", icono: "alumnos", seccion: "operativa" },
  { href: "/horarios", etiqueta: "Horarios", icono: "horarios", seccion: "operativa" },
  { href: "/dashboard", etiqueta: "Dashboard", icono: "dashboard", seccion: "dashboard" },
  { href: "/gastos", etiqueta: "Gastos", icono: "gastos", seccion: "gastos" },
  { href: "/crm", etiqueta: "CRM", icono: "crm", seccion: "crm" },
  { href: "/configuracion", etiqueta: "Configuración", icono: "configuracion", seccion: "configuracion" },
];

export function itemsParaRol(rol: Rol): ItemNav[] {
  return TODOS_LOS_ITEMS.filter((item) => puedeAcceder(rol, item.seccion));
}

// En celular la barra inferior muestra hasta 5 accesos; el resto va en "Más".
export const MAX_ITEMS_BARRA = 5;
