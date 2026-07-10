# Invitaciones a la clase de prueba — contrato con n8n

El gestor **no genera ni manda** la invitación (el voucher por email): junta los
datos del lead, deja revisarlos/corregirlos en una previsualización y dispara un
**webhook saliente** al n8n externo, que arma y envía el email. Este documento
es el contrato para construir ese escenario de n8n.

## Flujo del lado del gestor

1. Un lead pasa a **"Prueba agendada"** en el CRM (con fecha y horario).
2. En la ficha del lead aparece el botón **«Enviar invitación»** (solo admin).
3. Se abre una previsualización con los datos precargados (nombre, email,
   disciplina, sede, dirección, fecha y hora), todos **editables para ese
   envío puntual** (no modifican la ficha).
4. Al confirmar, el gestor hace el POST de abajo. Si el n8n responde 2xx, el
   envío queda registrado en el historial del lead; cualquier otra respuesta
   muestra un error y **no** registra nada (se puede reintentar).

## Configuración (lado gestor)

En **Configuración → Invitaciones a clase de prueba** (rol admin):

- **URL del webhook**: la URL de producción del webhook de n8n.
- **Token de autenticación**: un secreto compartido, generado por quien arma el
  n8n. Se guarda y no se vuelve a mostrar.

Hasta que ambos estén cargados, el botón del CRM avisa que falta configurar y
no manda nada.

## La llamada que recibe el n8n

```
POST <URL configurada>
Content-Type: application/json
Authorization: Bearer <token configurado>
```

**Body (claves exactas, acordadas — no cambiar sin coordinar ambos lados):**

```json
{
  "nombre": "María González",
  "email": "maria@ejemplo.com",
  "disciplina": "Salsa y Bachata",
  "sede": "Sede LS",
  "direccion": "Julio Argentino Roca 124, Yerba Buena",
  "fecha": "2026-07-15",
  "hora": "19:00"
}
```

| Campo | Formato | Notas |
|---|---|---|
| `nombre` | texto | como debe figurar en el voucher (puede venir corregido a mano) |
| `email` | email | a dónde mandar la invitación |
| `disciplina` | texto | la clase a la que viene |
| `sede` | texto | nombre completo de la sede (ej. "Sede LS") |
| `direccion` | texto | dirección de esa sede (editable en Configuración → Sedes) |
| `fecha` | `YYYY-MM-DD` | día de la clase de prueba |
| `hora` | `HH:MM` (24 h) | hora de la clase |

## Qué tiene que hacer el n8n

- **Validar el header** `Authorization: Bearer <token>` contra el secreto
  compartido (en n8n: credencial *Header Auth* con nombre `Authorization` y
  valor `Bearer <token>`). Rechazar lo demás.
- Armar el voucher/email con esos datos y mandarlo a `email`.
- **Responder 2xx solo si aceptó el trabajo.** El gestor registra el envío con
  cualquier 2xx; un 4xx/5xx o no responder dentro de **10 segundos** se muestra
  como error y el gestor NO registra (la admin va a reintentar → el n8n puede
  recibir el mismo lead más de una vez; que el reenvío sea inocuo).

## Reintentos y reenvíos

- El gestor no reintenta solo: siempre es la admin tocando el botón de nuevo.
- Reenviar está permitido a propósito (ej. corrigieron el email): el n8n debe
  tolerar POSTs repetidos para la misma persona.
