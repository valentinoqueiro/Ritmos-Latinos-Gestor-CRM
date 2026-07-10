import { describe, expect, it } from "vitest";
import {
  esquemaInvitacion,
  esquemaUrlWebhook,
  payloadInvitacion,
  webhookConfigurado,
} from "../invitaciones";

const datosValidos = {
  nombre: "María González",
  email: "maria@ejemplo.com",
  disciplina: "Salsa y Bachata",
  sede: "Sede LS",
  direccion: "Julio Argentino Roca 124, Yerba Buena",
  fecha: "2026-07-15",
  hora: "19:00",
};

describe("esquemaInvitacion", () => {
  it("acepta los datos completos", () => {
    expect(esquemaInvitacion.parse(datosValidos)).toEqual(datosValidos);
  });

  it("recorta espacios en los campos de texto", () => {
    const datos = esquemaInvitacion.parse({
      ...datosValidos,
      nombre: "  María González  ",
    });
    expect(datos.nombre).toBe("María González");
  });

  it("rechaza el email vacío pidiendo cargarlo (caso lead sin email)", () => {
    const resultado = esquemaInvitacion.safeParse({
      ...datosValidos,
      email: "",
    });
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues[0]?.message).toMatch(/no tiene email/);
    }
  });

  it("rechaza un email con formato inválido", () => {
    expect(
      esquemaInvitacion.safeParse({ ...datosValidos, email: "no-es-email" })
        .success,
    ).toBe(false);
  });

  it.each(["25:00", "19", "7pm", ""])("rechaza la hora %s", (hora) => {
    expect(esquemaInvitacion.safeParse({ ...datosValidos, hora }).success).toBe(
      false,
    );
  });

  it.each(["15/07/2026", "2026-7-15", ""])(
    "rechaza la fecha %s",
    (fecha) => {
      expect(
        esquemaInvitacion.safeParse({ ...datosValidos, fecha }).success,
      ).toBe(false);
    },
  );
});

describe("payloadInvitacion", () => {
  it("arma el body EXACTO acordado con el n8n (claves y orden)", () => {
    const payload = payloadInvitacion(datosValidos);
    // El contrato con el n8n externo no se cambia: claves exactas, en orden.
    expect(Object.keys(payload)).toEqual([
      "nombre",
      "email",
      "disciplina",
      "sede",
      "direccion",
      "fecha",
      "hora",
    ]);
    expect(JSON.parse(JSON.stringify(payload))).toEqual({
      nombre: "María González",
      email: "maria@ejemplo.com",
      disciplina: "Salsa y Bachata",
      sede: "Sede LS",
      direccion: "Julio Argentino Roca 124, Yerba Buena",
      fecha: "2026-07-15",
      hora: "19:00",
    });
  });
});

describe("webhookConfigurado", () => {
  it("necesita URL y token a la vez", () => {
    expect(webhookConfigurado("https://n8n.io/webhook", "tok")).toBe(true);
    expect(webhookConfigurado("https://n8n.io/webhook", "")).toBe(false);
    expect(webhookConfigurado("https://n8n.io/webhook", null)).toBe(false);
    expect(webhookConfigurado("", "tok")).toBe(false);
    expect(webhookConfigurado(null, undefined)).toBe(false);
    // Espacios solos no cuentan como configurado.
    expect(webhookConfigurado("   ", "tok")).toBe(false);
    expect(webhookConfigurado("https://n8n.io/webhook", "   ")).toBe(false);
  });
});

describe("esquemaUrlWebhook", () => {
  it("acepta https y http (pruebas locales)", () => {
    expect(
      esquemaUrlWebhook.parse("https://mi-n8n.app/webhook/invitaciones"),
    ).toBe("https://mi-n8n.app/webhook/invitaciones");
    expect(esquemaUrlWebhook.parse("http://localhost:5678/webhook")).toBe(
      "http://localhost:5678/webhook",
    );
  });

  it("rechaza lo que no es una URL absoluta http(s)", () => {
    expect(esquemaUrlWebhook.safeParse("n8n.io/webhook").success).toBe(false);
    expect(esquemaUrlWebhook.safeParse("ftp://n8n.io").success).toBe(false);
    expect(esquemaUrlWebhook.safeParse("").success).toBe(false);
  });
});
