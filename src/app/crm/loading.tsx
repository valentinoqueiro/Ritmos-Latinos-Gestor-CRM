// Esqueleto de carga del CRM: feedback inmediato al entrar desde el gestor.
export default function CargandoCrm() {
  return (
    <div aria-busy="true" aria-label="Cargando CRM" className="animate-pulse">
      <div className="banner-seccion px-5 py-6 sm:px-7 sm:py-7">
        <div className="h-9 w-56 max-w-full rounded-lg bg-white/15 sm:h-12" />
        <div className="mt-3 h-4 w-72 max-w-full rounded bg-white/10" />
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="tarjeta h-40" />
        <div className="tarjeta h-40" />
        <div className="tarjeta h-40" />
      </div>
    </div>
  );
}
