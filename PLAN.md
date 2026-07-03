# PLAN.md — Ritmos Latinos OS (Gestor de Alumnos + CRM)

> **Documento maestro del proyecto.** Es la única fuente de verdad junto con el código del repo y `CHANGELOG.md`. Cada fase se ejecuta en una sesión nueva de Claude Code pegando su "Prompt de ejecución". Ninguna sesión debe depender de la memoria de conversaciones anteriores.

---

## Cómo usar este plan (instrucciones para el humano)

1. Ejecutá **una fase por sesión**: abrí una sesión nueva de Claude Code sobre este repo y pegá el "Prompt de ejecución" de la fase que toca.
2. Al terminar la fase, verificá vos mismo los **criterios de aceptación** (están escritos para que los pueda comprobar una persona no técnica).
3. Claude actualiza al final de cada fase la tabla **Estado de fases** (abajo) y `CHANGELOG.md`. Si eso no pasó, pedíselo antes de cerrar la sesión.
4. Las fases están ordenadas por dependencias: no saltees fases. Si una fase quedó a medias, la sesión siguiente debe terminarla antes de empezar la nueva (los prompts ya lo indican).
5. La fase 1 requiere que crees un par de cuentas gratuitas (Vercel ya la tenés; base de datos). Claude te va a guiar paso a paso durante esa sesión.

## Estado de fases

| # | Fase | Estado | Fecha |
|---|------|--------|-------|
| 1 | Fundaciones | 🟡 En curso (código completo y verificado; falta el deploy del humano: cuentas Neon + Vercel, ver README) | 2026-07-03 |
| 2 | Núcleo operativo | ⬜ Pendiente | — |
| 3 | Cobros y estado de cuenta | ⬜ Pendiente | — |
| 4 | Gastos | ⬜ Pendiente | — |
| 5 | Dashboard de KPIs | ⬜ Pendiente | — |
| 6 | CRM de leads | ⬜ Pendiente | — |
| 7 | API pública v1 | ⬜ Pendiente | — |
| 8 | Endurecimiento y publicación | ⬜ Pendiente | — |

Estados posibles: ⬜ Pendiente · 🟡 En curso · ✅ Terminada (con fecha).

---

## 1. Resumen ejecutivo

**Qué se construye.** Un sistema web de gestión para la academia Ritmos Latinos (Tucumán, Argentina): gestor de alumnos, suscripciones y cobros por sede, registro de gastos, dashboard de KPIs para los dueños, CRM de leads para la administradora, y una API pública para que integraciones externas (n8n, agentes de IA, WhatsApp) consuman datos y carguen leads. Reemplaza la gestión actual en papel y cuaderno. La prioridad #1 del cliente es la **visibilidad**: el dashboard de KPIs; todo lo demás existe para alimentarlo con datos reales.

**Dónde vive.** Este repo (`ritmos-latinos-gestor-crm`) está **dedicado exclusivamente al gestor**: la aplicación vive en la raíz y se despliega como proyecto propio en Vercel. La web vidriera de la academia (landing) vive en otro repo (`Ritmos_Latinos`) con su propio deploy y **no forma parte de este sistema**.

**Stack elegido y justificación (costo $0/mes).**

- **Aplicación: Next.js full-stack, desplegada en Vercel (plan Hobby, gratis).** Un solo proyecto contiene la interfaz y toda la API (interna y pública). Vercel Hobby cubre de sobra la escala esperada (100–200 alumnos, 3–5 usuarios internos, tráfico de unas pocas personas por día): sus límites relevantes son de invocaciones y ancho de banda mensuales, órdenes de magnitud por encima de este uso. Restricción a tener presente: el plan Hobby es para uso no comercial según sus términos; si Vercel algún día lo objeta, la app es portable a cualquier hosting Node sin reescritura. Es el mismo proveedor donde ya corre la landing, lo que simplifica la operación para el cliente.
- **Base de datos: Postgres gratuito, recomendación Neon.** Se evaluó Supabase free vs. Neon free. Supabase **pausa los proyectos tras ~1 semana sin actividad** y hay que restaurarlos a mano — inaceptable para un negocio real que puede tener días sin uso. Neon suspende el cómputo por inactividad pero **despierta solo** ante la primera consulta (una demora de un instante en la primera carga del día, aceptable). El free tier de Neon (almacenamiento de ~0,5 GB y horas de cómputo mensuales) sobra para este volumen: 200 alumnos con años de pagos ocupan pocos MB. La decisión final se confirma en la Fase 1 con la información vigente a ese momento (los free tiers cambian); si Neon empeorara sus condiciones, cualquier Postgres gratuito equivalente sirve — el sistema no debe atarse a features propietarias del proveedor.
- **Autenticación: sin costo, resuelta dentro de la app** (usuarios internos con sesión; API pública con API keys). La implementación concreta se elige en la Fase 1 según las mejores prácticas del momento; el requisito es que no agregue costo mensual ni dependencia de un servicio pago.
- **Escala vs. límites.** ~90 alumnos hoy, techo esperado 200; 3–5 usuarios internos; una tercera sede se agrega con un alta en el sistema, sin tocar código. Todo entra holgado en los free tiers. El riesgo real no es capacidad sino los **términos** de los free tiers: mitigación = diseño portable (Postgres estándar, app Next.js estándar).

**Principios de diseño.**

- **API-first**: el panel consume la misma lógica que se expone por API; además hay una API pública versionada con API key para integraciones. El sistema **no envía mensajes** (WhatsApp, email) en la v1: expone datos para que sistemas externos lo hagan.
- **Multi-tenant por sede**: toda entidad operativa pertenece a una sede; la autorización por rol+sede se aplica **en el backend en cada operación**, nunca solo ocultando botones.
- **Zona horaria** America/Argentina/Buenos_Aires en todo cálculo de fechas (vencimientos, "mes actual", cumpleaños). **Moneda** ARS. **Idioma** español (Argentina).
- **Simple y a prueba de usuarios no técnicos**, mobile-first (las secretarias usan el celular). Diseño con identidad propia de academia de baile/pole, construido con la skill `frontend-design` en cada fase con UI — no un admin genérico.
- **Preparado para el futuro sin construirlo hoy**: descuentos (estructura sí, UI compleja no), pasarela de pagos (el modelo de pagos no la impide), automatizaciones de mensajes (los datos y la API pública las habilitan).

---

## 2. Modelo de datos

> Descripción conceptual: entidades, campos y reglas. Los nombres técnicos (tablas, columnas) se deciden al implementar. Toda entidad operativa lleva referencia a su **sede**.

### Entidades

**Sede** — Nombre, datos de contacto, estado (activa/inactiva). Una tercera sede se crea desde la configuración, sin tocar código.

**Usuario interno** — Nombre, email, credencial de acceso, rol (`secretaria` / `admin` / `owner`) y, solo para secretarias, la sede asignada. Admin y owner alcanzan todas las sedes (admin con selector de sede; owner solo lectura de KPIs).

**Disciplina** — Actividad que se dicta en una sede (ej.: Pole, Telas, Salsa, Folclore). Agrupa horarios y da sentido a los planes con frecuencia. (Ver decisión abierta 1: los horarios cuelgan de la disciplina, no del plan.)

**Plan** — Por sede. Nombre, tipo (disciplina individual / pack de disciplinas / frecuencia semanal sobre una disciplina, ej. "Pole 2x por semana"), disciplina(s) asociada(s), frecuencia semanal cuando aplica, estado (activo/inactivo — un plan que ya no se vende se desactiva, nunca se borra, porque tiene historia).

**Precio de plan (historial)** — Cada actualización de precio crea un registro nuevo con monto y fecha de vigencia. El precio vigente es el del registro más reciente. Nunca se pisa un precio histórico: con la inflación argentina los precios cambian seguido y el historial es un requisito.

**Horario** — Clase semanal fija de una disciplina en una sede: día de la semana + hora, y **cupo opcional** (máximo de inscriptos; si no se define, sin límite). Los horarios se repiten idénticos semana a semana.

**Alumno** — Ficha mínima definitiva: DNI, nombre, apellido, email, fecha de nacimiento, teléfono/WhatsApp, sede. La fecha de nacimiento habilita el KPI y la futura automatización de cumpleaños. Un alumno "activo" es el que tiene al menos una suscripción activa (estado derivado, no un campo que alguien tenga que acordarse de tocar).

**Suscripción** — Vincula alumno + plan + **horarios elegidos** + fecha de alta. Si el plan tiene frecuencia N, el alumno elige exactamente N horarios fijos de la disciplina (respetando cupos); si el plan tiene horario único implícito, no hay elección. Estados: **activa**, **vencida** (derivado del estado de pago, ver reglas), **dada de baja** (acción explícita, con fecha y motivo opcional). Un alumno puede tener varias suscripciones a la vez. Incluye desde el día uno un **campo de descuento** (estructura preparada; sin UI compleja en la v1).

**Pago** — Registro manual de la secretaria sobre una suscripción: monto real cobrado, medio (efectivo / transferencia), fecha de pago, y el período que habilita (ver regla de vencimiento rodante). Guarda el monto real aunque el precio del plan cambie después. El diseño no debe impedir agregar una pasarela online más adelante (un pago con otro origen/medio).

**Gasto** — Por sede: tipo (fijo / variable), categoría (lista configurable por el admin), monto, fecha, descripción. Carga manual, solo admin.

**Lead (CRM)** — Cross-sede (con sede de interés opcional): nombre, teléfono/WhatsApp, cómo llegó (origen: carga manual o API externa, con identificación de la fuente), estado del pipeline (**nuevo → contactado → clase de prueba agendada → convertido / perdido**), datos de la clase de prueba si se agendó (fecha y horario), motivo de pérdida cuando se pierde, y vínculo al alumno creado cuando se convierte.

**Clase de prueba** — Concepto configurable y simple: al agendarla, el lead queda asociado a una fecha y un horario existente. Sin sobre-ingeniería (no hay asistencia, ni cupos propios, ni estados adicionales en v1).

**API key externa** — Para la API pública: nombre descriptivo (quién la usa), clave secreta, alcances permitidos (qué puede leer/escribir), estado (activa/revocada), fecha de creación y último uso.

### Reglas de negocio clave (en prosa)

**Vencimiento rodante (regla central del sistema).** Cada pago habilita **30/31 días desde la fecha de pago** — en la práctica, hasta el mismo número de día del mes siguiente (con manejo razonable de fin de mes: un pago del 31 de enero vence el 28/29 de febrero). No es mes calendario. A partir de la fecha de vencimiento vigente el sistema **deriva automáticamente** el estado de cuota de cada suscripción: **al día** (vencimiento a más de 5 días), **por vencer** (faltan 5 días o menos), **vencido / moroso** (fecha de vencimiento pasada). El umbral de "por vencer" (5 días) debe ser configurable sin tocar código. Todos los cálculos de fecha usan la zona horaria de Argentina. *Sobre pagos anticipados ver decisión abierta 2.*

**Estados de suscripción.** "Activa" y "vencida" son derivados del estado de pago: una suscripción sin pago vigente está vencida; con pago vigente, activa. "Dada de baja" es siempre una **acción explícita** de un usuario (con fecha), nunca automática: que un alumno deba plata no significa que se fue. Los KPIs de altas y bajas del mes cuentan suscripciones creadas y dadas de baja explícitamente en el mes; los morosos son un listado aparte.

**Ocupación (sin asistencia).** No se toma asistencia. El KPI de ocupación de cada horario = cantidad de suscripciones activas que eligieron ese horario, comparada contra el cupo si está definido. Al inscribir a un alumno en un horario con cupo lleno, el sistema lo impide (o exige una confirmación explícita del admin — a definir en la fase 2 con el criterio más simple).

**Precios e inflación.** El admin actualiza el precio del plan cuando quiere; queda historial. Cada pago guarda el monto real. El monto sugerido al registrar un pago es el precio vigente del plan en ese momento (ver decisión abierta 3), pero la secretaria puede ajustarlo si el caso lo requiere (queda registrado tal cual se cobró).

**Permisos por rol y sede (se aplican en backend, en cada operación).**

| Capacidad | Secretaria | Admin | Owner |
|---|---|---|---|
| Alumnos, suscripciones, pagos, horarios (ver/gestionar) | ✅ solo su sede | ✅ todas las sedes | ❌ |
| Estado de cuota, morosos y por vencer (operativo) | ✅ solo su sede | ✅ todas | ❌ |
| Gastos | ❌ | ✅ | ❌ |
| Dashboard de KPIs de negocio | ❌ | ✅ | ✅ solo lectura |
| CRM de leads | ❌ | ✅ (cross-sede) | ❌ |
| Configuración (sedes, disciplinas, planes, precios, horarios, usuarios, categorías, API keys) | ❌ | ✅ | ❌ |

Cualquier consulta o acción fuera del alcance del usuario autenticado se rechaza en el servidor aunque la UI nunca la ofrezca (probar manipulando URLs y llamadas directas es parte de los criterios de aceptación).

---

## 3. Diseño de la API

> Nivel conceptual. Rutas exactas, formatos y convenciones se deciden al implementar cada fase, siguiendo las mejores prácticas del momento.

**API interna (la que consume el panel).** Autenticación por sesión de usuario interno. Expone toda la lógica del sistema como recursos: sedes, usuarios, disciplinas, planes y su historial de precios, horarios, alumnos, suscripciones, pagos, gastos, datos del dashboard, leads y configuración. Reglas transversales: validación server-side de toda entrada, autorización rol+sede en cada operación (nunca confiar en el cliente), errores claros y consistentes, y filtrado por sede implícito según el usuario autenticado.

**API pública versionada (`v1`).** Para integraciones externas futuras (n8n, agentes de IA, WhatsApp, Meta Ads, formularios). Autenticación por **API key** en encabezado, con alcances por key y posibilidad de revocarla. Versionada desde el día uno para no romper integraciones cuando evolucione. Superficie de la v1:

- **Ingesta de leads** (escritura): un sistema externo crea leads con su origen identificado; entran al pipeline como "nuevo".
- **Consulta de alumnos** (lectura): datos básicos y estado, para campañas.
- **Consulta de vencimientos** (lectura): cuotas por vencer y vencidas con datos de contacto, para recordatorios y recuperación por WhatsApp externos.
- **Consulta de cumpleaños** (lectura): próximos cumpleaños con datos de contacto, para saludos automatizados externos.

**Sin webhooks salientes en la v1**: los endpoints de consulta alcanzan (los sistemas externos pueden consultar periódicamente) y evitan la complejidad de entregas, reintentos y firmas. Se reevalúa si una integración concreta lo exige.

**El sistema no envía mensajes en la v1.** Ni WhatsApp, ni email, ni notificaciones: expone los datos para que otro sistema lo haga.

---

## 4. Mapa de pantallas por rol

**Todos** — Inicio de sesión. Interfaz completa en español (Argentina), usable desde el celular.

**Secretaria (solo su sede):**
- **Inicio del día**: resumen operativo de su sede — cuotas por vencer y vencidas con el WhatsApp a mano, accesos rápidos (registrar pago, nuevo alumno).
- **Alumnos**: listado con búsqueda (nombre/DNI); alta y edición de la ficha.
- **Ficha del alumno**: datos personales, suscripciones con su estado de cuota bien visible, historial de pagos, acciones (nueva suscripción, registrar pago, dar de baja una suscripción).
- **Nueva suscripción**: elegir plan y, si corresponde, los horarios (viendo cupos disponibles).
- **Registrar pago**: monto sugerido por el precio vigente, medio de pago, fecha; confirmación clara de hasta cuándo queda habilitado.
- **Horarios**: grilla semanal de su sede con inscriptos por clase (y cupo si aplica).

**Admin (todas las sedes, con selector de sede persistente):**
- Todo lo de secretaria, en cualquier sede.
- **Dashboard de KPIs**: por sede y consolidado (detalle en §5, Fase 5).
- **Gastos**: listado con filtros (mes, sede, categoría, tipo) y carga/edición.
- **CRM**: pipeline de leads (vista por estados), ficha del lead, acciones de avance (contactar, agendar prueba, convertir en alumno, marcar perdido con motivo), KPIs de leads.
- **Configuración**: sedes, disciplinas, planes y precios (con historial visible), horarios y cupos, usuarios y roles, categorías de gasto, umbral de "por vencer", API keys.

**Owner (solo lectura):**
- **Dashboard de KPIs** de todas las sedes y consolidado. Nada más: sin edición, sin datos operativos de alumnos individuales más allá de los listados que el dashboard incluye (morosos, cumpleaños).

---

## 5. Plan por fases

> Formato de cada fase: objetivo y valor · tareas (el **qué**, nunca el cómo) · fuera de alcance · criterios de aceptación verificables por un no técnico · dependencias · prompt de ejecución listo para pegar.
>
> Regla transversal: **ninguna tarea prescribe librerías, estructura de carpetas, algoritmos ni código**. Eso se decide al ejecutar cada tarea, investigando la mejor práctica disponible en ese momento y lo que ya existe en el repo.

---

### Fase 1 — Fundaciones

**Objetivo y valor.** Al terminar existe el sistema desplegado en una URL propia, con login, los tres roles funcionando, las dos sedes cargadas y la seguridad por rol+sede aplicada en el backend. Es el terreno sobre el que se construye todo lo demás; el usuario ya puede entrar con cada rol y ver su navegación (aunque las secciones estén vacías).

**Tareas.**
1. **Crear la aplicación del gestor en la raíz de este repo**: una app Next.js full-stack con su configuración lista para desplegarse en Vercel como proyecto propio.
2. **Poner en marcha la base de datos Postgres gratuita** (recomendación: Neon; confirmar con la información vigente) con **migraciones versionadas** desde la primera tabla: el esquema evoluciona solo por migraciones, nunca a mano.
3. **Autenticación de usuarios internos**: inicio y cierre de sesión seguros, sin costo mensual, con sesiones que funcionan bien en celular.
4. **Roles y sedes con autorización en backend**: modelar sedes y usuarios (rol + sede para secretarias), y establecer el mecanismo transversal por el cual **toda** operación del servidor valida rol y sede del usuario autenticado — el patrón que las fases siguientes van a reutilizar en cada recurso nuevo.
5. **Esqueleto de navegación por rol**: estructura visual base (en español, mobile-first, con identidad propia — ver instrucción de diseño en el prompt) donde cada rol ve solo sus secciones; el admin tiene selector de sede persistente.
6. **Datos semilla iniciales**: las 2 sedes reales y un usuario de prueba por rol (secretaria de cada sede, admin, owner).
7. **Guiar al humano en el alta de infraestructura**: creación de las cuentas/proyectos gratuitos necesarios (base de datos y proyecto Vercel del gestor) y configuración de variables de entorno, paso a paso, verificando que el deploy quede funcionando.
8. **Documentar el arranque** en el README del repo: cómo correrlo localmente, cómo se despliega, qué variables necesita, y cómo crear usuarios.

**Fuera de alcance.** Alumnos, planes, horarios, pagos, gastos, KPIs, CRM, API pública. Recuperación de contraseña con email (puede resolverse manualmente por el admin en v1).

**Criterios de aceptación.**
- Entrás a la URL desplegada desde el celular y ves la pantalla de login en español, con estética propia (no un template genérico).
- Entrás con el usuario secretaria de la sede A: ves solo la navegación operativa y solo su sede; no existe forma de elegir otra sede.
- Entrás como admin: ves todas las secciones y podés cambiar de sede con un selector.
- Entrás como owner: solo ves la sección de dashboard (vacía por ahora).
- Manipulando la URL o llamando a la API directamente con la sesión de la secretaria de sede A, no se puede leer ni tocar nada de la sede B (lo verifica Claude y lo demuestra en la sesión).

**Dependencias.** Ninguna (fase inicial). Requiere participación del humano para altas de cuentas y variables de entorno.

**Prompt de ejecución.**

```text
Actuá como desarrollador senior full-stack. Trabajás en el repo ritmos-latinos-gestor-crm, dedicado exclusivamente al gestor de la academia (la landing pública vive en otro repo y no forma parte de este sistema).

Antes de arrancar: leé PLAN.md completo (contexto de negocio, modelo de datos, permisos, y la Fase 1) y CHANGELOG.md, y revisá el estado real del repo — el repo es la única fuente de verdad, no asumas nada de sesiones anteriores. Si hay trabajo a medio hacer de esta fase, terminalo antes de agregar cosas nuevas.

Ejecutá la Fase 1 (Fundaciones). Tareas, descritas por su objetivo — investigá al momento de ejecutar cada una la mejor forma de resolverla (mejores prácticas actuales, qué existe ya en el repo, alternativas razonables); no sigas una receta fija:

1. Crear la aplicación del gestor en la raíz del repo (Next.js full-stack), lista para desplegarse en Vercel como proyecto propio.
2. Poner en marcha una base Postgres gratuita (PLAN.md recomienda Neon; confirmá que siga siendo la mejor opción gratuita sin pausas manuales) con migraciones versionadas desde el primer día.
3. Autenticación de usuarios internos sin costo mensual, con sesiones seguras y cómodas en celular.
4. Modelar sedes y usuarios (roles secretaria/admin/owner; secretaria atada a una sede) y establecer el mecanismo transversal de autorización rol+sede en el backend que TODA operación futura va a reutilizar. La seguridad se aplica en el servidor, nunca solo ocultando botones.
5. Esqueleto de navegación por rol: secretaria ve solo lo operativo de su sede; admin ve todo con selector de sede persistente; owner solo la sección de dashboard. Todo en español (Argentina), mobile-first.
6. Datos semilla: las 2 sedes reales y un usuario de prueba por rol.
7. Guiar al humano (que supervisa esta sesión, tiene conocimientos básicos, no programa) en el alta de las cuentas gratuitas y variables de entorno necesarias, hasta dejar el deploy del gestor funcionando en una URL propia.
8. README: cómo correr local, desplegar, variables, alta de usuarios.

Para toda tarea con UI: antes de construir pantallas, cargá y aplicá la skill frontend-design y cualquier otra skill de diseño/UX-UI disponible en el entorno. El diseño debe tener identidad visual propia acorde a una academia de baile y pole (no un admin genérico), ser usable desde el celular por personas no técnicas y estar en español (Argentina). Zona horaria America/Argentina/Buenos_Aires y moneda ARS en todo el sistema.

Al terminar: verificá los criterios de aceptación de la Fase 1 tal como están en PLAN.md (incluida la prueba de que una secretaria no puede acceder a otra sede ni por URL ni por API), agregá algún test sobre la lógica de autorización, actualizá PLAN.md (tabla "Estado de fases" y toda decisión tomada) y CHANGELOG.md, y dejá todo commiteado y pusheado.
```

---

### Fase 2 — Núcleo operativo

**Objetivo y valor.** Al terminar, la secretaria puede hacer su trabajo diario de altas: gestionar alumnos, planes con precios (con historial), horarios con cupo, y suscripciones con elección de horarios. La academia puede empezar a cargar su realidad en el sistema.

**Tareas.**
1. **Disciplinas y horarios**: el admin configura disciplinas por sede y sus horarios semanales fijos (día + hora, cupo opcional). Grilla semanal visible para secretaria y admin con inscriptos por horario.
2. **Planes con historial de precios**: el admin crea planes por sede (tipos: disciplina individual, pack, frecuencia semanal), les fija precio y lo actualiza cuando quiera; cada cambio queda en el historial visible. Los planes se desactivan, no se borran.
3. **Alumnos**: alta, edición y búsqueda (nombre/DNI) de la ficha mínima definitiva (DNI, nombre, apellido, email, fecha de nacimiento, teléfono/WhatsApp, sede), con validaciones server-side.
4. **Suscripciones**: crear la suscripción alumno + plan + horarios elegidos (exactamente los que la frecuencia del plan permite, respetando cupos) con el precio vigente asociado; ver las suscripciones en la ficha del alumno; dar de baja con fecha. Estructura de descuento presente en el modelo (sin UI compleja).
5. **Datos semilla realistas**: disciplinas, horarios y planes parecidos a los reales de las dos sedes, y un puñado de alumnos ficticios con suscripciones, para probar todo el flujo.

**Fuera de alcance.** Pagos y estados de cuota (fase 3) — en esta fase las suscripciones solo tienen estados activa/dada de baja. Gastos, KPIs, CRM, API pública.

**Criterios de aceptación.**
- Como admin creás una disciplina con tres horarios semanales (uno con cupo 8) y un plan "2 veces por semana" con precio; todo queda visible en la configuración.
- Como secretaria de la sede A das de alta un alumno y le creás una suscripción a ese plan eligiendo exactamente 2 horarios; el sistema no te deja elegir ni 1 ni 3, y no te deja inscribir en un horario que llegó a su cupo.
- Cambiás el precio del plan como admin y ves el historial con el precio viejo y el nuevo con sus fechas.
- La grilla de horarios muestra cuántos inscriptos tiene cada clase (ej. "5/8").
- Como secretaria de la sede A no ves ni podés tocar alumnos, planes ni horarios de la sede B (tampoco por URL o API directa).
- Todo se puede operar cómodamente desde un celular.

**Dependencias.** Fase 1.

**Prompt de ejecución.**

```text
Actuá como desarrollador senior full-stack. Trabajás en el repo ritmos-latinos-gestor-crm, dedicado exclusivamente al gestor de la academia.

Antes de arrancar: leé PLAN.md completo (en especial Modelo de datos, permisos, Mapa de pantallas y la Fase 2) y CHANGELOG.md, y revisá el estado real del código en el repo — es la única fuente de verdad. Si la fase anterior dejó algo a medias que bloquea esta fase, resolvelo primero. Reutilizá los mecanismos ya establecidos (autorización rol+sede, migraciones, patrones de UI) en lugar de inventar nuevos.

Ejecutá la Fase 2 (Núcleo operativo). Tareas, descritas por su objetivo — investigá al ejecutar cada una la mejor forma de resolverla; no sigas una receta fija:

1. Disciplinas por sede y sus horarios semanales fijos (día + hora, cupo opcional), configurables por el admin; grilla semanal con inscriptos por horario visible para secretaria y admin.
2. Planes por sede (tipos: disciplina individual, pack de disciplinas, frecuencia semanal sobre una disciplina) con precio actualizable e historial de precios visible; los planes se desactivan, no se borran.
3. Alta, edición y búsqueda de alumnos con la ficha mínima definida en PLAN.md, validada en el servidor.
4. Suscripciones: alumno + plan + elección de exactamente tantos horarios como la frecuencia permita (respetando cupos), con el precio vigente asociado; visibles en la ficha del alumno; baja explícita con fecha. El modelo incluye la estructura de descuento (sin UI compleja).
5. Datos semilla realistas de las dos sedes (disciplinas, horarios, planes, alumnos ficticios con suscripciones).

Reglas de negocio que NO se reinterpretan (detalle en PLAN.md): no se toma asistencia (la ocupación sale de inscriptos por horario); la autorización rol+sede se aplica en el backend en cada operación nueva de esta fase.

Para toda tarea con UI: antes de construir pantallas, cargá y aplicá la skill frontend-design y cualquier otra skill de diseño/UX-UI disponible. Identidad visual de academia de baile/pole, mobile-first, español (Argentina), usable por personas no técnicas.

Al terminar: verificá los criterios de aceptación de la Fase 2 de PLAN.md, agregá tests de la lógica crítica nueva (elección de horarios según frecuencia, cupos, permisos por sede), actualizá PLAN.md (estado de fases y decisiones tomadas) y CHANGELOG.md, y dejá todo commiteado y pusheado.
```

---

### Fase 3 — Cobros y estado de cuenta

**Objetivo y valor.** Al terminar, la secretaria registra pagos y el sistema responde solo la pregunta más importante del mostrador: **quién está al día, quién está por vencer y quién debe**. Es la base de los KPIs de ingresos y morosidad.

**Tareas.**
1. **Registro de pagos**: la secretaria registra un pago sobre una suscripción (monto sugerido por el precio vigente, editable; medio efectivo/transferencia; fecha), con confirmación clara de hasta cuándo queda habilitado el alumno.
2. **Vencimiento rodante**: cada pago habilita 30/31 días desde la fecha de pago (hasta el mismo día del mes siguiente, con manejo de fin de mes), en zona horaria argentina. Aplicar la resolución de la decisión abierta 2 (pagos anticipados) tal como quede registrada en PLAN.md.
3. **Estados derivados de cuota y suscripción**: al día / por vencer (umbral configurable, 5 días por defecto) / vencido, calculados siempre a partir de los datos (nunca un estado que alguien tenga que actualizar a mano); la suscripción pasa a "vencida" o vuelve a "activa" según su pago vigente.
4. **Estado de cuenta en la ficha del alumno**: estado de cuota bien visible por suscripción e historial de pagos completo.
5. **Listados operativos por sede**: morosos y por vencer, con el teléfono/WhatsApp a mano, accesibles desde el inicio del día de la secretaria.
6. **Tests de la lógica crítica**: vencimiento rodante (incluidos los casos de fin de mes), derivación de estados y permisos. Es el corazón del negocio: acá los tests no son opcionales.

**Fuera de alcance.** Pasarela de pago online (el diseño no debe impedirla). Envío de recordatorios (lo harán sistemas externos vía API pública, fase 7). Gastos, KPIs, CRM.

**Criterios de aceptación.**
- Registrás un pago de un alumno y el sistema te dice hasta qué fecha queda habilitado; la ficha pasa a "al día".
- Un alumno con pago del 31 de enero vence el 28/29 de febrero (no el 3 de marzo).
- Un alumno cuyo vencimiento es en 4 días figura "por vencer"; uno con la fecha pasada figura "vencido" y aparece en el listado de morosos de su sede, con su WhatsApp visible.
- El monto sugerido al registrar el pago es el precio vigente del plan, pero podés cobrarle otro importe y queda registrado el monto real.
- Cambiás el precio del plan y el próximo pago sugiere el precio nuevo; los pagos viejos no cambian.
- La secretaria de la sede A no ve pagos ni morosos de la sede B.

**Dependencias.** Fases 1 y 2.

**Prompt de ejecución.**

```text
Actuá como desarrollador senior full-stack. Trabajás en el repo ritmos-latinos-gestor-crm, dedicado exclusivamente al gestor de la academia.

Antes de arrancar: leé PLAN.md completo (en especial la regla de vencimiento rodante en "Modelo de datos", la decisión abierta 2 y su resolución, y la Fase 3) y CHANGELOG.md, y revisá el estado real del código — única fuente de verdad. Terminá primero cualquier pendiente bloqueante de fases anteriores. Reutilizá los mecanismos existentes (autorización, migraciones, patrones de UI).

Ejecutá la Fase 3 (Cobros y estado de cuenta). Tareas por objetivo — investigá al ejecutar cada una la mejor forma de resolverla; no sigas una receta fija:

1. Registro manual de pagos sobre una suscripción: monto sugerido por el precio vigente (editable, se guarda el monto real cobrado), medio efectivo/transferencia, fecha; confirmación clara de hasta cuándo queda habilitado el alumno.
2. Vencimiento rodante: cada pago habilita 30/31 días desde la fecha de pago (hasta el mismo día del mes siguiente, con manejo correcto de fin de mes), todo en zona horaria America/Argentina/Buenos_Aires. Aplicá lo que PLAN.md registre como resolución de la decisión abierta 2 (pagos anticipados).
3. Estados SIEMPRE derivados de los datos, nunca mantenidos a mano: cuota al día / por vencer (umbral configurable, 5 días por defecto) / vencida, y suscripción activa/vencida en consecuencia.
4. Estado de cuenta visible en la ficha del alumno: estado de cuota por suscripción e historial de pagos.
5. Listados operativos por sede de morosos y por vencer, con teléfono/WhatsApp a mano, integrados al inicio del día de la secretaria.
6. Tests de la lógica crítica: vencimiento rodante (casos de fin de mes incluidos), derivación de estados, permisos por rol+sede. En esta fase los tests no son opcionales.

El diseño no debe impedir agregar una pasarela de pago online en el futuro (pagos con otro origen), pero NO la construyas.

Para toda tarea con UI: antes de construir pantallas, cargá y aplicá la skill frontend-design y cualquier otra skill de diseño/UX-UI disponible. Mobile-first (la secretaria registra pagos desde el celular en el mostrador), español (Argentina), estados de cuota legibles de un vistazo.

Al terminar: verificá los criterios de aceptación de la Fase 3 de PLAN.md, actualizá PLAN.md (estado de fases y decisiones tomadas) y CHANGELOG.md, y dejá todo commiteado y pusheado.
```

---

### Fase 4 — Gastos

**Objetivo y valor.** Al terminar, el admin registra los gastos de cada sede (fijos y variables, con categoría). Con ingresos (fase 3) y gastos cargados, el dashboard de la fase 5 puede mostrar el resultado real del negocio.

**Tareas.**
1. **Categorías de gasto configurables**: el admin gestiona la lista de categorías (ej.: alquiler, sueldos, limpieza, publicidad).
2. **Carga y edición de gastos**: por sede, con tipo (fijo/variable), categoría, monto, fecha y descripción. Solo admin.
3. **Listado con filtros**: por mes, sede, categoría y tipo, con totales del período filtrado.

**Fuera de alcance.** KPIs y gráficos de gastos (fase 5). Gastos recurrentes automáticos (el admin carga el alquiler cada mes a mano en v1). Acceso de secretarias u owner a gastos.

**Criterios de aceptación.**
- Como admin creás la categoría "Alquiler", cargás un gasto fijo del mes en la sede A y lo ves en el listado con el total del mes.
- Filtrás por mes y sede y los totales cambian en consecuencia.
- Entrás como secretaria u owner: la sección de gastos no existe para vos, y tampoco podés acceder por URL o API directa.

**Dependencias.** Fase 1 (roles/sedes). Independiente de las fases 2 y 3 en lo funcional, pero se ejecuta después para mantener el orden de una fase por sesión.

**Prompt de ejecución.**

```text
Actuá como desarrollador senior full-stack. Trabajás en el repo ritmos-latinos-gestor-crm, dedicado exclusivamente al gestor de la academia.

Antes de arrancar: leé PLAN.md completo (en especial Modelo de datos, permisos y la Fase 4) y CHANGELOG.md, y revisá el estado real del código — única fuente de verdad. Terminá primero cualquier pendiente bloqueante de fases anteriores. Reutilizá los mecanismos existentes.

Ejecutá la Fase 4 (Gastos). Tareas por objetivo — investigá al ejecutar cada una la mejor forma de resolverla; no sigas una receta fija:

1. Categorías de gasto configurables por el admin.
2. Carga y edición de gastos por sede: tipo fijo/variable, categoría, monto, fecha, descripción. Solo el rol admin puede ver y tocar gastos — aplicado en el backend, no solo en la UI.
3. Listado de gastos con filtros por mes, sede, categoría y tipo, con totales del período filtrado.

Sumá datos semilla de gastos realistas de un par de meses para las dos sedes (alimentan el dashboard de la fase siguiente).

Para toda tarea con UI: antes de construir pantallas, cargá y aplicá la skill frontend-design y cualquier otra skill de diseño/UX-UI disponible. Coherencia visual con el resto del gestor, mobile-first, español (Argentina).

Al terminar: verificá los criterios de aceptación de la Fase 4 de PLAN.md (incluido que secretaria y owner no acceden a gastos ni por URL ni por API), actualizá PLAN.md (estado de fases) y CHANGELOG.md, y dejá todo commiteado y pusheado.
```

---

### Fase 5 — Dashboard de KPIs

**Objetivo y valor.** **La prioridad #1 del cliente.** Al terminar, admin y owners ven de un vistazo cómo va el negocio: cuánto entra, cuánto sale, cuánto queda, cuántos alumnos hay, qué clases se llenan y quién debe. Por sede y consolidado.

**Tareas.**
1. **KPIs financieros**: ingresos del mes (suma de pagos) y su evolución mensual, gastos del mes y evolución, resultado (ingresos − gastos) del mes y evolución.
2. **KPIs de alumnos**: alumnos activos, altas del mes, bajas del mes (según las definiciones de PLAN.md: activo = suscripción activa; baja = baja explícita).
3. **Ocupación por clase/horario**: inscriptos por horario contra cupo cuando aplica, presentada de forma que se detecten de un vistazo las clases llenas y las vacías.
4. **Listados de gestión**: morosos y por vencer (con monto adeudado estimado por el precio vigente) y cumpleaños del mes, con datos de contacto.
5. **Vista por sede y consolidado según rol**: admin y owner eligen ver una sede o el total; owner accede solo en modo lectura; la secretaria no ve nada de esto.
6. **Evolución temporal**: los KPIs financieros y de alumnos muestran su serie de los últimos meses para ver tendencias (clave en contexto de inflación: ¿los ingresos crecen o solo los precios?).

**Fuera de alcance.** KPIs del CRM (se agregan en la fase 6). Exportaciones a Excel/PDF. Comparaciones ajustadas por inflación (se muestran valores nominales).

**Criterios de aceptación.**
- Entrás como owner desde el celular y en una sola pantalla entendés: ingresos, gastos y resultado del mes (por sede y total), evolución de los últimos meses, alumnos activos, altas y bajas del mes.
- Ves la ocupación de cada horario (ej. "Pole lunes 19h: 7/8") y distinguís al toque las clases llenas de las vacías.
- Ves la lista de morosos y por vencer con sus teléfonos, y los cumpleaños del mes.
- Como owner no podés modificar nada en todo el sistema (tampoco por URL o API directa).
- Como admin ves lo mismo y podés alternar entre sedes y consolidado.
- Como secretaria no existe el dashboard de negocio para vos (ni por URL ni por API); tu inicio operativo sigue igual.
- Los números coinciden con los datos cargados (verificable con los datos semilla: los totales del dashboard se corresponden con los pagos y gastos registrados).

**Dependencias.** Fases 1, 2, 3 y 4 (necesita alumnos, suscripciones, pagos y gastos cargados).

**Prompt de ejecución.**

```text
Actuá como desarrollador senior full-stack. Trabajás en el repo ritmos-latinos-gestor-crm, dedicado exclusivamente al gestor de la academia.

Antes de arrancar: leé PLAN.md completo (en especial las definiciones de KPIs, las reglas de estados derivados y la Fase 5) y CHANGELOG.md, y revisá el estado real del código — única fuente de verdad. Terminá primero cualquier pendiente bloqueante de fases anteriores. Reutilizá la lógica de estados y permisos ya existente: los KPIs se calculan con las MISMAS reglas que usa la operatoria (un moroso del dashboard es exactamente el mismo moroso del listado de la secretaria).

Ejecutá la Fase 5 (Dashboard de KPIs) — la prioridad #1 del cliente. Tareas por objetivo — investigá al ejecutar cada una la mejor forma de resolverla; no sigas una receta fija:

1. KPIs financieros por sede y consolidado: ingresos del mes y evolución mensual, gastos del mes y evolución, resultado (ingresos − gastos) y evolución.
2. KPIs de alumnos: activos, altas del mes, bajas del mes (definiciones exactas en PLAN.md).
3. Ocupación por clase/horario (inscriptos vs. cupo cuando aplica), presentada para detectar de un vistazo clases llenas y vacías.
4. Listados de gestión: morosos y por vencer (con monto adeudado estimado por precio vigente) y cumpleaños del mes, con datos de contacto.
5. Acceso según rol, aplicado en backend: admin (todas las sedes + consolidado), owner (ídem, SOLO lectura en todo el sistema), secretaria (sin acceso a nada de esto).
6. Series de evolución de los últimos meses en los KPIs financieros y de alumnos.

Los cálculos usan el mes calendario en zona horaria America/Argentina/Buenos_Aires y moneda ARS con formato argentino.

Para toda tarea con UI: antes de construir pantallas, cargá y aplicá la skill frontend-design, la skill dataviz para todos los gráficos, y cualquier otra skill de diseño/UX-UI disponible. El dashboard es la cara del sistema ante los dueños: debe leerse perfecto desde el celular, con identidad propia, en español (Argentina).

Al terminar: verificá los criterios de aceptación de la Fase 5 de PLAN.md (incluida la coincidencia de los números con los datos semilla y las restricciones por rol vía URL/API), agregá tests de los cálculos de KPIs sobre datos conocidos, actualizá PLAN.md (estado de fases) y CHANGELOG.md, y dejá todo commiteado y pusheado.
```

---

### Fase 6 — CRM de leads

**Objetivo y valor.** Al terminar, la administradora gestiona interesados en un pipeline simple, agenda clases de prueba, convierte leads en alumnos sin recargar datos, y mide la conversión. El modelo queda listo para recibir leads por API (fase 7).

**Tareas.**
1. **Alta y gestión de leads** (solo admin, cross-sede): nombre, teléfono/WhatsApp, sede de interés opcional, origen (manual en esta fase; el modelo ya contempla orígenes por API con identificación de la fuente).
2. **Pipeline**: nuevo → contactado → clase de prueba agendada → convertido / perdido (con motivo), con una vista que muestre el embudo de un vistazo y permita avanzar leads con el mínimo de toques.
3. **Clase de prueba**: agendar al lead en una fecha y un horario existentes, sin sobre-ingeniería (sin asistencia ni cupos propios).
4. **Conversión a alumno**: al convertir, se crea el alumno con los datos del lead precargados (se completan los faltantes de la ficha) y el lead queda vinculado; el flujo natural sigue en crear la suscripción.
5. **KPIs del CRM en el dashboard**: leads por estado y tasa de conversión, visibles para admin (y owner en lectura, como el resto del dashboard).

**Fuera de alcance.** Ingesta de leads por API (fase 7). Envío de mensajes a leads. Automatizaciones de seguimiento. Acceso de secretarias al CRM.

**Criterios de aceptación.**
- Como admin cargás un lead, lo pasás a "contactado", le agendás una clase de prueba en un horario real, y luego lo convertís: el alumno queda creado con los datos precargados y el lead figura "convertido".
- Marcás otro lead como "perdido" y el sistema te pide el motivo.
- Ves el pipeline completo de un vistazo (cuántos hay en cada estado) y la tasa de conversión en el dashboard.
- Como secretaria u owner no podés ver ni tocar el CRM (owner solo ve los KPIs de leads en el dashboard, en lectura). Tampoco por URL o API directa.

**Dependencias.** Fases 1, 2 (para convertir en alumno y agendar en horarios) y 5 (dashboard donde viven los KPIs del CRM).

**Prompt de ejecución.**

```text
Actuá como desarrollador senior full-stack. Trabajás en el repo ritmos-latinos-gestor-crm, dedicado exclusivamente al gestor de la academia.

Antes de arrancar: leé PLAN.md completo (en especial la entidad Lead, permisos y la Fase 6) y CHANGELOG.md, y revisá el estado real del código — única fuente de verdad. Terminá primero cualquier pendiente bloqueante de fases anteriores. Reutilizá los mecanismos existentes.

Ejecutá la Fase 6 (CRM de leads). Tareas por objetivo — investigá al ejecutar cada una la mejor forma de resolverla; no sigas una receta fija:

1. Alta y gestión de leads, solo rol admin, cross-sede: nombre, teléfono/WhatsApp, sede de interés opcional, origen. El modelo debe contemplar desde ya orígenes por API con identificación de la fuente (la ingesta llega en la fase 7), además de la carga manual de esta fase.
2. Pipeline nuevo → contactado → clase de prueba agendada → convertido / perdido (con motivo obligatorio al perder), con una vista de embudo clara y avance de estado con el mínimo de toques.
3. Clase de prueba simple: fecha + horario existente. Sin asistencia, sin cupos propios, sin estados extra.
4. Conversión a alumno: crea el alumno con los datos del lead precargados y deja el vínculo lead→alumno; el flujo continúa naturalmente hacia crear la suscripción.
5. KPIs del CRM en el dashboard existente: leads por estado y tasa de conversión (admin, y owner en solo lectura).

La seguridad se aplica en backend: secretarias sin acceso alguno al CRM; owner solo los KPIs.

Para toda tarea con UI: antes de construir pantallas, cargá y aplicá la skill frontend-design (y dataviz si agregás gráficos), y cualquier otra skill de diseño/UX-UI disponible. Mobile-first, español (Argentina), coherente con el resto del gestor.

Al terminar: verificá los criterios de aceptación de la Fase 6 de PLAN.md, agregá tests de la lógica crítica nueva (transiciones del pipeline, conversión, permisos), actualizá PLAN.md (estado de fases) y CHANGELOG.md, y dejá todo commiteado y pusheado.
```

---

### Fase 7 — API pública v1

**Objetivo y valor.** Al terminar, sistemas externos (n8n, agentes de IA, formularios, Meta Ads) pueden cargar leads y leer alumnos, vencimientos y cumpleaños con una API key, para mandar saludos, recordatorios de cuota y campañas de recuperación **desde afuera**. El gestor queda integrable sin tocar su código.

**Tareas.**
1. **Gestión de API keys** (solo admin, en configuración): crear con nombre y alcances, ver último uso, revocar. La clave se muestra una sola vez al crearla.
2. **Autenticación y versionado**: toda la API pública vive bajo una versión explícita (v1) y exige una API key válida con el alcance correspondiente; los rechazos son claros y no filtran información.
3. **Ingesta de leads**: un sistema externo crea leads (entran al pipeline como "nuevo", con origen y fuente identificados), con validación estricta de entrada y protección razonable contra abuso.
4. **Consultas de lectura**: alumnos (datos básicos y estado), vencimientos (cuotas por vencer y vencidas con datos de contacto) y cumpleaños (próximos, con datos de contacto).
5. **Documentación para integradores**: un documento en el repo que explique cómo autenticarse y usar cada recurso, con ejemplos reales, apto para que un tercero (o un agente de IA) integre sin leer el código.

**Fuera de alcance.** Webhooks salientes (decisión registrada en §3: los endpoints de consulta alcanzan en v1). Envío de mensajes por el propio sistema. Escritura externa de cualquier cosa que no sea leads.

**Criterios de aceptación.**
- Como admin creás una API key "n8n cumpleaños" con alcance de lectura; con esa key, una llamada externa (demostrada en la sesión) devuelve los cumpleaños próximos con teléfonos.
- Con una key de solo lectura no se pueden crear leads; sin key, o con una key revocada, ninguna llamada funciona.
- Una llamada externa de ingesta crea un lead que aparece al instante en el CRM como "nuevo" con su fuente identificada.
- La documentación del repo alcanza para que alguien ajeno integre sin ayuda.
- Nada de la API pública expone datos de más (solo lo definido) ni permite saltarse los permisos internos.

**Dependencias.** Fases 1, 2, 3 (vencimientos) y 6 (leads).

**Prompt de ejecución.**

```text
Actuá como desarrollador senior full-stack. Trabajás en el repo ritmos-latinos-gestor-crm, dedicado exclusivamente al gestor de la academia.

Antes de arrancar: leé PLAN.md completo (en especial Diseño de la API, la entidad API key y la Fase 7) y CHANGELOG.md, y revisá el estado real del código — única fuente de verdad. Terminá primero cualquier pendiente bloqueante de fases anteriores. Reutilizá la lógica de negocio existente: los vencimientos y cumpleaños que expone la API pública salen de las MISMAS reglas que usa el panel.

Ejecutá la Fase 7 (API pública v1). Tareas por objetivo — investigá al ejecutar cada una la mejor forma de resolverla (incluidas las mejores prácticas vigentes de seguridad para APIs con API keys); no sigas una receta fija:

1. Gestión de API keys en la configuración del admin: crear con nombre y alcances, ver último uso, revocar; la clave se muestra una sola vez y se guarda de forma segura.
2. API pública versionada (v1) con autenticación por API key y alcances; rechazos claros que no filtren información; protección razonable contra abuso.
3. Ingesta de leads desde sistemas externos: entran al pipeline como "nuevo" con origen y fuente identificados; validación estricta server-side.
4. Consultas de lectura: alumnos (datos básicos y estado), vencimientos (por vencer y vencidos con contacto) y cumpleaños (próximos con contacto).
5. Documento para integradores en el repo, con ejemplos reales y completos, apto para que un tercero o un agente de IA integre sin leer el código. Recordá: el sistema NO envía mensajes; expone datos para que otros lo hagan.

Para la UI de gestión de API keys: cargá y aplicá la skill frontend-design y cualquier otra skill de diseño/UX-UI disponible, coherente con el resto del gestor.

Al terminar: verificá los criterios de aceptación de la Fase 7 de PLAN.md (demostrá llamadas externas reales: con key válida, sin key, con key revocada, con alcance insuficiente), agregá tests de autenticación/alcances e ingesta, actualizá PLAN.md (estado de fases) y CHANGELOG.md, y dejá todo commiteado y pusheado.
```

---

### Fase 8 — Endurecimiento, datos finales y publicación

**Objetivo y valor.** Al terminar, el sistema está listo para usarse en serio: seguridad revisada de punta a punta, lógica crítica cubierta por tests, manual de uso para no técnicos, datos reales cargados y arranque acompañado.

**Tareas.**
1. **Auditoría de permisos completa**: recorrer sistemáticamente toda la matriz rol × sede × recurso verificando en el backend cada combinación prohibida; corregir cualquier agujero.
2. **Cobertura de tests de lógica crítica**: revisar y completar los tests de vencimientos, estados derivados, cupos, conversión de leads, alcances de API keys y permisos.
3. **Pulido de experiencia**: estados de carga, vacíos y de error claros en todas las pantallas; mensajes en español rioplatense comprensibles para no técnicos; revisión de todo el flujo en celular real.
4. **Datos**: limpiar los datos ficticios y dejar cargada la configuración real (sedes, disciplinas, horarios, planes con precios reales); acompañar la **carga inicial real** (ver decisión abierta 5) con altas rápidas de alumnos y suscripciones.
5. **Manual de uso** en el repo, en español no técnico, por rol: el día a día de la secretaria, las tareas del admin, qué mira el owner; incluye qué hacer ante los problemas comunes (olvidé la contraseña, cargué mal un pago).
6. **Checklist de publicación**: usuarios reales creados (contraseñas propias), usuarios de prueba eliminados, variables y accesos verificados, respaldo de la base configurado o documentado, límites del free tier revisados con el uso real.

**Fuera de alcance.** Funcionalidades nuevas de cualquier tipo. Todo lo listado como futuro (mensajería propia, pasarela, descuentos con UI, webhooks).

**Criterios de aceptación.**
- Las secretarias reales entran con sus usuarios desde sus celulares y operan su sede sin ayuda, siguiendo el manual.
- Los datos reales están cargados y el dashboard muestra números verdaderos del negocio.
- No queda ningún usuario ni dato de prueba.
- La auditoría de permisos queda demostrada en la sesión (ninguna combinación prohibida de rol × sede × recurso pasa).
- Existe el manual en el repo y una persona no técnica puede seguirlo.

**Dependencias.** Todas las anteriores.

**Prompt de ejecución.**

```text
Actuá como desarrollador senior full-stack a cargo del cierre y publicación. Trabajás en el repo ritmos-latinos-gestor-crm, dedicado exclusivamente al gestor de la academia.

Antes de arrancar: leé PLAN.md completo y CHANGELOG.md, y revisá el estado real del código y del deploy — única fuente de verdad. Terminá primero cualquier pendiente de fases anteriores: esta fase deja el sistema en producción real.

Ejecutá la Fase 8 (Endurecimiento y publicación). Tareas por objetivo — investigá al ejecutar cada una la mejor forma de resolverla; no sigas una receta fija:

1. Auditoría de permisos completa: verificá sistemáticamente en el backend toda la matriz rol × sede × recurso (cada combinación prohibida debe rechazarse aunque la UI no la ofrezca) y corregí cualquier agujero. Demostrá el resultado.
2. Revisá y completá los tests de la lógica crítica: vencimiento rodante (fin de mes incluido), estados derivados, cupos y frecuencias, conversión de leads, API keys y alcances, permisos.
3. Pulido de experiencia: estados de carga, vacíos y errores claros en todas las pantallas; español (Argentina) comprensible para no técnicos; verificación del flujo completo en celular. Apoyate en la skill frontend-design para cualquier ajuste visual.
4. Datos: eliminá los datos ficticios, dejá la configuración real (sedes, disciplinas, horarios, planes y precios reales, que el humano te va a dictar o confirmar en esta sesión) y acompañá la carga inicial real de alumnos y suscripciones con flujos de alta rápida si hacen falta.
5. Escribí el manual de uso en el repo, en español no técnico, por rol (secretaria / admin / owner), incluyendo los problemas comunes y qué hacer.
6. Checklist de publicación: usuarios reales con sus propias contraseñas, usuarios de prueba eliminados, variables y accesos verificados, respaldo de la base configurado o documentado, límites del free tier contrastados con el uso real.

Al terminar: verificá los criterios de aceptación de la Fase 8 de PLAN.md junto con el humano, actualizá PLAN.md (estado de fases: todas ✅) y CHANGELOG.md con la entrada de publicación, y dejá todo commiteado y pusheado.
```

---

## 6. Riesgos y decisiones abiertas

> Máximo cinco, cada una con recomendación. Al resolverse (por decisión del cliente o al ejecutar la fase correspondiente), se registra acá la resolución y la fecha — las fases posteriores leen este documento y la aplican.

**1. ¿Los horarios pertenecen a la disciplina o a cada plan?** El brief dice que algunos planes "tienen múltiples horarios semanales fijos". Si los horarios colgaran de cada plan, "Pole 2x" y "Pole 3x" duplicarían los mismos horarios de pole y la ocupación real de la clase quedaría partida. **Recomendación (adoptada en el modelo de §2):** los horarios pertenecen a la **disciplina** en cada sede; el plan define la frecuencia y de qué disciplina(s) se eligen horarios. La ocupación de un horario suma inscriptos de todos los planes. *Estado: recomendación adoptada salvo objeción del cliente antes de la Fase 2.*

**2. Pagos anticipados: ¿desde cuándo corre el nuevo período?** El brief define "30/31 días desde la fecha de pago", pero si un alumno al día paga 3 días antes de vencer, aplicarlo literal le regala 3 días perdidos. **Recomendación:** si la suscripción está al día, el nuevo período corre **desde el vencimiento vigente**; si está vencida, **desde la fecha de pago**. Es lo que cualquier secretaria esperaría y evita discusiones en el mostrador. *Estado: abierta — confirmar con el cliente antes de la Fase 3; si no hay respuesta, aplicar la recomendación y registrarlo acá.*

**3. Cambio de precio con suscripciones activas.** ¿El aumento afecta el próximo pago de todos automáticamente? **Recomendación:** sí — el próximo pago de cualquier suscripción sugiere el **precio vigente** del plan al momento de pagar (editable por la secretaria caso por caso); no hay precios "congelados" por alumno en v1. El historial de precios y el monto real de cada pago preservan toda la trazabilidad. *Estado: recomendación adoptada en §2 salvo objeción antes de la Fase 3.*

**4. Definiciones exactas de "baja" y "vencida" para los KPIs.** Riesgo de que "bajas del mes" se infle con morosos o se pierdan bajas reales. **Recomendación (adoptada en §2):** "vencida" es siempre derivada del estado de pago y reversible pagando; "baja" es solo la acción explícita con fecha; el KPI de bajas cuenta únicamente bajas explícitas y los morosos son un listado aparte. Un moroso crónico se da de baja a mano cuando la academia lo decide. *Estado: recomendación adoptada salvo objeción antes de la Fase 5.*

**5. Migración de los datos del cuaderno.** ¿Importador masivo o carga manual? **Recomendación:** carga manual asistida en la Fase 8 (con flujos de alta rápida si hacen falta): son ~90 alumnos, el volumen no justifica construir un importador, y la carga manual sirve además de capacitación para las secretarias. Riesgo asociado: si la carga inicial se percibe pesada, la adopción arranca mal — mitigación: que las altas rápidas tomen segundos por alumno y la carga pueda repartirse entre sedes. *Estado: abierta — confirmar con el cliente antes de la Fase 8.*

---

## Decisiones de implementación tomadas (Fase 1, 2026-07-03)

- **ORM y migraciones**: Drizzle ORM + drizzle-kit; migraciones SQL versionadas en `drizzle/`. Driver `pg` estándar (portable entre Postgres local y Neon).
- **Autenticación**: sesión propia con JWT firmado (jose) en cookie httpOnly (30 días) + contraseñas con bcrypt. Sin dependencias de servicios pagos.
- **Autorización transversal**: matriz de permisos pura en `src/lib/auth/permissions.ts` (testeada) + guards de pantalla (`guards.ts`) y de API (`api-guards.ts`). El alcance por sede se resuelve siempre en el servidor (`src/lib/sedes.ts`).
- **Diseño**: identidad heredada de la marca de la landing (rojo #d93240, tinta #262325, Bebas Neue + Inter), panel claro mobile-first con barra inferior en celular. No había skill `frontend-design` disponible en el entorno de ejecución; el requisito de diseño propio se cumplió manualmente (queda la instrucción en los prompts por si la skill existe en sesiones futuras).
- **Nota operativa**: quedó una ruta interna de ejemplo (`/api/interno/sedes`) que demuestra el filtrado por sede en la API; las fases siguientes reutilizan ese patrón.

---

*Documento creado el 2026-07-03. Mantener actualizado al cierre de cada fase: tabla de estado, decisiones resueltas y cualquier desvío respecto de lo planificado.*
