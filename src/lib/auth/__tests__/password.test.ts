import { describe, expect, it } from "vitest";
import { hashearPassword, verificarPassword } from "../password";

describe("hash de contraseñas", () => {
  it("verifica la contraseña correcta y rechaza la incorrecta", async () => {
    const hash = await hashearPassword("ritmos123");
    expect(await verificarPassword("ritmos123", hash)).toBe(true);
    expect(await verificarPassword("otra-cosa", hash)).toBe(false);
  });

  it("nunca guarda la contraseña en texto plano", async () => {
    const hash = await hashearPassword("ritmos123");
    expect(hash).not.toContain("ritmos123");
  });
});
