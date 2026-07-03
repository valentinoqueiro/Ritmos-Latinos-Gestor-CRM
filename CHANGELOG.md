# CHANGELOG — Ritmos Latinos OS (gestor)

> Registro de cambios del sistema de gestión. Cada sesión de trabajo agrega su entrada al cierre: fecha, fase, qué se hizo, decisiones tomadas y pendientes que quedaron.

## 2026-07-03 — Fase 2: Núcleo operativo

**Hecho:**
- Disciplinas por sede y horarios semanales fijos (día + hora, nota opcional, cupo opcional), configurables por el admin; migración versionada nueva.
- Planes por sede (disciplina completa / pack / frecuencia semanal) con **historial de precios** (cada actualización agrega una fila, nunca se pisa) y desactivación en lugar de borrado.
- Alumnos: alta, edición y búsqueda por nombre/apellido/DNI, con la ficha mínima del PLAN.md validada en el servidor y DNI único por sede.
- Suscripciones: elección de exactamente N horarios en planes por frecuencia (con validación y cupos), asignación automática de todos los horarios en planes disciplina/pack, precio vigente al alta, baja explícita con fecha y motivo. Estructura de descuento en el modelo.
- Grilla semanal de horarios con inscriptos por clase (ej. "3/8") y estados de color; ficha del alumno con suscripciones y WhatsApp a mano; flujo de nueva suscripción en dos pasos.
- Seed realista: las 10 disciplinas reales de las dos sedes con sus horarios publicados, 15 planes/precios (con aumentos registrados para ver el historial) y alumnos ficticios suscriptos.
- Tests: 26 en verde (reglas de suscripción nuevas + los de Fase 1). Verificación e2e en navegador: alta de alumno, DNI duplicado rechazado, suscripción Pole 2x eligiendo horarios (rechaza 1 o 3), aislamiento entre sedes (404 sin filtrar datos), historial de precios tras un aumento.

**Pendiente:** nada propio de la fase. Sigue pendiente el deploy inicial (Fase 1, lo hace el humano con el README).

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
