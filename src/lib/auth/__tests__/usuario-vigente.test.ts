import { describe, expect, it } from "vitest";
import { usuarioVigente, type FilaUsuarioSesion } from "../permissions";

// La sesión vigente se arma desde la base, no desde el token (bug 2026-07-05:
// una cookie válida con un id que ya no existía rompía las acciones que
// registran "quién lo hizo").

const fila: FilaUsuarioSesion = {
  id: 1,
  nombre: "Valentina",
  email: "valentina@ritmoslatinos.test",
  rol: "admin",
  sedeId: null,
  activo: true,
};

describe("usuarioVigente", () => {
  it("usuario borrado de la base: la sesión deja de valer", () => {
    expect(usuarioVigente(undefined)).toBeNull();
    expect(usuarioVigente(null)).toBeNull();
  });

  it("usuario desactivado: la sesión deja de valer aunque el token siga vivo", () => {
    expect(usuarioVigente({ ...fila, activo: false })).toBeNull();
  });

  it("usuario activo: sesión con los datos FRESCOS de la base", () => {
    expect(usuarioVigente(fila)).toEqual({
      id: 1,
      nombre: "Valentina",
      email: "valentina@ritmoslatinos.test",
      rol: "admin",
      sedeId: null,
    });
  });

  it("un cambio de rol o sede en la base rige al instante (no a los 30 días)", () => {
    const degradada = usuarioVigente({ ...fila, rol: "secretaria", sedeId: 2 });
    expect(degradada).toMatchObject({ rol: "secretaria", sedeId: 2 });
    // No filtra campos internos como el hash o "activo".
    expect(degradada).not.toHaveProperty("activo");
  });
});
