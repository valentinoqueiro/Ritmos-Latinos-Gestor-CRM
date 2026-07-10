import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { configuracion, usuarios } from "@/db/schema";
import { requerirSeccion } from "@/lib/auth/guards";
import { umbralPorVencer } from "@/lib/cobros";
import {
  CLAVE_WEBHOOK_INVITACIONES_TOKEN,
  CLAVE_WEBHOOK_INVITACIONES_URL,
} from "@/lib/invitaciones";
import {
  CLAVE_MENSAJE_INTERESADOS,
  CLAVE_MENSAJE_RECONTACTO,
  MENSAJE_INTERESADOS_DEFAULT,
  MENSAJE_RECONTACTO_DEFAULT,
} from "@/lib/mensajes";
import {
  CLAVE_UMBRAL_LEAD_FRIO,
  UMBRAL_LEAD_FRIO_DEFAULT,
} from "@/lib/reglas-crm";
import { sedesVisibles } from "@/lib/sedes";
import { Campo, claseInput, Input } from "@/componentes/campos";
import { EncabezadoSeccion } from "@/componentes/encabezado";
import { FormAccion } from "@/componentes/form-accion";
import {
  guardarDireccionSede,
  guardarMensajeInteresados,
  guardarMensajeRecontacto,
  guardarUmbral,
  guardarUmbralLeadFrio,
  guardarWebhookInvitaciones,
} from "./acciones";
import { alternarCategoria, crearCategoria } from "../gastos/acciones";
import { categoriasGasto } from "@/db/schema";

export const metadata: Metadata = { title: "Configuración" };

const ETIQUETA_ROL: Record<string, string> = {
  secretaria: "Secretaría",
  admin: "Administración",
  owner: "Dueños (solo lectura)",
};

export default async function PaginaConfiguracion() {
  const usuario = await requerirSeccion("configuracion");
  const [
    sedes,
    listaUsuarios,
    umbral,
    categorias,
    filaMensaje,
    filaUmbralFrio,
    filaRecontacto,
    filaWebhookUrl,
    filaWebhookToken,
  ] =
    await Promise.all([
      sedesVisibles(usuario),
      db.query.usuarios.findMany({ orderBy: asc(usuarios.nombre) }),
      umbralPorVencer(),
      db.query.categoriasGasto.findMany({
        orderBy: asc(categoriasGasto.nombre),
      }),
      db.query.configuracion.findFirst({
        where: eq(configuracion.clave, CLAVE_MENSAJE_INTERESADOS),
      }),
      db.query.configuracion.findFirst({
        where: eq(configuracion.clave, CLAVE_UMBRAL_LEAD_FRIO),
      }),
      db.query.configuracion.findFirst({
        where: eq(configuracion.clave, CLAVE_MENSAJE_RECONTACTO),
      }),
      db.query.configuracion.findFirst({
        where: eq(configuracion.clave, CLAVE_WEBHOOK_INVITACIONES_URL),
      }),
      db.query.configuracion.findFirst({
        where: eq(configuracion.clave, CLAVE_WEBHOOK_INVITACIONES_TOKEN),
      }),
    ]);
  const mensajeInteresados = filaMensaje?.valor ?? MENSAJE_INTERESADOS_DEFAULT;
  const umbralFrio = Number(filaUmbralFrio?.valor) || UMBRAL_LEAD_FRIO_DEFAULT;
  const mensajeRecontacto = filaRecontacto?.valor ?? MENSAJE_RECONTACTO_DEFAULT;
  const webhookUrl = filaWebhookUrl?.valor ?? "";
  // El token NUNCA baja al navegador: solo se muestra si existe o no.
  const hayToken = Boolean(filaWebhookToken?.valor);
  const webhookListo = Boolean(webhookUrl) && hayToken;
  const nombreSede = (sedeId: number | null) =>
    sedes.find((s) => s.id === sedeId)?.nombre ?? "Todas";

  return (
    <div>
      <EncabezadoSeccion
        titulo="Configuración"
        subtitulo="Disciplinas, planes, usuarios y reglas del sistema."
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link
          href="/configuracion/disciplinas"
          className="tarjeta p-4 transition hover:border-marca"
        >
          <p className="font-semibold">Disciplinas y horarios</p>
          <p className="mt-1 text-sm text-tinta-suave">
            Actividades de la sede, clases semanales y cupos.
          </p>
        </Link>
        <Link
          href="/configuracion/planes"
          className="tarjeta p-4 transition hover:border-marca"
        >
          <p className="font-semibold">Planes y precios</p>
          <p className="mt-1 text-sm text-tinta-suave">
            Planes por disciplina, pack o frecuencia, con historial de precios.
          </p>
        </Link>
        <Link
          href="/configuracion/api-keys"
          className="tarjeta p-4 transition hover:border-marca"
        >
          <p className="font-semibold">API keys</p>
          <p className="mt-1 text-sm text-tinta-suave">
            Integraciones externas: leads, vencimientos y cumpleaños vía API.
          </p>
        </Link>
      </div>

      <section className="mt-8 max-w-md tarjeta p-4">
        <h2 className="font-semibold">Categorías de gasto</h2>
        {categorias.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {categorias.map((c) => (
              <li key={c.id}>
                <form action={alternarCategoria} className="inline">
                  <input type="hidden" name="id" value={c.id} />
                  <button
                    type="submit"
                    title={c.activa ? "Desactivar" : "Reactivar"}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${
                      c.activa
                        ? "bg-fondo text-tinta ring-borde hover:ring-marca"
                        : "bg-superficie text-tinta-suave/60 ring-borde line-through"
                    }`}
                  >
                    {c.nombre}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-2 text-xs text-tinta-suave">
          Tocá una categoría para desactivarla o reactivarla.
        </p>
        <FormAccion
          accion={crearCategoria}
          textoBoton="Agregar categoría"
          variante="secundario"
          className="mt-3 flex items-end gap-3"
        >
          <Campo etiqueta="Nueva categoría">
            <Input name="nombre" required placeholder="Ej.: Alquiler" />
          </Campo>
        </FormAccion>
      </section>

      <section className="mt-8 max-w-md tarjeta p-4">
        <h2 className="font-semibold">Aviso de «por vencer»</h2>
        <p className="mt-1 text-sm text-tinta-suave">
          Cuántos días antes del vencimiento una cuota aparece como «por
          vencer» (hoy: {umbral} días).
        </p>
        <FormAccion
          accion={guardarUmbral}
          textoBoton="Guardar"
          variante="secundario"
          className="mt-3 flex items-end gap-3"
        >
          <Campo etiqueta="Días de aviso">
            <Input
              name="dias"
              inputMode="numeric"
              required
              defaultValue={umbral}
              className="w-24"
            />
          </Campo>
        </FormAccion>
      </section>

      <section className="mt-8 max-w-md tarjeta p-4">
        <h2 className="font-semibold">Aviso de lead frío (CRM)</h2>
        <p className="mt-1 text-sm text-tinta-suave">
          Cuántos días puede estar un interesado sin cambiar de etapa antes de
          marcarse como frío en el CRM (hoy: {umbralFrio}{" "}
          {umbralFrio === 1 ? "día" : "días"}).
        </p>
        <FormAccion
          accion={guardarUmbralLeadFrio}
          textoBoton="Guardar"
          variante="secundario"
          className="mt-3 flex items-end gap-3"
        >
          <Campo etiqueta="Días sin moverse">
            <Input
              name="dias"
              inputMode="numeric"
              required
              defaultValue={umbralFrio}
              className="w-24"
            />
          </Campo>
        </FormAccion>
      </section>

      <section className="mt-8 max-w-md tarjeta p-4">
        <h2 className="font-semibold">Mensaje a interesados</h2>
        <p className="mt-1 text-sm text-tinta-suave">
          Lo que manda la secretaría por WhatsApp desde Interesados. Usá{" "}
          <code className="rounded bg-fondo px-1">{"{nombre}"}</code> para
          insertar el nombre de la persona.
        </p>
        <FormAccion
          accion={guardarMensajeInteresados}
          textoBoton="Guardar mensaje"
          variante="secundario"
          className="mt-3"
        >
          <Campo etiqueta="Mensaje">
            <textarea
              name="mensaje"
              required
              rows={4}
              defaultValue={mensajeInteresados}
              className={`${claseInput} h-auto py-2`}
            />
          </Campo>
        </FormAccion>
      </section>

      <section className="mt-8 max-w-md tarjeta p-4">
        <h2 className="font-semibold">Mensaje de recontacto (CRM)</h2>
        <p className="mt-1 text-sm text-tinta-suave">
          Lo que se manda por WhatsApp desde «A recontactar» del CRM a los
          alumnos que se están alejando. Usá{" "}
          <code className="rounded bg-fondo px-1">{"{nombre}"}</code> para el
          nombre.
        </p>
        <FormAccion
          accion={guardarMensajeRecontacto}
          textoBoton="Guardar mensaje"
          variante="secundario"
          className="mt-3"
        >
          <Campo etiqueta="Mensaje">
            <textarea
              name="mensaje"
              required
              rows={4}
              defaultValue={mensajeRecontacto}
              className={`${claseInput} h-auto py-2`}
            />
          </Campo>
        </FormAccion>
      </section>

      <section className="mt-8 max-w-md tarjeta p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Invitaciones a clase de prueba</h2>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              webhookListo ? "bg-ok/10 text-ok" : "bg-alerta/10 text-alerta"
            }`}
          >
            {webhookListo ? "Configurado" : "Sin configurar"}
          </span>
        </div>
        <p className="mt-1 text-sm text-tinta-suave">
          El voucher lo arma y lo manda un sistema externo (n8n): acá va la
          URL de su webhook y el token de autenticación. Hasta completarlos,
          el botón «Enviar invitación» del CRM avisa que falta configurar.
        </p>
        <FormAccion
          accion={guardarWebhookInvitaciones}
          textoBoton="Guardar"
          variante="secundario"
          className="mt-3 grid gap-3"
        >
          <Campo etiqueta="URL del webhook">
            <Input
              name="url"
              type="url"
              inputMode="url"
              autoComplete="off"
              defaultValue={webhookUrl}
              placeholder="https://…/webhook/invitaciones"
            />
          </Campo>
          <div>
            <Campo etiqueta="Token de autenticación">
              <Input
                name="token"
                type="password"
                autoComplete="new-password"
                placeholder={
                  hayToken ? "•••••••• (hay uno guardado)" : "Pegá el token"
                }
              />
            </Campo>
            <p className="mt-1.5 text-xs text-tinta-suave">
              {hayToken
                ? "Hay un token guardado y no se vuelve a mostrar. Dejá el campo en blanco para conservarlo, o pegá uno nuevo para reemplazarlo."
                : "Se guarda de forma segura y no se vuelve a mostrar."}
              {" "}Borrá la URL y guardá para desconfigurar todo.
            </p>
          </div>
        </FormAccion>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-tinta-suave">
          Sedes
        </h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {sedes.map((sede) => (
            <li
              key={sede.id}
              className="tarjeta p-4"
            >
              <p className="font-semibold">{sede.nombre}</p>
              <FormAccion
                accion={guardarDireccionSede}
                textoBoton="Guardar"
                variante="secundario"
                className="mt-2"
              >
                <input type="hidden" name="sedeId" value={sede.id} />
                <Campo etiqueta="Dirección">
                  <Input
                    name="direccion"
                    required
                    defaultValue={sede.direccion ?? ""}
                    placeholder="Calle y número, localidad"
                  />
                </Campo>
                <p className="mt-1.5 text-xs text-tinta-suave">
                  Aparece en la invitación a la clase de prueba.
                </p>
              </FormAccion>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-tinta-suave">
          Usuarios
        </h2>
        <div className="mt-3 overflow-x-auto tarjeta">
          <table className="w-full min-w-130 text-left text-sm">
            <thead>
              <tr className="border-b border-borde text-xs uppercase tracking-wide text-tinta-suave">
                <th className="px-4 py-3 font-semibold">Nombre</th>
                <th className="px-4 py-3 font-semibold">Rol</th>
                <th className="px-4 py-3 font-semibold">Sede</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody>
              {listaUsuarios.map((u) => (
                <tr key={u.id} className="border-b border-borde last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium">{u.nombre}</p>
                    <p className="text-xs text-tinta-suave">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">{ETIQUETA_ROL[u.rol] ?? u.rol}</td>
                  <td className="px-4 py-3">{nombreSede(u.sedeId)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        u.activo
                          ? "bg-ok/10 text-ok"
                          : "bg-borde text-tinta-suave"
                      }`}
                    >
                      {u.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-tinta-suave">
          El alta de usuarios se hace por ahora con la administración del
          sistema (ver README); la pantalla de alta llega con las próximas
          fases.
        </p>
      </section>
    </div>
  );
}
