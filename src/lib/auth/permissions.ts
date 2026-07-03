// Matriz de permisos por rol y alcance por sede.
//
// Este módulo es PURO (sin dependencias de Next ni de la base): es el único
// lugar donde se define quién puede qué, y lo reutilizan tanto las pantallas
// como las rutas de API. La seguridad se aplica siempre en el servidor;
// ocultar botones es solo cortesía de UI.

export type Rol = "secretaria" | "admin" | "owner";

// Secciones funcionales del sistema (crecen con las fases del PLAN.md).
export type Seccion =
  | "operativa" // alumnos, suscripciones, pagos, horarios (día a día)
  | "gastos"
  | "dashboard" // KPIs de negocio
  | "crm"
  | "configuracion";

export type UsuarioSesion = {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
  // Solo secretarias tienen sede fija; admin/owner alcanzan todas (null).
  sedeId: number | null;
};

const ACCESOS: Record<Rol, ReadonlySet<Seccion>> = {
  secretaria: new Set(["operativa"]),
  admin: new Set(["operativa", "gastos", "dashboard", "crm", "configuracion"]),
  owner: new Set(["dashboard"]),
};

export function puedeAcceder(rol: Rol, seccion: Seccion): boolean {
  return ACCESOS[rol].has(seccion);
}

// El owner es solo-lectura en TODO el sistema.
export function puedeEscribir(rol: Rol): boolean {
  return rol !== "owner";
}

export class ErrorAutorizacion extends Error {
  constructor(mensaje = "No tenés permiso para esta operación") {
    super(mensaje);
    this.name = "ErrorAutorizacion";
  }
}

/**
 * Sedes sobre las que el usuario puede operar.
 * - secretaria: únicamente su sede (si no tiene sede asignada, ninguna).
 * - admin / owner: todas.
 */
export function sedesPermitidas(usuario: UsuarioSesion): "todas" | number[] {
  if (usuario.rol === "secretaria") {
    return usuario.sedeId === null ? [] : [usuario.sedeId];
  }
  return "todas";
}

/**
 * Verifica que el usuario pueda operar sobre una sede puntual.
 * Lanza ErrorAutorizacion si no corresponde. TODA operación del servidor que
 * reciba o infiera una sede debe pasar por acá (o por sedesPermitidas).
 */
export function autorizarSede(usuario: UsuarioSesion, sedeId: number): void {
  const permitidas = sedesPermitidas(usuario);
  if (permitidas === "todas") return;
  if (!permitidas.includes(sedeId)) {
    throw new ErrorAutorizacion("No podés operar sobre esa sede");
  }
}

/**
 * Verifica acceso a una sección funcional. Lanza ErrorAutorizacion si no.
 */
export function autorizarSeccion(usuario: UsuarioSesion, seccion: Seccion): void {
  if (!puedeAcceder(usuario.rol, seccion)) {
    throw new ErrorAutorizacion("No tenés acceso a esta sección");
  }
}

/**
 * Verifica que el usuario pueda modificar datos (el owner nunca puede).
 */
export function autorizarEscritura(usuario: UsuarioSesion): void {
  if (!puedeEscribir(usuario.rol)) {
    throw new ErrorAutorizacion("Tu usuario es de solo lectura");
  }
}
