"use client";

import {
  IconHome2,
  IconMessageCircle2,
  IconUserCircle,
} from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Início", icon: IconHome2 },
  { href: "/mensagens", label: "Mensagens", icon: IconMessageCircle2 },
  { href: "/perfil", label: "Perfil", icon: IconUserCircle },
];

// Bottom navigation fixo (design-ui-ux.md, seção 3.6) — área pública, mobile.
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-border bg-surface">
      {ITEMS.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-caption ${
              active ? "text-accent" : "text-text-secondary"
            }`}
          >
            <Icon size={22} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
