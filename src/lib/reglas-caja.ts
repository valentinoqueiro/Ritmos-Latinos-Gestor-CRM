// Reglas del cierre de caja por turno. Módulo PURO: recibe los datos ya
// consultados (src/lib/caja.ts arma los inputs) y calcula el resumen que ve
// la secretaria en vivo y al cerrar. Nada de esto se guarda: se deriva
// siempre de entregas y movimientos, igual que el estado de las cuotas.

export type ResumenTurno = {
  // Contratos registrados en el turno, separados según si el alumno pagaba
  // por primera vez en la sede (nuevo) o ya tenía pagos previos (renovado).
  nuevos: number;
  renovados: number;
  // Dinero recibido en el turno (todas las entregas, incluidas las que
  // completan deudas de contratos anteriores).
  totalEfectivo: number;
  totalTransferencia: number;
  // Egresos en efectivo del turno (movimientos_caja).
  egresos: number;
  // Lo que debería haber físicamente en la caja al cerrar. Puede quedar
  // negativo si los egresos superan lo cobrado: se muestra, no se bloquea.
  efectivoEsperado: number;
};

export function resumenDeTurno(datos: {
  efectivoInicial: number | null;
  contratosDelTurno: { esPrimerContratoDelAlumno: boolean }[];
  entregas: { monto: number; medio: "efectivo" | "transferencia" }[];
  egresos: { monto: number }[];
}): ResumenTurno {
  const inicial = datos.efectivoInicial ?? 0;
  let totalEfectivo = 0;
  let totalTransferencia = 0;
  for (const e of datos.entregas) {
    if (e.medio === "efectivo") totalEfectivo += e.monto;
    else totalTransferencia += e.monto;
  }
  const egresos = datos.egresos.reduce((suma, m) => suma + m.monto, 0);
  const nuevos = datos.contratosDelTurno.filter(
    (c) => c.esPrimerContratoDelAlumno,
  ).length;

  return {
    nuevos,
    renovados: datos.contratosDelTurno.length - nuevos,
    totalEfectivo: redondear(totalEfectivo),
    totalTransferencia: redondear(totalTransferencia),
    egresos: redondear(egresos),
    efectivoEsperado: redondear(inicial + totalEfectivo - egresos),
  };
}

function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}
