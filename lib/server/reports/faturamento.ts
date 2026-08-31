import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/client";

// Relatório de faturamento por período e por hospedagem.
//
// Duas decisões de produto que moldam tudo aqui:
//
// 1. A receita é atribuída ao MÊS DO CHECK-IN, inteira, sem rateio por noite.
//    Uma estadia de 28/set a 3/out conta toda em setembro. É mais simples de
//    explicar ao gestor; em compensação não fecha exatamente com a taxa de
//    ocupação do dashboard, que rateia as noites.
//
// 2. Bruto, taxa e líquido aparecem lado a lado. O Airbnb retém mais de 18%,
//    então relatório que só mostra o bruto dá a impressão errada de quanto
//    entrou — e a comparação entre origens é justamente o argumento para o
//    gestor priorizar reserva direta.

const ZERO = new Prisma.Decimal(0);

export type LinhaFaturamento = {
  chave: string;
  rotulo: string;
  reservas: number;
  noites: number;
  bruto: string;
  taxa: string;
  liquido: string;
};

const ROTULO_ORIGEM: Record<string, string> = {
  site: "Reserva direta",
  manual: "Lançada pelo gestor",
  airbnb: "Airbnb",
};

function noitesDe(checkIn: Date, checkOut: Date) {
  return Math.max(
    0,
    Math.round((checkOut.getTime() - checkIn.getTime()) / 86_400_000),
  );
}

type Acumulado = {
  reservas: number;
  noites: number;
  bruto: Prisma.Decimal;
  taxa: Prisma.Decimal;
  liquido: Prisma.Decimal;
};

function novoAcumulado(): Acumulado {
  return { reservas: 0, noites: 0, bruto: ZERO, taxa: ZERO, liquido: ZERO };
}

function serializar(
  chave: string,
  rotulo: string,
  a: Acumulado,
): LinhaFaturamento {
  return {
    chave,
    rotulo,
    reservas: a.reservas,
    noites: a.noites,
    bruto: a.bruto.toFixed(2),
    taxa: a.taxa.toFixed(2),
    liquido: a.liquido.toFixed(2),
  };
}

export async function getFaturamento(
  inicio: Date,
  fim: Date,
  propertyId?: string,
) {
  const bookings = await prisma.booking.findMany({
    // Só reserva firme entra: pendente pode expirar, cancelada e expirada não
    // geraram receita.
    where: {
      status: "confirmado",
      checkIn: { gte: inicio, lt: fim },
      ...(propertyId ? { propertyId } : {}),
    },
    include: { property: { select: { id: true, title: true } } },
    orderBy: { checkIn: "asc" },
  });

  const porHospedagem = new Map<string, Acumulado & { rotulo: string }>();
  const porOrigem = new Map<string, Acumulado>();
  const total = novoAcumulado();
  let semValor = 0;

  for (const b of bookings) {
    const bruto = b.totalPrice ?? ZERO;
    // Nulo é ausência de retenção conhecida, não retenção zero declarada:
    // reserva do site sem Stripe não tem taxa a apurar, e a do Airbnb só tem
    // valor se o e-mail trouxe o desdobramento.
    const taxa = b.platformFee ?? ZERO;
    const liquido = b.netAmount ?? bruto.minus(taxa);
    const noites = noitesDe(b.checkIn, b.checkOut);

    if (!b.totalPrice) semValor += 1;

    for (const acc of [
      porHospedagem.get(b.property.id) ??
        (() => {
          const novo = { ...novoAcumulado(), rotulo: b.property.title };
          porHospedagem.set(b.property.id, novo);
          return novo;
        })(),
      porOrigem.get(b.source) ??
        (() => {
          const novo = novoAcumulado();
          porOrigem.set(b.source, novo);
          return novo;
        })(),
      total,
    ]) {
      acc.reservas += 1;
      acc.noites += noites;
      acc.bruto = acc.bruto.plus(bruto);
      acc.taxa = acc.taxa.plus(taxa);
      acc.liquido = acc.liquido.plus(liquido);
    }
  }

  const diariaMedia =
    total.noites > 0 ? total.liquido.div(total.noites).toFixed(2) : "0.00";

  const ocupacao = await calcularOcupacao(inicio, fim, propertyId);

  return {
    inicio: inicio.toISOString().slice(0, 10),
    fim: fim.toISOString().slice(0, 10),
    total: serializar("total", "Total", total),
    diariaMedia,
    ocupacao,
    // Reservas sem valor registrado — hoje as do Airbnb anteriores à captura
    // financeira. Exposto para o relatório poder avisar em vez de fingir que
    // o faturamento é zero.
    reservasSemValor: semValor,
    porHospedagem: [...porHospedagem.entries()]
      .map(([id, a]) => serializar(id, a.rotulo, a))
      .sort((a, b) => Number(b.liquido) - Number(a.liquido)),
    porOrigem: [...porOrigem.entries()]
      .map(([origem, a]) =>
        serializar(origem, ROTULO_ORIGEM[origem] ?? origem, a),
      )
      .sort((a, b) => Number(b.liquido) - Number(a.liquido)),
  };
}

// Ocupação conta as noites que caem DENTRO do período, recortando estadias
// que atravessam a borda. Difere de propósito do critério da receita, que
// atribui tudo ao mês do check-in: somar receita de fora do mês e dividir por
// noites de dentro daria diária média sem sentido. Mesmo cálculo que o
// dashboard já usa, para os dois números baterem entre si.
async function calcularOcupacao(inicio: Date, fim: Date, propertyId?: string) {
  const [imoveis, estadias] = await Promise.all([
    prisma.property.count({
      where: propertyId ? { id: propertyId } : { status: { not: "rascunho" } },
    }),
    prisma.booking.findMany({
      where: {
        status: "confirmado",
        checkIn: { lt: fim },
        checkOut: { gt: inicio },
        ...(propertyId ? { propertyId } : {}),
      },
      select: { checkIn: true, checkOut: true },
    }),
  ]);

  const diasNoPeriodo = Math.round(
    (fim.getTime() - inicio.getTime()) / 86_400_000,
  );
  const disponiveis = imoveis * diasNoPeriodo;
  if (disponiveis <= 0)
    return { percentual: 0, noitesOcupadas: 0, noitesDisponiveis: 0 };

  const noitesOcupadas = estadias.reduce((soma, e) => {
    const de = e.checkIn < inicio ? inicio : e.checkIn;
    const ate = e.checkOut > fim ? fim : e.checkOut;
    return soma + noitesDe(de, ate);
  }, 0);

  return {
    percentual: Math.round((noitesOcupadas / disponiveis) * 100),
    noitesOcupadas,
    noitesDisponiveis: disponiveis,
  };
}

// Doze meses terminando no mês de referência — alimenta o gráfico de
// evolução, com o mesmo critério de atribuição (mês do check-in).
export async function getEvolucaoMensal(
  referencia: Date,
  meses = 12,
  propertyId?: string,
) {
  const fim = new Date(
    Date.UTC(referencia.getUTCFullYear(), referencia.getUTCMonth() + 1, 1),
  );
  const inicio = new Date(
    Date.UTC(fim.getUTCFullYear(), fim.getUTCMonth() - meses, 1),
  );

  const bookings = await prisma.booking.findMany({
    where: {
      status: "confirmado",
      checkIn: { gte: inicio, lt: fim },
      ...(propertyId ? { propertyId } : {}),
    },
    select: {
      checkIn: true,
      totalPrice: true,
      platformFee: true,
      netAmount: true,
    },
  });

  const porMes = new Map<string, Prisma.Decimal>();
  for (let i = 0; i < meses; i += 1) {
    const d = new Date(
      Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + i, 1),
    );
    porMes.set(d.toISOString().slice(0, 7), ZERO);
  }

  for (const b of bookings) {
    const chave = b.checkIn.toISOString().slice(0, 7);
    if (!porMes.has(chave)) continue;
    const bruto = b.totalPrice ?? ZERO;
    const liquido = b.netAmount ?? bruto.minus(b.platformFee ?? ZERO);
    porMes.set(chave, porMes.get(chave)!.plus(liquido));
  }

  return [...porMes.entries()].map(([mes, valor]) => ({
    mes,
    liquido: valor.toFixed(2),
  }));
}
