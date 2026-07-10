"use client";

import { useState } from "react";
import Link from "next/link";
import { Campo, Input, Select } from "@/componentes/campos";
import { FormAccion } from "@/componentes/form-accion";
import { IconoCerrar } from "@/componentes/iconos";
import { enviarInvitacion } from "../acciones";

// Previsualización de la invitación a la clase de prueba. Los valores se
// editan ACÁ y viajan tal cual al webhook: no tocan la ficha del lead (sirve
// para corregir un nombre que vino mal de Meta sin pisar el dato original).

export type OpcionInvitacion = {
  disciplina: string;
  sede: string;
  direccion: string;
};

export function BotonInvitacion({
  leadId,
  nombre,
  email,
  opciones,
  fecha,
  hora,
  invitacionEnviada,
  webhookListo,
}: {
  leadId: number;
  nombre: string;
  email: string | null;
  // Disciplinas candidatas (la de la clase agendada primero, después las de
  // interés), cada una con su sede y dirección derivadas.
  opciones: OpcionInvitacion[];
  fecha: string | null;
  hora: string | null;
  // Cuándo se envió la última invitación (ya formateado); null = nunca.
  invitacionEnviada: string | null;
  webhookListo: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [eleccion, setEleccion] = useState(0);
  const elegida = opciones[eleccion] ?? null;
  // Sede y dirección acompañan a la disciplina elegida, pero quedan editables.
  const [sede, setSede] = useState(elegida?.sede ?? "");
  const [direccion, setDireccion] = useState(elegida?.direccion ?? "");

  function elegirDisciplina(indice: number) {
    setEleccion(indice);
    const opcion = opciones[indice];
    if (opcion) {
      setSede(opcion.sede);
      setDireccion(opcion.direccion);
    }
  }

  const puedeEnviar = Boolean(email) && webhookListo;

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="boton-secundario w-full sm:w-auto"
      >
        Enviar invitación
      </button>

      {abierto ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-tinta/60 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setAbierto(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Invitación a la clase de prueba"
            className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-superficie p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-tarjeta-alta sm:max-h-[85dvh] sm:rounded-2xl sm:pb-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="titulo-display text-2xl">Invitación a la prueba</h2>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar"
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-tinta-suave transition hover:bg-fondo"
              >
                <IconoCerrar className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="mt-3 grid gap-3">
              {invitacionEnviada ? (
                <p className="rounded-lg bg-alerta/10 px-3 py-2 text-sm font-medium text-alerta">
                  Ya se envió una invitación el {invitacionEnviada}. Podés
                  mandarla de nuevo si hace falta.
                </p>
              ) : null}

              {!email ? (
                <p
                  role="alert"
                  className="rounded-lg bg-marca-suave px-3 py-2 text-sm font-medium text-marca-oscuro"
                >
                  Este lead no tiene email, y la invitación se manda por email.
                  Cargalo en la sección «Datos» de esta ficha y volvé a abrir
                  esta ventana.
                </p>
              ) : !webhookListo ? (
                <p
                  role="alert"
                  className="rounded-lg bg-marca-suave px-3 py-2 text-sm font-medium text-marca-oscuro"
                >
                  Falta configurar el envío de invitaciones (la URL y el token
                  del webhook).{" "}
                  <Link href="/configuracion" className="underline">
                    Ir a Configuración
                  </Link>
                </p>
              ) : (
                <p className="text-sm text-tinta-suave">
                  Revisá los datos que van en el voucher. Lo que edites acá
                  vale solo para esta invitación: la ficha del lead no cambia.
                </p>
              )}

              {puedeEnviar ? (
                <FormAccion
                  accion={enviarInvitacion}
                  textoBoton="Enviar invitación"
                  textoEnviando="Enviando…"
                  alCompletar={() => setAbierto(false)}
                  className="grid gap-3"
                >
                  <input type="hidden" name="leadId" value={leadId} />
                  <Campo etiqueta="Nombre">
                    <Input name="nombre" required defaultValue={nombre} />
                  </Campo>
                  <Campo etiqueta="Email">
                    <Input
                      name="email"
                      type="email"
                      inputMode="email"
                      required
                      defaultValue={email ?? ""}
                    />
                  </Campo>
                  {opciones.length > 1 ? (
                    <Campo etiqueta="Disciplina">
                      <Select
                        value={eleccion}
                        onChange={(e) =>
                          elegirDisciplina(Number(e.target.value))
                        }
                      >
                        {opciones.map((o, i) => (
                          <option key={`${o.disciplina}-${i}`} value={i}>
                            {o.disciplina} · {o.sede}
                          </option>
                        ))}
                      </Select>
                    </Campo>
                  ) : null}
                  {/* La disciplina que viaja es texto libre: el select de
                      arriba la precarga, pero se puede retocar. */}
                  <Campo
                    etiqueta={
                      opciones.length > 1
                        ? "Cómo figura en la invitación"
                        : "Disciplina"
                    }
                  >
                    <Input
                      key={`disciplina-${eleccion}`}
                      name="disciplina"
                      required
                      defaultValue={elegida?.disciplina ?? ""}
                      placeholder="Ej.: Salsa y Bachata"
                    />
                  </Campo>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Campo etiqueta="Sede">
                      <Input
                        name="sede"
                        required
                        value={sede}
                        onChange={(e) => setSede(e.target.value)}
                      />
                    </Campo>
                    <Campo etiqueta="Dirección">
                      <Input
                        name="direccion"
                        required
                        value={direccion}
                        onChange={(e) => setDireccion(e.target.value)}
                      />
                    </Campo>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Campo etiqueta="Fecha de la clase">
                      <Input
                        name="fecha"
                        type="date"
                        required
                        defaultValue={fecha ?? ""}
                      />
                    </Campo>
                    <Campo etiqueta="Hora">
                      <Input
                        name="hora"
                        type="time"
                        required
                        defaultValue={hora ?? ""}
                      />
                    </Campo>
                  </div>
                </FormAccion>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
