import type { Gasto } from "@/db/schema";
import { hoyISO } from "@/lib/fechas";
import { Campo, Input, Select } from "@/componentes/campos";

export function FormularioCampos({
  sedes,
  categorias,
  gasto,
}: {
  sedes: { id: number; nombre: string }[];
  categorias: { id: number; nombre: string }[];
  gasto?: Gasto;
}) {
  return (
    <>
      <Campo etiqueta="Sede">
        <Select name="sedeId" required defaultValue={gasto?.sedeId}>
          {sedes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </Select>
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Tipo">
          <Select name="tipo" required defaultValue={gasto?.tipo ?? "fijo"}>
            <option value="fijo">Fijo</option>
            <option value="variable">Variable</option>
          </Select>
        </Campo>
        <Campo etiqueta="Categoría">
          <Select name="categoriaId" required defaultValue={gasto?.categoriaId}>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </Select>
        </Campo>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Monto ($)">
          <Input
            name="monto"
            inputMode="numeric"
            required
            defaultValue={gasto ? Number(gasto.monto) : undefined}
          />
        </Campo>
        <Campo etiqueta="Fecha">
          <Input
            name="fecha"
            type="date"
            required
            defaultValue={gasto?.fecha ?? hoyISO()}
          />
        </Campo>
      </div>
      <Campo etiqueta="Descripción (opcional)">
        <Input
          name="descripcion"
          defaultValue={gasto?.descripcion ?? ""}
          placeholder="Ej.: alquiler julio"
        />
      </Campo>
    </>
  );
}
