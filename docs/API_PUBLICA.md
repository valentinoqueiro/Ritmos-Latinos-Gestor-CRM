# API pública v1 — guía de integración

API para que sistemas externos (n8n, agentes de IA, formularios web, Meta Ads) integren con el gestor de Ritmos Latinos **sin tocar el código del sistema**. Pensada para automatizar mensajería (WhatsApp, email) desde afuera: el sistema **expone datos**, pero no envía mensajes por sí mismo.

Toda la API vive bajo `/api/v1`. Es un árbol completamente separado de las pantallas del panel (que usan sesión de usuario interno): acá la autenticación es por **API key**.

## Autenticación

Cada solicitud debe incluir la clave en el encabezado `Authorization`:

```
Authorization: Bearer rlk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

- La clave se crea desde el panel: **Configuración → API keys** (rol admin). Se muestra **una sola vez** al crearla — si se pierde, hay que revocarla y crear una nueva.
- Cada clave tiene un nombre descriptivo y uno o más **alcances** (ver tabla abajo). Una llamada solo funciona si la clave tiene el alcance que pide el endpoint.
- Revocar una clave desde el panel la deja inutilizable de inmediato.

### Errores de autenticación

| Situación | Status | Respuesta |
|---|---|---|
| Sin encabezado `Authorization`, o sin `Bearer` | 401 | `{ "error": "Falta la API key..." }` |
| Clave inexistente **o revocada** | 401 | `{ "error": "API key inválida o revocada" }` |
| Clave válida sin el alcance necesario | 403 | `{ "error": "Esta API key no tiene el alcance necesario" }` |
| Demasiadas solicitudes en poco tiempo | 429 | `{ "error": "Demasiadas solicitudes..." }` |

Nota de seguridad: el error 401 es **el mismo** tanto si la clave nunca existió como si fue revocada — a propósito, para no darle información extra a quien intenta adivinar claves.

### Límite de solicitudes

Hasta 60 solicitudes por minuto por API key. Si se supera, la API responde `429` hasta que empieza la siguiente ventana de un minuto.

## Alcances (scopes)

| Alcance | Permite |
|---|---|
| `leads:write` | Crear leads (`POST /api/v1/leads`) |
| `leads:read` | Leer el pipeline de leads (`GET /api/v1/leads`) |
| `alumnos:read` | Leer alumnos (`GET /api/v1/alumnos`) |
| `vencimientos:read` | Leer cuotas por vencer/vencidas (`GET /api/v1/vencimientos`) |
| `cumpleanos:read` | Leer próximos cumpleaños (`GET /api/v1/cumpleanos`) |

Una clave puede tener varios alcances a la vez. Los endpoints de lectura son **cross-sede**: si no se pasa `sedeId`, devuelven datos de todas las sedes activas.

---

## `POST /api/v1/leads` — crear un lead

Alcance requerido: `leads:write`. El lead entra al pipeline del CRM como **"nuevo"**, con origen `"api"` y la fuente que se indique (para saber de dónde vino: "Meta Ads", "formulario web", el nombre del bot, etc.).

**Body (JSON):**

```json
{
  "nombre": "Lucía Fernández",
  "telefono": "+543815551234",
  "fuente": "Meta Ads - campaña julio",
  "disciplinas": ["Pole Sport"],
  "origenNegocio": "Meta Ads",
  "email": "lucia@mail.com",
  "nota": "Preguntó por Pole Sport en Instagram"
}
```

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `nombre` | string | sí | mínimo 2 caracteres |
| `telefono` | string | sí | solo dígitos, espacios y `+()-` |
| `fuente` | string | sí | identifica el sistema/origen externo, 2 a 80 caracteres |
| `disciplinas` | string[] | no | nombres del catálogo (case-insensitive). **Derivan la sede del lead**; un nombre desconocido devuelve 400 con la lista de válidos |
| `origenNegocio` | string | no | de dónde vino el interesado: "Meta Ads", "Instagram", "Web", "Referido"… (catálogo configurable; desconocido = 400 con los válidos) |
| `email` | string | no | email de contacto |
| `nota` | string | no | hasta 300 caracteres |
| `sedeInteresId` | number | no | **OBSOLETO**: la sede se deriva de `disciplinas`. Se sigue aceptando por compatibilidad |

**Respuesta (201):**

```json
{ "lead": { "id": 42, "estado": "nuevo" } }
```

**Errores:** `400` con `{ "error": "..." }` si falta un campo obligatorio, el teléfono tiene caracteres inválidos, o la sede no existe.

**curl:**

```bash
curl -X POST http://localhost:3000/api/v1/leads \
  -H "Authorization: Bearer rlk_live_TU_CLAVE" \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Lucía Fernández",
    "telefono": "+543815551234",
    "fuente": "Meta Ads - campaña julio"
  }'
```

---

## `GET /api/v1/leads` — pipeline de leads (lectura)

Alcance requerido: `leads:read`. Devuelve el pipeline completo del CRM en solo lectura, para automatizaciones externas (seguimiento, recordatorios, reportes). **La API no envía mensajes**: expone los datos para que otro sistema lo haga.

**Query params (opcionales):**

| Param | Valores |
|---|---|
| `estado` | `nuevo`, `contactado`, `prueba_agendada`, `convertido`, `perdido` |
| `desde` | `YYYY-MM-DD` — solo leads creados desde esa fecha |

**Respuesta (200):**

```json
{
  "leads": [
    {
      "id": 42,
      "nombre": "Lucía Fernández",
      "telefono": "+543815551234",
      "email": null,
      "estado": "nuevo",
      "etapaDesde": "2026-07-04T18:00:00.000Z",
      "origen": "api",
      "fuente": "Meta Ads - campaña julio",
      "origenNegocio": "Meta Ads",
      "disciplinas": [{ "id": 6, "nombre": "Pole Sport", "sedeId": 2 }],
      "sedeIds": [2],
      "pruebaFecha": null,
      "motivoPerdida": null,
      "alumnoId": null,
      "creadoEn": "2026-07-04T18:00:00.000Z"
    }
  ]
}
```

`etapaDesde` dice desde cuándo el lead está en su etapa actual (útil para detectar leads fríos desde afuera). `sedeIds` se deriva de las disciplinas; vacío = lead sin clasificar.

**curl:**

```bash
curl "http://localhost:3000/api/v1/leads?estado=nuevo&desde=2026-07-01" \
  -H "Authorization: Bearer rlk_live_TU_CLAVE"
```

---

## `GET /api/v1/alumnos` — alumnos

Alcance requerido: `alumnos:read`. Datos básicos y estado (si tiene alguna suscripción activa).

**Query params:** `sedeId` (opcional, número).

**Respuesta (200):**

```json
{
  "alumnos": [
    {
      "id": 10,
      "nombre": "Martina",
      "apellido": "Gómez",
      "dni": "40123456",
      "telefono": "+543815550001",
      "sedeId": 1,
      "activo": true
    }
  ]
}
```

**curl:**

```bash
curl http://localhost:3000/api/v1/alumnos?sedeId=1 \
  -H "Authorization: Bearer rlk_live_TU_CLAVE"
```

---

## `GET /api/v1/vencimientos` — cuotas por vencer y vencidas

Alcance requerido: `vencimientos:read`. Usa exactamente la misma lógica derivada que usa la secretaria en el panel (`al_dia` / `por_vencer` / `vencida`); este endpoint **solo devuelve** `por_vencer` y `vencida` (los al día no sirven para recordatorios).

**Query params:** `sedeId` (opcional, número).

**Respuesta (200):**

```json
{
  "vencimientos": [
    {
      "suscripcionId": 55,
      "alumnoId": 10,
      "alumno": "Gómez, Martina",
      "telefono": "+543815550001",
      "plan": "Pole 2x",
      "vence": "2026-06-28",
      "estado": "vencida",
      "diasRestantes": -6,
      "precioVigente": "18000.00"
    }
  ]
}
```

`diasRestantes` es negativo si ya venció. `vence` puede ser `null` si el alumno nunca pagó (en ese caso el estado es `"vencida"` igual).

**curl:**

```bash
curl http://localhost:3000/api/v1/vencimientos \
  -H "Authorization: Bearer rlk_live_TU_CLAVE"
```

---

## `GET /api/v1/cumpleanos` — próximos cumpleaños

Alcance requerido: `cumpleanos:read`. Cumpleaños que faltan en lo que resta del **mes actual**, de alumnos con alguna suscripción activa.

**Query params:** `sedeId` (opcional, número).

**Respuesta (200):**

```json
{
  "cumpleanos": [
    {
      "alumnoId": 10,
      "nombre": "Martina Gómez",
      "dia": 15,
      "cumpleAnios": 24,
      "telefono": "+543815550001",
      "sedeId": 1
    }
  ]
}
```

**curl:**

```bash
curl http://localhost:3000/api/v1/cumpleanos \
  -H "Authorization: Bearer rlk_live_TU_CLAVE"
```

---

## Fuera de alcance (a propósito)

- **No hay webhooks salientes**: para enterarse de novedades, consultá periódicamente los endpoints de lectura (por ejemplo, una vez al día para cumpleaños y vencimientos).
- **El sistema no envía mensajes**: no hay ningún endpoint que mande WhatsApp o email. Eso lo hace el sistema externo que consume esta API.
- **No hay escritura externa de nada que no sea leads**: no se pueden crear/editar alumnos, pagos, suscripciones, etc. vía API pública.
