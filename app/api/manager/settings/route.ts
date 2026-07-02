import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db/client";
import { apiError, requireSession } from "@/lib/server/http";

function timeToHHMM(date: Date) {
  return date.toISOString().slice(11, 16);
}

function hhmmToTime(value: string) {
  return new Date(`1970-01-01T${value}:00Z`);
}

export async function GET() {
  const session = await requireSession("gestor");
  if (!session) {
    return apiError("unauthorized", "Não autorizado.", 401);
  }

  const manager = await prisma.user.findUniqueOrThrow({
    where: { id: session.sub },
  });

  return NextResponse.json({
    defaultExpiryHours: manager.defaultExpiryHours ?? 6,
    quietHoursStart: manager.quietHoursStart
      ? timeToHHMM(manager.quietHoursStart)
      : "22:00",
    quietHoursEnd: manager.quietHoursEnd
      ? timeToHHMM(manager.quietHoursEnd)
      : "07:00",
    gracePeriodHours: manager.gracePeriodHours ?? 2,
  });
}

const settingsInput = z.object({
  defaultExpiryHours: z.coerce.number().int().min(1).max(72),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/),
  gracePeriodHours: z.coerce.number().int().min(0).max(24),
});

export async function PATCH(request: Request) {
  const session = await requireSession("gestor");
  if (!session) {
    return apiError("unauthorized", "Não autorizado.", 401);
  }

  const parsed = settingsInput.safeParse(await request.json());
  if (!parsed.success) {
    return apiError("invalid_input", "Dados inválidos.", 400);
  }

  const manager = await prisma.user.update({
    where: { id: session.sub },
    data: {
      defaultExpiryHours: parsed.data.defaultExpiryHours,
      quietHoursStart: hhmmToTime(parsed.data.quietHoursStart),
      quietHoursEnd: hhmmToTime(parsed.data.quietHoursEnd),
      gracePeriodHours: parsed.data.gracePeriodHours,
    },
  });

  return NextResponse.json({
    defaultExpiryHours: manager.defaultExpiryHours,
    quietHoursStart: timeToHHMM(manager.quietHoursStart!),
    quietHoursEnd: timeToHHMM(manager.quietHoursEnd!),
    gracePeriodHours: manager.gracePeriodHours,
  });
}
