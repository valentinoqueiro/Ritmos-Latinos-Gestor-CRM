// Campos de formulario con el estilo de la casa (server components).

export function Campo({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{etiqueta}</span>
      {children}
    </label>
  );
}

export const claseInput =
  "h-11 rounded-lg border border-borde bg-superficie px-3 text-base outline-none transition focus:border-marca focus:ring-2 focus:ring-marca/20";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${claseInput} ${props.className ?? ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`${claseInput} ${props.className ?? ""}`}
    />
  );
}
