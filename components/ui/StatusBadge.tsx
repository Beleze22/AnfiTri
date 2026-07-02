// Código de cores de status global (design-ui-ux.md, seção 3.2) — usado de
// forma idêntica em todas as telas (hóspede e gestor). Único componente,
// reaproveitado em vez de recriado por tela.
export type BookingStatusLabel =
  | "pendente"
  | "confirmado"
  | "cancelado"
  | "expirado"
  | "concluido"
  | "airbnb";

const STYLES: Record<
  BookingStatusLabel,
  { badgeClass: string; dotClass: string; label: string }
> = {
  pendente: {
    badgeClass: "bg-amber-light text-amber",
    dotClass: "bg-amber",
    label: "Pendente",
  },
  confirmado: {
    badgeClass: "bg-green-light text-green",
    dotClass: "bg-green",
    label: "Confirmado",
  },
  cancelado: {
    badgeClass: "bg-border text-text-secondary",
    dotClass: "bg-text-secondary",
    label: "Cancelado",
  },
  expirado: {
    badgeClass: "bg-border text-text-secondary",
    dotClass: "bg-text-secondary",
    label: "Expirado",
  },
  concluido: {
    badgeClass: "bg-border text-text-secondary",
    dotClass: "bg-text-secondary",
    label: "Concluído",
  },
  // Indicador de origem (não de status) usado no calendário consolidado do
  // gestor (Etapa 6) — incluído aqui desde já para não duplicar o mapa de
  // cores em outro componente.
  airbnb: {
    badgeClass: "bg-blue-light text-blue",
    dotClass: "bg-blue",
    label: "Airbnb",
  },
};

export function StatusBadge({
  status,
  label,
}: {
  status: BookingStatusLabel;
  label?: string;
}) {
  const style = STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-caption font-medium ${style.badgeClass}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dotClass}`} />
      {label ?? style.label}
    </span>
  );
}
