import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  calculateNightPrices,
  type ApplicablePriceRule,
} from "@/lib/server/pricing/calculate";

const base = new Prisma.Decimal(100);

function utc(iso: string) {
  return new Date(`${iso}T00:00:00Z`);
}

function rule(overrides: Partial<ApplicablePriceRule>): ApplicablePriceRule {
  return {
    name: "regra",
    startDate: utc("2026-01-01"),
    endDate: utc("2026-12-31"),
    daysOfWeek: [],
    multiplier: new Prisma.Decimal("1.5"),
    ...overrides,
  };
}

describe("calculateNightPrices", () => {
  it("sem regras: total é base × número de noites (checkout exclusivo)", () => {
    const { total, nights } = calculateNightPrices(
      base,
      [],
      utc("2026-03-10"),
      utc("2026-03-13"),
    );
    expect(nights).toHaveLength(3);
    expect(total.toFixed(2)).toBe("300.00");
    expect(nights.every((n) => n.appliedRules.length === 0)).toBe(true);
  });

  it("aplica multiplicador de uma regra vigente", () => {
    const { total, nights } = calculateNightPrices(
      base,
      [rule({ name: "alta temporada" })],
      utc("2026-03-10"),
      utc("2026-03-12"),
    );
    expect(total.toFixed(2)).toBe("300.00");
    expect(nights[0].appliedRules).toEqual(["alta temporada"]);
  });

  it("regras sobrepostas multiplicam em sequência, não somam", () => {
    const { nights } = calculateNightPrices(
      base,
      [
        rule({ name: "a", multiplier: new Prisma.Decimal("1.5") }),
        rule({ name: "b", multiplier: new Prisma.Decimal("2") }),
      ],
      utc("2026-03-10"),
      utc("2026-03-11"),
    );
    // 100 × 1.5 × 2 = 300 (e não 100 × (1.5 + 2))
    expect(nights[0].price.toFixed(2)).toBe("300.00");
    expect(nights[0].appliedRules).toEqual(["a", "b"]);
  });

  it("daysOfWeek restringe a regra aos dias recorrentes (fim de semana)", () => {
    // 2026-03-13 é sexta (5) e 2026-03-14 é sábado (6); 15 é domingo.
    const weekend = rule({
      name: "fim de semana",
      daysOfWeek: [5, 6],
      multiplier: new Prisma.Decimal("2"),
    });
    const { nights } = calculateNightPrices(
      base,
      [weekend],
      utc("2026-03-12"),
      utc("2026-03-16"),
    );
    expect(nights.map((n) => n.price.toFixed(2))).toEqual([
      "100.00", // qui
      "200.00", // sex
      "200.00", // sáb
      "100.00", // dom
    ]);
  });

  it("vigência: startDate e endDate são inclusivos, fora dela não aplica", () => {
    const bloco = rule({
      name: "carnaval",
      startDate: utc("2026-03-11"),
      endDate: utc("2026-03-12"),
      multiplier: new Prisma.Decimal("3"),
    });
    const { nights } = calculateNightPrices(
      base,
      [bloco],
      utc("2026-03-10"),
      utc("2026-03-14"),
    );
    expect(nights.map((n) => n.price.toFixed(2))).toEqual([
      "100.00", // 10 — antes
      "300.00", // 11 — início inclusivo
      "300.00", // 12 — fim inclusivo
      "100.00", // 13 — depois
    ]);
  });

  it("estadia de zero noites: total zero e nenhuma noite", () => {
    const { total, nights } = calculateNightPrices(
      base,
      [],
      utc("2026-03-10"),
      utc("2026-03-10"),
    );
    expect(nights).toHaveLength(0);
    expect(total.toFixed(2)).toBe("0.00");
  });
});
