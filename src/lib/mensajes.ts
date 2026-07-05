// Mensajes a interesados: plantilla configurable por el admin (tabla
// configuracion) que la secretaria manda por WhatsApp con un click.
// Módulo PURO: el render y el link no tocan la base.

export const CLAVE_MENSAJE_INTERESADOS = "mensaje_interesados";

export const MENSAJE_INTERESADOS_DEFAULT =
  "¡Hola {nombre}! Te escribimos de Ritmos Latinos por tu consulta. " +
  "¿Te gustaría venir a una clase de prueba? Contanos qué disciplina te interesa y te pasamos los horarios.";

// Recontacto de ALUMNOS (retención): otro tono que el de interesados nuevos —
// acá le hablamos a alguien que ya es de la casa y se está alejando.
export const CLAVE_MENSAJE_RECONTACTO = "mensaje_recontacto";

export const MENSAJE_RECONTACTO_DEFAULT =
  "¡Hola {nombre}! Te extrañamos en Ritmos Latinos 💃 " +
  "Hace un tiempo que no te vemos por el estudio. ¿Todo bien? " +
  "Si querés retomar, contanos y te reservamos tu lugar.";

/**
 * Reemplaza los placeholders {clave} por sus valores. Los placeholders sin
 * valor quedan tal cual (así un typo en la plantilla se ve, no desaparece).
 */
export function renderizarPlantilla(
  plantilla: string,
  valores: Record<string, string>,
): string {
  return plantilla.replace(/\{(\w+)\}/g, (original, clave: string) =>
    clave in valores ? valores[clave] : original,
  );
}

/**
 * Link click-to-chat de WhatsApp: normaliza el teléfono a solo dígitos y
 * agrega el texto prellenado si lo hay.
 */
export function linkWhatsApp(telefono: string, texto?: string): string {
  const numero = telefono.replace(/\D/g, "");
  const base = `https://wa.me/${numero}`;
  return texto ? `${base}?text=${encodeURIComponent(texto)}` : base;
}
