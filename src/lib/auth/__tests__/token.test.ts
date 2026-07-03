import { describe, expect, it } from "vitest";
import { firmarToken, verificarToken } from "../token";
import type { UsuarioSesion } from "../permissions";

const SECRETO = "un-secreto-de-prueba-suficientemente-largo-123";
const usuario: UsuarioSesion = {
  id: 7,
  nombre: "Prueba",
  email: "prueba@test",
  rol: "secretaria",
  sedeId: 3,
};

describe("token de sesión", () => {
  it("firma y verifica ida y vuelta", async () => {
    const token = await firmarToken(usuario, SECRETO);
    const verificado = await verificarToken(token, SECRETO);
    expect(verificado).toMatchObject(usuario);
  });

  it("rechaza un token adulterado", async () => {
    const token = await firmarToken(usuario, SECRETO);
    const adulterado = token.slice(0, -4) + "aaaa";
    expect(await verificarToken(adulterado, SECRETO)).toBeNull();
  });

  it("rechaza un token firmado con otro secreto", async () => {
    const token = await firmarToken(
      usuario,
      "otro-secreto-distinto-igual-de-largo-456xx",
    );
    expect(await verificarToken(token, SECRETO)).toBeNull();
  });

  it("exige un secreto de al menos 32 caracteres", async () => {
    await expect(firmarToken(usuario, "corto")).rejects.toThrow();
  });
});
