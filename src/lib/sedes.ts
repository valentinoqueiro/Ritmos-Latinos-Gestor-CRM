import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { sedes, type Sede } from "@/db/schema";
import {
  sedesPermitidas,
  type UsuarioSesion,
} from "./auth/permissions";

export const COOKIE_SEDE = "rl_sede";

/**
 * Sedes visibles para el usuario, SIEMPRE filtradas en el servidor según su
 * alcance (la secretaria solo ve la suya). Toda pantalla o API que liste algo
 * por sede parte de acá.
 *
 * cache(): el layout del panel y cada página piden las sedes en el mismo
 * request; sin esto la misma consulta iba 2-3 veces a la base por navegación.
 */
export const sedesVisibles = cache(
  async (usuario: UsuarioSesion): Promise<Sede[]> => {
    const permitidas = sedesPermitidas(usuario);
    if (permitidas === "todas") {
      return db.query.sedes.findMany({
        where: eq(sedes.activa, true),
        orderBy: asc(sedes.nombre),
      });
    }
    if (permitidas.length === 0) return [];
    return db.query.sedes.findMany({
      where: inArray(sedes.id, permitidas),
      orderBy: asc(sedes.nombre),
    });
  },
);

/**
 * Sede activa para la operatoria diaria:
 * - secretaria: siempre su sede (la cookie se ignora).
 * - admin: la elegida con el selector (cookie), validada contra las visibles.
 * - owner: no opera sedes (usa el dashboard consolidado); devuelve la primera visible.
 */
export const sedeActiva = cache(
  async (usuario: UsuarioSesion): Promise<Sede | null> => {
    const visibles = await sedesVisibles(usuario);
    if (visibles.length === 0) return null;
    if (usuario.rol === "secretaria") {
      return visibles.find((s) => s.id === usuario.sedeId) ?? null;
    }
    const jar = await cookies();
    const elegida = Number(jar.get(COOKIE_SEDE)?.value);
    return visibles.find((s) => s.id === elegida) ?? visibles[0];
  },
);
