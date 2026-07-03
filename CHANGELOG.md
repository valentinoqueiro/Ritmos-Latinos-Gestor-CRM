# CHANGELOG — Ritmos Latinos OS (gestor)

> Registro de cambios del sistema de gestión. Cada sesión de trabajo agrega su entrada al cierre: fecha, fase, qué se hizo, decisiones tomadas y pendientes que quedaron.

## 2026-07-03 — Fase 1: Fundaciones (código completo; deploy pendiente del humano)

**Hecho:**
- App Next.js full-stack en la raíz del repo (TypeScript, Tailwind), lista para Vercel.
- Base Postgres con Drizzle: esquema de sedes y usuarios, migraciones versionadas (`drizzle/`), seed idempotente con las 2 sedes reales (Aconquija y Yerba Buena) y un usuario de prueba por rol (contraseña `ritmos123`).
- Autenticación con sesión segura (JWT en cookie httpOnly, 30 días) y contraseñas hasheadas con bcrypt.
- Autorización rol+sede transversal en backend: matriz de permisos pura + guards para pantallas y API. Verificado con llamadas HTTP reales: secretaria de una sede no ve la otra ni por URL ni por API; owner es solo lectura; cookie adulterada = 401.
- UI mobile-first en es-AR con identidad de la marca (rojo/tinta/Bebas Neue): login, navegación por rol (barra inferior en celular, lateral en escritorio), selector de sede persistente para admin, pantalla de configuración con sedes y usuarios reales, placeholders de fases futuras.
- Tests (vitest): matriz de permisos, alcance por sede, token de sesión, contraseñas — 14 tests en verde. Verificación e2e con navegador (login de los 3 roles, selector de sede, bloqueos por rol).
- README con guía de deploy paso a paso (Neon + Vercel) para una persona no técnica.

**Pendiente para cerrar la fase:** el humano crea la cuenta de Neon y el proyecto Vercel siguiendo el README (o pide ayuda en una sesión), se corren migraciones+seed contra producción y se verifica el login en la URL desplegada.

## 2026-07-03 — Plan creado

- Se crea `PLAN.md` (ULTRAPLAN): resumen ejecutivo y stack, modelo de datos, diseño de API, mapa de pantallas por rol, plan de 8 fases con prompts de ejecución, y riesgos/decisiones abiertas.
- Decisión de estructura (revisada por el cliente): el gestor vive en este repo dedicado (`ritmos-latinos-gestor-crm`), en la raíz, con su propio proyecto Vercel. La landing pública queda en su repo original (`Ritmos_Latinos`) y no forma parte de este sistema.
- Próximo paso: ejecutar la Fase 1 (Fundaciones).
