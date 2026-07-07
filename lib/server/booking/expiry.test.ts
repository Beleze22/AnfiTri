import { describe, expect, it } from "vitest";

import {
  calculateExpiresAt,
  type ExpiryConfig,
} from "@/lib/server/booking/expiry";

// Horários de silêncio são hora local de São Paulo (UTC-3, sem DST),
// guardados como time-of-day em campos @db.Time (época 1970 em UTC).
function timeOfDay(hours: number, minutes = 0): Date {
  return new Date(Date.UTC(1970, 0, 1, hours, minutes));
}

const config: ExpiryConfig = {
  defaultExpiryHours: 6,
  quietHoursStart: timeOfDay(22),
  quietHoursEnd: timeOfDay(7),
  gracePeriodHours: 2,
};

describe("calculateExpiresAt", () => {
  it("fora da janela de silêncio: created_at + horas de expiração", () => {
    // 12:00 SP + 6h = 18:00 SP — fora de 22:00–07:00.
    const createdAt = new Date("2026-03-10T15:00:00Z");
    expect(calculateExpiresAt(createdAt, config)).toEqual(
      new Date("2026-03-10T21:00:00Z"),
    );
  });

  it("candidato na madrugada (antes do fim da janela): empurra para fim + tolerância no mesmo dia", () => {
    // 22:00 SP + 6h = 04:00 SP do dia 11 → 07:00 SP do dia 11 + 2h = 09:00 SP.
    const createdAt = new Date("2026-03-11T01:00:00Z");
    expect(calculateExpiresAt(createdAt, config)).toEqual(
      new Date("2026-03-11T12:00:00Z"),
    );
  });

  it("candidato à noite (depois do início da janela): empurra para o fim no dia seguinte", () => {
    // 17:00 SP + 6h = 23:00 SP do dia 10 → 07:00 SP do dia 11 + 2h = 09:00 SP.
    const createdAt = new Date("2026-03-10T20:00:00Z");
    expect(calculateExpiresAt(createdAt, config)).toEqual(
      new Date("2026-03-11T12:00:00Z"),
    );
  });

  it("janela que não cruza a meia-noite", () => {
    // Janela 13:00–15:00; candidato 14:00 SP → 15:00 SP + 2h = 17:00 SP.
    const daytimeConfig: ExpiryConfig = {
      ...config,
      quietHoursStart: timeOfDay(13),
      quietHoursEnd: timeOfDay(15),
    };
    const createdAt = new Date("2026-03-10T11:00:00Z");
    expect(calculateExpiresAt(createdAt, daytimeConfig)).toEqual(
      new Date("2026-03-10T20:00:00Z"),
    );
  });

  it("início igual ao fim desativa a janela de silêncio", () => {
    const disabledConfig: ExpiryConfig = {
      ...config,
      quietHoursStart: timeOfDay(22),
      quietHoursEnd: timeOfDay(22),
    };
    // 22:00 SP + 6h = 04:00 SP — cairia na janela, mas ela está desativada.
    const createdAt = new Date("2026-03-11T01:00:00Z");
    expect(calculateExpiresAt(createdAt, disabledConfig)).toEqual(
      new Date("2026-03-11T07:00:00Z"),
    );
  });
});
