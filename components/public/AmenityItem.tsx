import {
  IconCircleCheck,
  IconParking,
  IconPool,
  IconWifi,
} from "@tabler/icons-react";

const ICONS: Record<string, typeof IconWifi> = {
  wifi: IconWifi,
  pool: IconPool,
  parking: IconParking,
};

// Grade de comodidades (design-ui-ux.md, seção 4.2) — ícone + label, 2
// colunas. `icon` vem do cadastro do gestor (Etapa 6); ícones não mapeados
// caem num genérico em vez de quebrar a tela.
export function AmenityItem({ name, icon }: { name: string; icon: string }) {
  const Icon = ICONS[icon] ?? IconCircleCheck;
  return (
    <div className="flex items-center gap-2 text-body text-text-primary">
      <Icon size={18} className="text-text-secondary" />
      {name}
    </div>
  );
}
