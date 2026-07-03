# PENDIENTES — Lo que tenés que hacer vos (Valentino)

> Lista viva de las tareas que dependen del humano. Claude la actualiza al final de cada sesión; vos tachá lo que vayas haciendo (o pedile a Claude que lo marque).

## Para poner el sistema online (Fase 1 — ~15 minutos)

La guía detallada paso a paso está en el [README](./README.md#publicar-guía-paso-a-paso-sin-saber-programar). En resumen:

- [ ] **1. Crear la base de datos gratis en [neon.tech](https://neon.tech)** (cuenta con Google/GitHub, proyecto `ritmos-latinos-gestor`). Copiá la **connection string "Pooled"**.
- [ ] **2. Crear el proyecto en [vercel.com](https://vercel.com)**: Add New → Project → importar el repo `Ritmos-Latinos-Gestor-CRM`. Antes de Deploy, cargar dos variables de entorno:
  - `DATABASE_URL` = la connection string de Neon.
  - `AUTH_SECRET` = un secreto largo (correr `openssl rand -base64 48` en una terminal, o pedirle uno a Claude).
- [ ] **3. Preparar la base de producción**: abrí una sesión de Claude Code sobre este repo, pasale la connection string de Neon y pedile: *"corré las migraciones y el seed contra esta base de producción"*. (O hacelo vos: `DATABASE_URL="..." npm run db:migrate && DATABASE_URL="..." npm run db:seed`.)
- [ ] **4. Probar**: entrá a la URL que te dio Vercel desde el celular y logueate con `admin@ritmoslatinos.test` / `ritmos123`. Probá también los usuarios de secretaría (están en el README).

## Decisiones de producto pendientes de confirmar

- [x] ~~Pago anticipado: ¿desde el vencimiento o desde la fecha de pago?~~ **Resuelto 2026-07-03: desde el vencimiento vigente, no se pierden días.**
- [ ] **Antes de la Fase 8**: confirmar cómo cargar los datos reales del cuaderno (recomendación: carga manual asistida entre las secretarias, sirve de práctica). Decisión 5 en `PLAN.md`.

## Para el arranque real (Fase 8, cuando lleguemos)

- [ ] Dictarle a Claude los **precios reales** de los planes y confirmar las disciplinas/horarios vigentes.
- [ ] Crear los **usuarios reales** con contraseñas propias (secretarias, admin, owners) y eliminar los usuarios de prueba.
- [ ] Cargar (o coordinar la carga de) los **alumnos reales** del cuaderno.

## Datos útiles

- Usuarios de prueba: contraseña `ritmos123` — `admin@ritmoslatinos.test`, `owner@ritmoslatinos.test`, `secretaria.aconquija@ritmoslatinos.test`, `secretaria.yerbabuena@ritmoslatinos.test`.
- El estado de avance de las fases está en `PLAN.md` → tabla "Estado de fases".
