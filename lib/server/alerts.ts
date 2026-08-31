import type { AlertKind } from "@prisma/client";

import { prisma } from "@/lib/db/client";

// Alertas de integração — o que os jobs detectam mas não podem decidir
// sozinhos. Deliberadamente não automatizamos: cancelar reserva a partir de
// um feed que pode ter falhado, ou criar reserva a partir de um e-mail que
// não conseguimos identificar, é agir com base em sinal incerto.

// Cria o alerta a menos que o mesmo problema já esteja aberto — os crons
// rodam a cada 10 min / 1 h e sem isso o painel encheria de repetições.
export async function raiseAlert(input: {
  kind: AlertKind;
  title: string;
  detail: string;
  dedupeKey: string;
  bookingId?: string;
}) {
  const existing = await prisma.alert.findFirst({
    where: { dedupeKey: input.dedupeKey, resolvedAt: null },
    select: { id: true },
  });
  if (existing) return null;

  return prisma.alert.create({
    data: {
      kind: input.kind,
      title: input.title,
      detail: input.detail,
      dedupeKey: input.dedupeKey,
      bookingId: input.bookingId,
    },
  });
}

// Fecha alertas abertos de uma causa. Usado quando o próprio sistema percebe
// que o problema passou — ex: a reserva voltou a aparecer no feed do Airbnb,
// então a divergência era transitória e não precisa incomodar o gestor.
export async function resolveAlertsByKey(dedupeKey: string) {
  const { count } = await prisma.alert.updateMany({
    where: { dedupeKey, resolvedAt: null },
    data: { resolvedAt: new Date() },
  });
  return count;
}

export function listOpenAlerts() {
  return prisma.alert.findMany({
    where: { resolvedAt: null },
    include: {
      booking: {
        include: { property: { select: { title: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export function countOpenAlerts() {
  return prisma.alert.count({ where: { resolvedAt: null } });
}

export async function resolveAlert(id: string) {
  const { count } = await prisma.alert.updateMany({
    where: { id, resolvedAt: null },
    data: { resolvedAt: new Date() },
  });
  return count > 0;
}
