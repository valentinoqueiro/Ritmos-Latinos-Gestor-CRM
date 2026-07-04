# Ritmos Latinos OS — Gestor de Alumnos + CRM

Sistema de gestión interno de la academia **Ritmos Latinos** (Tucumán, Argentina): alumnos, suscripciones, cobros, gastos, KPIs y CRM, multi-sede. El plan completo de desarrollo está en [`PLAN.md`](./PLAN.md) y el historial en [`CHANGELOG.md`](./CHANGELOG.md). Para integrar sistemas externos (n8n, agentes, formularios) con la API pública, ver [`docs/API_PUBLICA.md`](./docs/API_PUBLICA.md).

- **Stack**: Next.js (App Router) full-stack · Postgres (Neon en producción) · Vercel (plan gratuito).
- **Idioma/región**: español (Argentina) · zona horaria America/Argentina/Buenos_Aires · moneda ARS.
- **Seguridad**: roles `secretaria` / `admin` / `owner` con autorización por rol+sede aplicada en el backend en cada operación (`src/lib/auth/`).

## Correr en local (para desarrollo)

Requisitos: Node 20+, Postgres corriendo.

```bash
# 1. Dependencias
npm install

# 2. Variables de entorno
cp .env.example .env   # completá DATABASE_URL y AUTH_SECRET

# 3. Base de datos: aplicar migraciones y datos semilla
npm run db:migrate
npm run db:seed

# 4. Levantar
npm run dev            # http://localhost:3000
```

Usuarios de prueba que crea el seed (contraseña `ritmos123`; se reemplazan por credenciales reales en la Fase 8):

| Email | Rol | Alcance |
|---|---|---|
| `secretaria.aconquija@ritmoslatinos.test` | secretaria | Solo Sede Aconquija |
| `secretaria.yerbabuena@ritmoslatinos.test` | secretaria | Solo Sede Yerba Buena |
| `admin@ritmoslatinos.test` | admin | Todas las sedes + configuración |
| `owner@ritmoslatinos.test` | owner | Dashboard, solo lectura |

## Scripts útiles

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm start` | Build y servidor de producción |
| `npm test` | Tests (permisos, sesión, contraseñas) |
| `npm run db:generate` | Genera una migración a partir de cambios en `src/db/schema.ts` |
| `npm run db:migrate` | Aplica las migraciones pendientes (`drizzle/`) |
| `npm run db:seed` | Carga los datos semilla (idempotente) |

El esquema de la base evoluciona **solo por migraciones versionadas** (carpeta `drizzle/`, se commitea siempre).

## Publicar (guía paso a paso, sin saber programar)

Se necesitan dos cuentas gratuitas: **Neon** (base de datos) y **Vercel** (hosting).

### 1. Base de datos en Neon

1. Entrá a [neon.tech](https://neon.tech) y creá una cuenta gratis (podés usar tu cuenta de Google/GitHub).
2. Creá un proyecto (nombre sugerido: `ritmos-latinos-gestor`). Elegí la región más cercana (South America, si está disponible).
3. En el panel del proyecto, buscá **Connection string** y copiá la URL que dice **Pooled connection** (empieza con `postgresql://` y termina con `sslmode=require`). Esa es tu `DATABASE_URL`.

### 2. App en Vercel

1. Entrá a [vercel.com](https://vercel.com) con tu cuenta (la misma donde está la landing).
2. **Add New → Project** e importá este repositorio (`Ritmos-Latinos-Gestor-CRM`). No hace falta cambiar ninguna configuración de build: Vercel detecta Next.js solo.
3. Antes de darle **Deploy**, en **Environment Variables** agregá:
   - `DATABASE_URL` → la URL de Neon del paso anterior.
   - `AUTH_SECRET` → un secreto largo. Generalo en una terminal con `openssl rand -base64 48`, o pedile a Claude que te dé uno.
4. **Deploy**. Al terminar vas a tener una URL tipo `https://ritmos-latinos-gestor.vercel.app`.

### 3. Preparar la base de producción (una sola vez)

Desde una terminal en este repo (o pedíselo a Claude en una sesión):

```bash
DATABASE_URL="<la URL de Neon>" npm run db:migrate
DATABASE_URL="<la URL de Neon>" npm run db:seed
```

Listo: entrá a la URL de Vercel y probá los usuarios de prueba.

## Alta y baja de usuarios (mientras no exista la pantalla)

Los usuarios se gestionan por ahora con el seed o directamente en la base (una pantalla de gestión llega en fases posteriores del PLAN.md). Para crear un usuario nuevo, lo más simple es pedírselo a Claude en una sesión sobre este repo: indicale nombre, email, rol (`secretaria`/`admin`/`owner`) y sede (si es secretaria).

## Estructura del código

```
drizzle/               migraciones SQL versionadas
src/db/                esquema, conexión y seed
src/lib/auth/          sesión, contraseñas y matriz de permisos rol+sede (con tests)
src/lib/sedes.ts       alcance por sede (sedes visibles / sede activa)
src/app/login/         pantalla y acción de ingreso
src/app/(panel)/       pantallas internas (layout con navegación por rol)
src/app/api/interno/   API interna autenticada por sesión
src/proxy.ts           redirecciones de conveniencia (la seguridad real está en los guards)
```
