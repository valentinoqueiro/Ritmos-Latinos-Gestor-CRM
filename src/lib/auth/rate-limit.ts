// Límite de solicitudes simple para la API pública v1 (protección razonable
// contra abuso, sin infra paga). Ventana fija en memoria del proceso.
//
// Limitación conocida: no persiste entre instancias. Si el hosting escala
// horizontalmente, el límite real puede superarse en un factor igual a la
// cantidad de instancias activas. Para el tráfico esperado de integraciones
// (n8n, agentes, formularios) alcanza; si el uso real lo exige, se reemplaza
// por una tabla o un servicio dedicado sin cambiar la firma de `excedeLimite`.

const VENTANA_MS = 60_000;
const LIMITE_POR_VENTANA = 60;

type Contador = { inicio: number; conteo: number };
const contadores = new Map<number, Contador>();

/** true si la API key ya superó el límite de esta ventana. */
export function excedeLimite(apiKeyId: number, ahora: number = Date.now()): boolean {
  const actual = contadores.get(apiKeyId);
  if (!actual || ahora - actual.inicio >= VENTANA_MS) {
    contadores.set(apiKeyId, { inicio: ahora, conteo: 1 });
    return false;
  }
  actual.conteo += 1;
  return actual.conteo > LIMITE_POR_VENTANA;
}

/** Solo para tests: limpia los contadores entre casos. */
export function reiniciarContadores(): void {
  contadores.clear();
}
