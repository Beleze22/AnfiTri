import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/client";

export type NightPrice = {
  date: Date;
  price: Prisma.Decimal;
  appliedRules: string[];
};

export type StayPrice = {
  total: Prisma.Decimal;
  nights: NightPrice[];
};

// Subconjunto de PriceRule que o cálculo precisa — mantido estrutural para a
// função pura ser testável sem banco e reutilizável em lote (vitrine).
export type ApplicablePriceRule = {
  name: string;
  startDate: Date;
  endDate: Date;
  daysOfWeek: number[];
  multiplier: Prisma.Decimal;
};

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function isRuleApplicable(rule: ApplicablePriceRule, date: Date): boolean {
  if (date < rule.startDate || date > rule.endDate) return false;
  if (rule.daysOfWeek.length === 0) return true;
  return rule.daysOfWeek.includes(date.getUTCDay());
}

// Seção 5 da arquitetura: "preço final... é o base_price multiplicado pelas
// PriceRule aplicáveis" — lido literalmente como multiplicação sequencial de
// todas as regras que se aplicam ao dia (não soma de percentuais).
export function calculateNightPrices(
  basePrice: Prisma.Decimal,
  rules: ApplicablePriceRule[],
  checkIn: Date,
  checkOut: Date,
): StayPrice {
  const nights: NightPrice[] = [];
  let total = new Prisma.Decimal(0);

  for (let date = checkIn; date < checkOut; date = addDays(date, 1)) {
    const appliedRules = rules.filter((rule) => isRuleApplicable(rule, date));
    const multiplier = appliedRules.reduce(
      (acc, rule) => acc.mul(rule.multiplier),
      new Prisma.Decimal(1),
    );
    const price = basePrice.mul(multiplier);

    nights.push({
      date: new Date(date),
      price,
      appliedRules: appliedRules.map((rule) => rule.name),
    });
    total = total.add(price);
  }

  return { total, nights };
}

export async function calculatePriceForStay(
  propertyId: string,
  checkIn: Date,
  checkOut: Date,
): Promise<StayPrice> {
  const property = await prisma.property.findUniqueOrThrow({
    where: { id: propertyId },
  });

  const rules = await prisma.priceRule.findMany({
    where: {
      propertyId,
      startDate: { lte: checkOut },
      endDate: { gte: checkIn },
    },
  });

  return calculateNightPrices(property.basePrice, rules, checkIn, checkOut);
}
