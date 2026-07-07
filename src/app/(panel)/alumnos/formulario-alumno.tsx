import type { Alumno } from "@/db/schema";
import { InputFecha } from "@/componentes/campo-fecha";
import { Campo, Input } from "@/componentes/campos";
import { FormAccion } from "@/componentes/form-accion";
import { crearAlumno, editarAlumno } from "./acciones";

// Ficha mínima definitiva (PLAN.md §2): DNI, nombre, apellido, email,
// fecha de nacimiento, teléfono/WhatsApp, sede.
export function FormularioAlumno({
  sedeId,
  alumno,
}: {
  sedeId: number;
  alumno?: Alumno;
}) {
  return (
    <FormAccion
      accion={alumno ? editarAlumno : crearAlumno}
      textoBoton={alumno ? "Guardar cambios" : "Crear alumno"}
      className="mt-6 grid max-w-xl gap-4 sm:grid-cols-2"
    >
      <input type="hidden" name="sedeId" value={sedeId} />
      {alumno ? <input type="hidden" name="alumnoId" value={alumno.id} /> : null}
      <Campo etiqueta="Nombre">
        <Input
          name="nombre"
          required
          defaultValue={alumno?.nombre}
          placeholder="María"
        />
      </Campo>
      <Campo etiqueta="Apellido">
        <Input
          name="apellido"
          required
          defaultValue={alumno?.apellido}
          placeholder="Pérez"
        />
      </Campo>
      <Campo etiqueta="DNI (sin puntos)">
        <Input
          name="dni"
          required
          inputMode="numeric"
          defaultValue={alumno?.dni}
          placeholder="40123456"
        />
      </Campo>
      <Campo etiqueta="Teléfono / WhatsApp">
        <Input
          name="telefono"
          required
          inputMode="tel"
          defaultValue={alumno?.telefono}
          placeholder="381 555 0000"
        />
      </Campo>
      <Campo etiqueta="Email (opcional)">
        <Input
          name="email"
          type="email"
          defaultValue={alumno?.email ?? ""}
          placeholder="maria@gmail.com"
        />
      </Campo>
      <Campo etiqueta="Fecha de nacimiento (opcional)">
        <InputFecha
          name="fechaNacimiento"
          defaultValue={alumno?.fechaNacimiento}
        />
      </Campo>
    </FormAccion>
  );
}
