import type { Metadata } from "next";
import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { configuracion, leads } from "@/db/schema";
import { requerirSeccion } from "@/lib/auth/guards";
import {
  CLAVE_MENSAJE_INTERESADOS,
  MENSAJE_INTERESADOS_DEFAULT,
  linkWhatsApp,
  renderizarPlantilla,
} from "@/lib/mensajes";
import { ETIQUETA_ESTADO_LEAD, esEstadoFinal } from "@/lib/reglas-leads";
import { ZONA_HORARIA } from "@/lib/fechas";
import { sedeActiva } from "@/lib/sedes";
import { Campo, Input } from "@/componentes/campos";
import { ChipBanner, EncabezadoSeccion } from "@/componentes/encabezado";
import { FormAccion } from "@/componentes/form-accion";
import { crearInteresado } from "./acciones";

export const metadata: Metadata = { title: "Interesados" };

// Interesados de los últimos días: los más viejos viven en el CRM del admin.
const DIAS_RECIENTES = 7;

function fechaHaceDias(dias: number): Date {
  return new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
}

function formatoFechaHora(fecha: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: ZONA_HORARIA,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(fecha);
}

// Mostrador de interesados: la secretaria carga a quien viene a averiguar y
// le manda la info por WhatsApp con un click (mensaje configurable por el
// admin en Configuración). El lead entra al CRM como "nuevo".
export default async function PaginaInteresados() {
  const usuario = await requerirSeccion("interesados");
  const sede = await sedeActiva(usuario);

  const desde = fechaHaceDias(DIAS_RECIENTES);
  const [recientes, filaMensaje] = await Promise.all([
    sede
      ? db
          .select()
          .from(leads)
          .where(
            and(eq(leads.sedeInteresId, sede.id), gte(leads.creadoEn, desde)),
          )
          .orderBy(desc(leads.creadoEn))
      : [],
    db.query.configuracion.findFirst({
      where: eq(configuracion.clave, CLAVE_MENSAJE_INTERESADOS),
    }),
  ]);
  const plantilla = filaMensaje?.valor ?? MENSAJE_INTERESADOS_DEFAULT;

  return (
    <div>
      <EncabezadoSeccion
        titulo="Interesados"
        subtitulo="Cargá a quien viene a averiguar y mandale la info por WhatsApp con un click."
        extra={
          sede ? <ChipBanner etiqueta="Sede">{sede.nombre}</ChipBanner> : null
        }
      />

      {!sede ? (
        <div className="mt-6 tarjeta border-dashed px-6 py-12 text-center">
          <p className="font-medium">No tenés una sede asignada.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,24rem)_1fr]">
          {/* Alta rápida */}
          <section className="tarjeta h-fit p-5">
            <h2 className="titulo-display text-2xl">Nuevo interesado</h2>
            <p className="mt-1 text-xs text-tinta-suave">
              Entra al CRM como «nuevo», con fuente «mostrador».
            </p>
            <FormAccion
              accion={crearInteresado}
              textoBoton="Guardar interesado"
              className="mt-3 grid gap-3"
            >
              <input type="hidden" name="sedeId" value={sede.id} />
              <Campo etiqueta="Nombre">
                <Input name="nombre" required placeholder="Nombre y apellido" />
              </Campo>
              <Campo etiqueta="Teléfono / WhatsApp">
                <Input name="telefono" required inputMode="tel" />
              </Campo>
              <Campo etiqueta="Email (opcional)">
                <Input name="email" type="email" />
              </Campo>
              <Campo etiqueta="Nota (opcional)">
                <Input
                  name="nota"
                  placeholder="Ej.: preguntó por pole, puede a la tarde"
                />
              </Campo>
            </FormAccion>
          </section>

          {/* Recientes con WhatsApp prellenado */}
          <section>
            <h2 className="text-sm font-semibold text-tinta-suave">
              Últimos {DIAS_RECIENTES} días ({recientes.length})
            </h2>
            {recientes.length === 0 ? (
              <div className="tarjeta mt-3 border-dashed px-6 py-10 text-center">
                <p className="font-medium">Sin interesados esta semana.</p>
                <p className="mt-1 text-sm text-tinta-suave">
                  Los que cargues aparecen acá, listos para contactar.
                </p>
              </div>
            ) : (
              <ul className="tarjeta mt-3 overflow-hidden">
                {recientes.map((lead) => (
                  <li
                    key={lead.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-b border-borde px-4 py-3 last:border-0"
                  >
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{lead.nombre}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            esEstadoFinal(lead.estado)
                              ? "bg-borde text-tinta-suave"
                              : "bg-marca-suave text-marca-oscuro"
                          }`}
                        >
                          {ETIQUETA_ESTADO_LEAD[lead.estado]}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs text-tinta-suave">
                        {formatoFechaHora(lead.creadoEn)} · {lead.telefono}
                        {lead.email ? ` · ${lead.email}` : ""}
                        {lead.nota ? ` · ${lead.nota}` : ""}
                      </span>
                    </span>
                    <a
                      href={linkWhatsApp(
                        lead.telefono,
                        renderizarPlantilla(plantilla, { nombre: lead.nombre }),
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded-full bg-ok/10 px-3 py-1.5 text-xs font-semibold text-ok transition hover:bg-ok/20"
                    >
                      Mandar info por WhatsApp
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-tinta-suave">
              El mensaje que se manda lo configura el admin en Configuración →
              «Mensaje a interesados».
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
