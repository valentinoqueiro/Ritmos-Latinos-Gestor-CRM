// Nombre de la cookie de sesión, en módulo propio y PURO: el middleware
// (src/proxy.ts, corre en edge) necesita esta constante y no puede importar
// session.ts, que desde la validación contra la base arrastra pg.
export const COOKIE_SESION = "rl_sesion";
