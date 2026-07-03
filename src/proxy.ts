import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION } from "@/lib/auth/session";

// Redirecciones de conveniencia (con/sin cookie de sesión). NO es la seguridad
// del sistema: cada pantalla y cada ruta de API vuelve a validar sesión y
// permisos en el servidor (src/lib/auth/guards.ts y api-guards.ts).
export default function proxy(request: NextRequest) {
  const tieneCookie = request.cookies.has(COOKIE_SESION);
  const esLogin = request.nextUrl.pathname === "/login";

  if (!tieneCookie && !esLogin) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (tieneCookie && esLogin) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Todo menos assets estáticos y la API (la API responde JSON con sus guardas).
  matcher: ["/((?!_next|api|favicon.ico|.*\\..*).*)"],
};
