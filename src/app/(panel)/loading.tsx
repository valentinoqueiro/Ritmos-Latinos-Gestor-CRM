// Esqueleto de carga del panel: Next lo muestra al instante al navegar entre
// secciones, mientras el servidor consulta la base. Imita banner + cards.
export default function CargandoSeccion() {
  return (
    <div aria-busy="true" aria-label="Cargando sección" className="animate-pulse">
      <div className="banner-seccion px-5 py-6 sm:px-7 sm:py-7">
        <div className="h-9 w-56 max-w-full rounded-lg bg-white/15 sm:h-12" />
        <div className="mt-3 h-4 w-72 max-w-full rounded bg-white/10" />
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="tarjeta h-44" />
        <div className="tarjeta h-44" />
      </div>
      <div className="tarjeta mt-4 h-28" />
    </div>
  );
}
