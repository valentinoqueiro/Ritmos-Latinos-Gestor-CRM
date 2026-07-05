# CHANGELOG — Ritmos Latinos OS (gestor)

> Registro de cambios del sistema de gestión. Cada sesión de trabajo agrega su entrada al cierre: fecha, fase, qué se hizo, decisiones tomadas y pendientes que quedaron.

## 2026-07-05 — Fix: sesiones huérfanas rompían el pipeline del CRM («Algo salió mal» al mover cards)

**Causa raíz (capturada en vivo de los logs de runtime de Vercel, tras un primer diagnóstico erróneo que la atribuía al bug de Neon de abajo):** la cookie de sesión (JWT de 30 días) del cliente estaba firmada con un **id de usuario que ya no existe** en la base de producción (los usuarios se recrearon después del deploy inicial y los ids cambiaron). `obtenerSesion` solo verificaba la firma del token — nunca que el usuario siguiera existiendo — así que el panel renderizaba normal, pero TODA transición del pipeline inserta en `lead_actividades` el `registrado_por_id` de la sesión y la FK a `usuarios` la rechazaba: `Key (registrado_por_id)=(3) is not present in table "usuarios"` → catch genérico → «Algo salió mal», el 100 % de las veces para ese navegador y nunca para sesiones nuevas. Crear leads sí funcionaba (no registra autor), por eso el bug parecía exclusivo del movimiento de cards.

**Fix:**
- `obtenerSesion` (src/lib/auth/session.ts) ahora **valida la sesión contra la base en cada request** (cacheado por request): usuario inexistente o desactivado ⇒ sesión nula ⇒ al login. Los datos vigentes (rol, sede, nombre) salen SIEMPRE de la base, no del token: un cambio de rol o una baja rigen al instante, no a los 30 días — de paso se cierra ese agujero de autorización.
- Lógica pura testeable en `usuarioVigente` (permissions.ts) + 4 tests nuevos (126 en verde).
- `COOKIE_SESION` se movió a `src/lib/auth/cookie.ts` (el proxy edge no puede importar un session.ts que ahora toca pg).
- El redirect de conveniencia «/login con cookie ⇒ /» salió del proxy (con una cookie huérfana generaba un **loop infinito** /login ⇄ /, verificado) y vive en `login/page.tsx`, que valida la sesión completa contra la base.

**Verificado e2e en build de producción:** cookie bien firmada de un usuario inexistente ⇒ /crm → /login (200, sin loop); login normal → mover card del kanban OK; usuario logueado que visita /login vuelve a su inicio. Diagnóstico intermedio documentado: esquema de Neon en sync (9/9 migraciones), el movimiento anduvo en producción con sesión fresca incluso en frío (13 min de suspend de Neon) — lo que delató que el problema era la sesión del navegador del cliente y no el servidor.

**Para el cliente:** al entrar después de este deploy, el sistema lo va a mandar solo al login una única vez; con loguearse de nuevo queda resuelto para siempre.

## 2026-07-04 — Fix crítico: "Algo salió mal" por conexión muerta de Neon

**Hecho:**
- **Causa raíz** del error genérico intermitente en TODA la app (mover/retroceder card, agendar prueba, crear interesado, y cualquier server action): el `pg.Pool` a nivel de módulo guardaba conexiones que Neon (free tier) **cortaba al suspender el compute** tras ~5 min de inactividad. Un lambda de Vercel "congelado" revivía y reusaba una conexión muerta → la primera query fallaba (`Connection terminated unexpectedly` / `ECONNRESET`) → caía en `mensajeDeError` → "Algo salió mal". Los tests nunca lo veían porque mantienen la base caliente; el "a veces guarda, a veces no" era según muriera la conexión antes o después del commit.
- **Fix (sin cambiar de driver, anda igual local y en Neon):** cliente de base **auto-sanable** (`src/db/resiliencia.ts`). `pool.on('error')` (obligatorio en node-pg para no tumbar el proceso con errores de clientes ociosos); `keepAlive`, `idleTimeoutMillis`, `maxUses` y `connectionTimeoutMillis` acordes a Neon. Lo central: se envuelven `pool.query` (reintenta la primera query si la conexión estaba muerta; pg ya descartó la muerta, el reintento toma una fresca que despierta a Neon) y `pool.connect` (valida con `SELECT 1` ANTES de dársela a una transacción y descarta la muerta) — un timeout solo no alcanza porque el freeze del lambda congela los timers.
- **Verificado:** test de integración real contra `gestor_dev` que **mata todas las conexiones del backend** (simula el suspend de Neon) y confirma que query suelta y transacción se auto-sanan sin error. 10 tests unitarios nuevos de `esErrorDeConexion` y del wrapper (reintenta conexión / NO reintenta errores de datos). Suite completa 122 verde, typecheck y build de producción OK.
- **Criterio de aceptación:** dejar el sistema quieto ~10 min y operar sin ver "Algo salió mal".

## 2026-07-04 — Rediseño CRM · R5: métricas + pase de diseño (cierre del rediseño)

**Hecho:**
- Tercera pestaña del CRM: **Métricas** (`/crm/metricas`, solo admin). KPIs del embudo (abiertos, fríos ahora, convertidos/perdidos, conversión global), embudo por etapa y barras con etiquetado directo por **disciplina**, **origen** y **sede derivada** (un lead con dos disciplinas cuenta en ambas — criterio explícito). Cada gráfico tiene su «Ver como tabla» (accesibilidad) y números tabulares. Lógica pura testeada (`metricasDeLeads` en `reglas-crm.ts`): tasas por dimensión, «Sin clasificar» visible, orden por total.
- El contador de **«sin disciplina» es visible y accionable** (decisión del cliente): chip en Métricas que lleva al pipeline a clasificarlos + filtro en el kanban.
- **Pase de diseño con la skill ui-ux-pro-max** sobre lo existente (manteniendo la identidad de marca — la skill sugería otra paleta/tipografía, pero la consistencia de marca manda): foco visible con color de marca y `prefers-reduced-motion` globales; íconos SVG en lugar de glifos (frío ❄→SVG, cerrar ✕→SVG, ★ eliminado); tipografía mínima 12px en chips; touch targets ampliados en las tarjetas del kanban; contrastes subidos en el tablero oscuro; pestañas del CRM en fila propia en móvil.
- Fix del seed: los leads semilla ahora clasifican su origen de negocio por `fuente` (mismo criterio que el backfill de la migración).
- Verificación e2e del **recorrido completo**: captura en mostrador (secretaria, con disciplina) → kanban → contactado → prueba agendada → conversión con alta encadenada y sugerencia de plan → pérdida con motivo → métricas con números verificados a mano (conversión 33 %, Zumba 100 %, Mostrador 3 leads · 50 %, 4 sin disciplina). Permisos por URL re-verificados (secretaria y owner bloqueados).

**El rediseño del CRM (R1–R5) queda completo y en producción.**

## 2026-07-04 — Rediseño CRM · R4: retención «A recontactar» + conversión enriquecida

**Hecho:**
- Pestañas en el shell del CRM: **Pipeline** y **A recontactar** (la retención vive dentro del CRM, no aparte).
- `/crm/recontactar` (solo admin): lista accionable de alumnos según la señal de cuota — vencidas recientes (menos de 10 días o nunca pagaron), por vencer y «dejaron de venir» (abandonos) — con plan, sede, fecha, saldo de pagos parciales y botón **«Recontactar por WhatsApp»** con mensaje prellenado y nombre de pila. Reutiliza la misma lógica derivada de `cobros.ts` que usan la secretaria y el dashboard; NO es un segundo pipeline (sin etapas).
- **Plantilla de recontacto propia** (separada de la de interesados, otro tono), editable por el admin en Configuración con `{nombre}`; el cambio se refleja al instante en los links.
- **Conversión enriquecida**: al convertir un lead, la pantalla de suscripción ordena primero y marca con «★ le interesaba» los planes que incluyen sus disciplinas de interés.
- Verificado e2e: Inicio de la secretaria idéntico (sección por sección) y bloqueada de `/crm/recontactar` por URL; grupos con los datos del seed; wa.me con plantilla propia; edición de plantilla reflejada; conversión de un lead con Zumba sugiere el plan Zumba primero.

**Nota de alcance:** los deudores de pagos parciales con cuota vigente no aparecen en «A recontactar» (su cuota está al día); siguen visibles en Cobros («pagos parciales a completar») y como badge «debe $X» cuando además vencen.

## 2026-07-04 — Rediseño CRM · R3: captura con disciplinas + API v1 (y fix de acciones colgadas)

**Hecho:**
- `/interesados` (secretaria): el formulario suma multi-select de disciplinas de interés de TODO el catálogo (la sede del lead se deriva de la disciplina, no del mostrador; `sedeInteresId` queda como sede de captura para su lista). La lista de 7 días ya no muestra la etapa del pipeline (decisión del cliente) y muestra las disciplinas.
- `POST /api/v1/leads` acepta `disciplinas` (nombres del catálogo, case-insensitive, derivan la sede; desconocida = 400 con la lista de válidas) y `origenNegocio` (catálogo configurable); contrato anterior 100 % compatible (`sedeInteresId` documentado como obsoleto).
- `GET /api/v1/leads` nuevo (alcance `leads:read`): pipeline completo en solo lectura con filtros `estado` y `desde`, disciplinas, `sedeIds` derivadas y `etapaDesde` — la vía para automatizaciones externas. Documentado en `docs/API_PUBLICA.md`.
- **Fix importante (bug pre-existente)**: en producción, TODA server action del panel que revalidaba sin redirect (dar de baja, abrir turno, egresos, guardar umbral…) dejaba la respuesta colgada («Guardando…» eterno) aunque el dato se guardaba. Causa: el `loading.tsx` del grupo `(panel)` + revalidatePath en build de producción (Next 16). Workaround: se quitó ese `loading.tsx` (el del CRM no tiene el problema y queda). Verificado antes/después en el build de producción.
- Verificación e2e: captura con 2 disciplinas de sedes distintas visible en el kanban con ambas sedes; POST formato viejo (201), POST nuevo (201), disciplina desconocida (400), GET con filtros (200), estado inválido (400), key sin alcance (403), key con su alcance (200).

## 2026-07-04 — Rediseño CRM · R2: kanban, ficha del lead y alerta de frío

**Hecho:**
- `/crm` pasa de listas verticales a **tablero kanban** (5 columnas sobre la identidad oscura de la marca, tarjetas arrastrables con dnd-kit): drag directo entre etapas abiertas (retrocesos incluidos), soltar en Prueba/Perdido abre su formulario (cancelar revierte), Convertido confirma y sigue al flujo existente; drags inválidos avisan sin mover; optimista con reversión.
- Fallback táctil «Mover ▾» por tarjeta + scroll horizontal con snap (celular garantizado).
- **Ficha del lead** (`/crm/[id]`): datos, clasificación editable de disciplinas y origen (así la admin completa los «sin disciplina»), historial de actividad con notas por canal, WhatsApp con la plantilla existente.
- Alerta de **lead frío** (badge en tarjeta + contador en cabecera) con umbral editable en Configuración (default 3 días); chip «sin disciplina · clasificar» accionable como filtro; alta manual con disciplinas y origen.
- Verificación e2e en build de producción: drag ida/vuelta, modales, umbral dinámico, wa.me prellenado, nota visible sin recargar, móvil por menú, secretaria/owner bloqueados por URL. Fix visual: las tarjetas heredaban texto blanco del tablero oscuro.

## 2026-07-04 — Rediseño CRM · R1: cimientos del modelo + deuda documental

**Hecho:**
- Migración `0008_crm-cimientos` (aditiva, sin cambios de comportamiento visibles): disciplinas de interés del lead (`lead_disciplinas`, muchos-a-muchos con el catálogo del gestor — la sede se DERIVA de la disciplina), catálogo configurable de orígenes de negocio (`origenes_negocio`, semilla: Meta Ads, Instagram, Mostrador, Web, Referido, Otro) con backfill de leads históricos por coincidencia de `fuente`, marca temporal de etapa (`leads.etapa_desde`, inicializada con `actualizado_en`) e historial de actividad (`lead_actividades`).
- Todas las transiciones del pipeline (contactar, agendar prueba, perder, convertir) actualizan `etapa_desde` y registran un evento "sistema" en el historial, en transacción.
- Retrocesos de etapa permitidos entre etapas abiertas (decisión del cliente para el kanban); Convertido/Perdido siguen finales y convertir sigue exigiendo contacto previo. Tests actualizados.
- Reglas puras nuevas en `src/lib/reglas-crm.ts` (derivación de sedes, días en etapa, lead frío con umbral configurable `umbral_lead_frio_dias`, default 3) con tests.
- La captura del mostrador clasifica el origen de negocio "Mostrador" automáticamente.
- Deuda documental saldada: PLAN.md y CHANGELOG.md registran las fases A–G y el plan del rediseño R1–R5.

**Pendiente:** R2 (kanban + ficha + alerta de frío) tras revisión del cliente.

## 2026-07-04 — Fases A–G: caja, pagos mixtos/parciales, interesados y más (registro retroactivo)

> Estas fases se implementaron, verificaron e2e y desplegaron el 2026-07-04, pero no se habían registrado acá (deuda saldada en R1). Detalle de decisiones en PLAN.md → "Decisiones de implementación tomadas (Fases A–G)".

**Hecho:**
- **A** — Esquema contrato+entregas (`pago_entregas`), caja (`turnos_caja`, `movimientos_caja`), `leads.email`, `pagos.nota`; reglas puras `deuda.ts`, `reglas-caja.ts`, `mensajes.ts`; permiso `interesados` y `puedeCorregirContratos` (migraciones 0006/0007 con backfill).
- **B** — Pagos mixtos (efectivo+transferencia) y parciales: el pago parcial renueva el vencimiento pero deja al alumno deudor con saldo visible; "completar deuda"; la fecha de inicio del contrato (retro-datable) manda sobre el vencimiento; ingresos del dashboard por entregas.
- **C** — Caja por turnos: apertura con efectivo inicial, resumen en vivo derivado, egresos, cierre con nota e historial; widget en Inicio.
- **D** — "Deudores que vienen hoy" en el Inicio de la secretaria, por disciplina, con WhatsApp.
- **E** — Sección Interesados (secretaria+admin): captura de mostrador + WhatsApp con mensaje prellenado configurable; KPI en Inicio; email en CRM y API v1.
- **F** — Correcciones de contratos solo admin: editar vencimiento/fecha con motivo, borrar contrato con sus entregas.
- **G** — Alta encadenada de suscripciones (alumno nuevo → suscribir → "¿otra?").
- Además: deploy inicial completado (migraciones + usuarios admin reales en Neon), favicon con el logo, sedes renombradas a "Sede SQ" y "Sede LS".

## 2026-07-04 — Fase 7: API pública v1

**Hecho:**
- Gestión de API keys en Configuración (solo admin, nueva pantalla `/configuracion/api-keys`): crear con nombre y alcances, ver últimos 4 caracteres, fecha de creación y último uso, revocar. La clave completa (`rlk_live_...`) se muestra una sola vez al crearla; en la base solo se guarda su hash SHA-256 (no bcrypt: una API key es un secreto de alta entropía, no una contraseña, y necesitábamos poder buscarla por igualdad indexada).
- API pública versionada bajo `/api/v1`, autenticación por API key (`Authorization: Bearer ...`) con alcances (`leads:write`, `alumnos:read`, `vencimientos:read`, `cumpleanos:read`). Rechazos: 401 sin key o con key inválida/revocada (mismo mensaje para no filtrar cuál de las dos), 403 sin alcance, 429 si se supera el límite de 60 solicitudes/minuto por key (contador en memoria, documentado en el código).
- Ingesta de leads (`POST /api/v1/leads`): entran como "nuevo" con origen `api` y fuente identificada obligatoria; misma validación que el alta manual del CRM.
- Consultas de lectura cross-sede (con filtro opcional `sedeId`): alumnos con estado derivado (`GET /api/v1/alumnos`), vencimientos por vencer/vencidos con contacto reutilizando la MISMA lógica de `cobros.ts` que usa la secretaria (`GET /api/v1/vencimientos`), y próximos cumpleaños del mes con contacto reutilizando `kpis.ts` (`GET /api/v1/cumpleanos`).
- Documentación completa para integradores en `docs/API_PUBLICA.md` (autenticación, alcances, cada endpoint con ejemplos de request/response y curl).
- Tests nuevos (generación/hash de claves, validación de alcances, límite de solicitudes) — 62 tests en verde. Verificado con curl real contra el servidor local: key de lectura trae cumpleaños con teléfono; esa misma key falla con 403 al intentar crear un lead; sin key y con key inventada fallan con 401; una key de escritura crea un lead verificado en la base como "nuevo" con su fuente; una key revocada vuelve a fallar con 401 (mismo mensaje que una inexistente).

**Pendiente:** nada propio de la fase. Sigue pendiente el deploy inicial (Fase 1, lo hace el humano con el README).

## 2026-07-03 — Fase 6: CRM de leads

**Hecho:**
- Alta y gestión de leads (solo admin, cross-sede): nombre, WhatsApp, sede de interés opcional, nota, origen manual o API con fuente.
- Pipeline con transiciones validadas en servidor y testeadas: nuevo → contactado → prueba agendada → convertido / perdido (motivo obligatorio); embudo con conteos y tasa de conversión a la vista.
- Clase de prueba simple: fecha + horario real de cualquier sede.
- Conversión a alumno con datos precargados y redirección directa al flujo de suscripción; vínculo lead→alumno guardado y visible.
- KPIs de CRM en el dashboard (leads por estado + tasa de conversión), visibles para admin y owner.
- Seed con 4 leads en distintos estados. 52 tests en verde. E2e completo del pipeline verificado en navegador; secretaria y owner bloqueados también por URL.

## 2026-07-03 — Fase 5: Dashboard de KPIs

**Hecho:**
- KPIs del mes con selector Consolidado / por sede: ingresos, gastos, resultado (verde/rojo según signo), alumnos activos con altas y bajas del mes.
- Gráfico de evolución de 6 meses (ingresos/gastos/resultado) en SVG propio sin dependencias, con paleta validada por la skill dataviz, tooltips nativos, leyenda y vista de tabla.
- Ocupación por clase con barras de progreso (verde/ámbar/rojo según cupo) por sede.
- Morosos y por vencer con monto de cuota vigente (misma lógica derivada que usa la secretaria) y cumpleaños del mes con edad y WhatsApp.
- Accesos verificados por navegador: owner solo lectura (sin ningún link operativo), admin con selector, secretaria bloqueada también por URL.
- Números verificados contra la base: ingresos $26.000 / gastos $2.211.500 / 6 activos coinciden con las sumas SQL; el filtro por sede cambia los valores correctamente.
- 45 tests en verde (se suman los de claves de meses de la serie).

**Pendiente:** KPIs del CRM (leads por estado y conversión) se agregan al dashboard en la Fase 6.

## 2026-07-03 — Fase 4: Gastos

**Hecho:**
- Categorías de gasto configurables por el admin (crear / desactivar tocándolas) en Configuración.
- Carga, edición y eliminación de gastos por sede (tipo fijo/variable, categoría, monto, fecha, descripción), solo rol admin — verificado que secretaria y owner quedan bloqueados también por URL.
- Listado con filtros por mes, sede, categoría y tipo, con totales del período (total / fijos / variables).
- Seed con 6 categorías y dos meses de gastos realistas en ambas sedes (alimentan el dashboard de la Fase 5).
- Verificación e2e: carga de gasto nuevo, filtro por sede cambia los totales (2.211.500 → 970.000), permisos.

## 2026-07-03 — Fase 3: Cobros y estado de cuenta

**Hecho:**
- Registro manual de pagos por suscripción: monto sugerido por el precio vigente (editable, queda lo cobrado de verdad), efectivo/transferencia, fecha (pasada permitida, futura no), y aviso de hasta cuándo queda habilitado.
- **Vencimiento rodante** implementado y testeado (16 tests): mismo día del mes siguiente con manejo de fin de mes (31/01→28/02, bisiestos, cruce de año). Decisión 2 confirmada por el cliente: el pago anticipado corre desde el vencimiento vigente (no se pierden días); vencido o primer pago, desde la fecha de pago.
- Estados **siempre derivados** (nunca guardados): al día / por vencer / vencida; "sin pagos" cuenta como vencida. Umbral de "por vencer" configurable por el admin (default 5 días).
- Ficha del alumno con estado de cuota por suscripción, historial de pagos y botón "Registrar pago"; pantalla **Cobros** nueva (vencidas y por vencer con WhatsApp y botón Cobrar); inicio del día con los números reales de la sede.
- Seed con pagos de ejemplo que cubren los cuatro casos (al día, por vencer, vencida, sin pagos). 42 tests en verde. Verificación e2e en navegador: cobro a un moroso → pasa a "Al día" con historial visible; umbral 0 vs 5 días cambia el listado.
- Se crea `PENDIENTES.md` con la lista de tareas del humano (deploy Neon+Vercel, decisiones pendientes, arranque real).

**Pendiente:** el deploy inicial sigue en manos del humano (ver PENDIENTES.md).

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
