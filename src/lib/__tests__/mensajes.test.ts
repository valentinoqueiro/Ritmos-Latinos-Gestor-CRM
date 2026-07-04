import { describe, expect, it } from "vitest";
import { linkWhatsApp, renderizarPlantilla } from "../mensajes";

describe("renderizarPlantilla", () => {
  it("reemplaza el placeholder {nombre}", () => {
    expect(renderizarPlantilla("Hola {nombre}!", { nombre: "Caro" })).toBe(
      "Hola Caro!",
    );
  });

  it("reemplaza el mismo placeholder todas las veces que aparece", () => {
    expect(
      renderizarPlantilla("{nombre}, {nombre}", { nombre: "Caro" }),
    ).toBe("Caro, Caro");
  });

  it("un placeholder sin valor queda tal cual (el typo se ve, no desaparece)", () => {
    expect(renderizarPlantilla("Hola {nombr}", { nombre: "Caro" })).toBe(
      "Hola {nombr}",
    );
  });
});

describe("linkWhatsApp", () => {
  it("normaliza el teléfono a solo dígitos", () => {
    expect(linkWhatsApp("+54 9 381 555-0101")).toBe(
      "https://wa.me/5493815550101",
    );
  });

  it("sin texto: link pelado, sin ?text=", () => {
    expect(linkWhatsApp("3815550101")).toBe("https://wa.me/3815550101");
  });

  it("con texto: lo codifica para URL (acentos, signos, saltos de línea)", () => {
    const link = linkWhatsApp("3815550101", "¡Hola!\n¿Venís?");
    expect(link).toBe(
      `https://wa.me/3815550101?text=${encodeURIComponent("¡Hola!\n¿Venís?")}`,
    );
  });
});
