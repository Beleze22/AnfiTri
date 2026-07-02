import { getZonedParts, zonedTimeToUtc } from "@/lib/server/timezone";

export type ExpiryConfig = {
  defaultExpiryHours: number;
  quietHoursStart: Date;
  quietHoursEnd: Date;
  gracePeriodHours: number;
};

function timeOfDayMinutes(date: Date): number {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

function isInQuietWindow(
  minutes: number,
  startMinutes: number,
  endMinutes: number,
): boolean {
  if (startMinutes === endMinutes) return false;
  if (startMinutes < endMinutes) {
    return minutes >= startMinutes && minutes < endMinutes;
  }
  // Janela cruza a meia-noite (ex: 22:00–07:00).
  return minutes >= startMinutes || minutes < endMinutes;
}

// Algoritmo da seção 6.2 da arquitetura:
// 1. created_at + default_expiry_hours.
// 2. Se cair na janela de silêncio, substitui por quiet_hours_end + grace_period_hours.
// 3. Caso contrário, mantém o valor do passo 1.
export function calculateExpiresAt(
  createdAt: Date,
  config: ExpiryConfig,
): Date {
  const candidateUtc = new Date(
    createdAt.getTime() + config.defaultExpiryHours * 60 * 60 * 1000,
  );

  const candidateParts = getZonedParts(candidateUtc);
  const candidateMinutes = candidateParts.hour * 60 + candidateParts.minute;
  const startMinutes = timeOfDayMinutes(config.quietHoursStart);
  const endMinutes = timeOfDayMinutes(config.quietHoursEnd);

  if (!isInQuietWindow(candidateMinutes, startMinutes, endMinutes)) {
    return candidateUtc;
  }

  const crossesMidnight = startMinutes > endMinutes;
  const quietEndIsSameDay = !crossesMidnight || candidateMinutes < endMinutes;
  const anchorDay = quietEndIsSameDay
    ? candidateParts.day
    : candidateParts.day + 1;

  const quietEndUtc = zonedTimeToUtc(
    candidateParts.year,
    candidateParts.month,
    anchorDay,
    config.quietHoursEnd.getUTCHours(),
    config.quietHoursEnd.getUTCMinutes(),
  );

  return new Date(
    quietEndUtc.getTime() + config.gracePeriodHours * 60 * 60 * 1000,
  );
}
