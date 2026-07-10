import { z } from "zod";

// Invitación a la clase de prueba: este sistema NO genera ni manda el email —
// junta los datos, deja revisarlos y dispara un webhook a un n8n externo que
// arma el voucher. Acá vive la parte PURA (claves de config, validación y
// armado del payload); el envío en sí es una server action del CRM.

// Claves en la tabla `configuracion` (las carga el admin cuando el n8n esté
// listo; el sistema funciona sin ellas, avisando que falta configurar).
export const CLAVE_WEBHOOK_INVITACIONES_URL = "webhook_invitaciones_url";
export const CLAVE_WEBHOOK_INVITACIONES_TOKEN = "webhook_invitaciones_token";

/**
 * Body del POST al n8n. El contrato está ACORDADO con el escenario del otro
 * lado: estas claves y este formato no se cambian sin coordinarlo.
 */
export type PayloadInvitacion = {
  nombre: string;
  email: string;
  disciplina: string;
  sede: string;
  direccion: string;
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:MM
};

// Los datos llegan del formulario de previsualización (todos editables por la
// admin antes de enviar): se validan acá con mensajes en criollo.
export const esquemaInvitacion = z.object({
  nombre: z.string().trim().min(2, "Poné el nombre que va en la invitación"),
  email: z
    .string()
    .trim()
    .min(1, "El lead no tiene email: cargalo antes de enviar la invitación")
    .email("El email no parece válido"),
  disciplina: z.string().trim().min(2, "Poné la disciplina"),
  sede: z.string().trim().min(2, "Poné la sede"),
  direccion: z
    .string()
    .trim()
    .min(5, "Poné la dirección de la sede (se puede cargar en Configuración)"),
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha de la clase no es válida"),
  hora: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Poné la hora de la clase (ej. 19:00)"),
});

/** Arma el body EXACTO acordado con el n8n, en este orden de claves. */
export function payloadInvitacion(
  datos: z.infer<typeof esquemaInvitacion>,
): PayloadInvitacion {
  return {
    nombre: datos.nombre,
    email: datos.email,
    disciplina: datos.disciplina,
    sede: datos.sede,
    direccion: datos.direccion,
    fecha: datos.fecha,
    hora: datos.hora,
  };
}

/**
 * ¿El webhook está listo para usarse? Ambos valores son obligatorios: sin
 * token no se autentica, sin URL no hay a dónde mandar.
 */
export function webhookConfigurado(
  url: string | null | undefined,
  token: string | null | undefined,
): boolean {
  return Boolean(url?.trim() && token?.trim());
}

// La URL debe ser http(s) absoluta (http solo tiene sentido en pruebas
// locales; el n8n real va por https).
export const esquemaUrlWebhook = z
  .string()
  .trim()
  .url("La URL no parece válida (tiene que empezar con https://)")
  .refine((u) => u.startsWith("https://") || u.startsWith("http://"), {
    message: "La URL tiene que empezar con https://",
  });
