import { describe, expect, it } from "vitest";

import { parseAirbnbEmail } from "@/lib/server/airbnb/email-parser";

// As fixtures reproduzem a ESTRUTURA dos e-mails reais do Airbnb (rótulo numa
// linha, valor na seguinte; mês abreviado com ponto; datas de confirmação sem
// ano), com nomes de hóspede e códigos trocados — o formato é o que precisa
// ser testado, não os dados de quem reservou.

const CONFIRMACAO = `
[image: Airbnb]
Nova reserva confirmada! Fulano chega em 29 de ago..
Envie uma mensagem para confirmar as informações de check-in.
Fulano de Tal
Identificação verificada · 2 comentários
São Paulo, Brasil
[image: MT07 | Studio Garden c/ Jardim | 5min Barra Funda]
MT07 | Studio Garden c/ Jardim | 5min Barra Funda
Casa/apto inteiro
Check-in
sáb., 29 de ago.
15:00
Checkout
dom., 30 de ago.
12:00
Hóspedes
1 adulto
O hóspede pagou
R$ 250,00 x 1 noite
R$ 250,00
Taxa de limpeza para estadias curtas
R$ 140,00
Taxa de serviço do hóspede
R$ 0,00
Total (BRL)
R$ 390,00
Pagamento do anfitrião
Preço da acomodação para 1 noite
R$ 250,00
Taxa de limpeza para estadias curtas
R$ 140,00
Taxa de serviço do anfitrião (16.0% + IVA)
-R$ 71,03
R$ 318,97
Código de confirmação
HMRZRPYKJW
<https://www.airbnb.com.br/hosting/reservations/details/HMRZRPYKJW?isPending=true>
`;

const CANCELAMENTO = `
[image: Airbnb]
Reserva cancelada
<https://www.airbnb.com.br/hosting/reservations/details/HMS59KPA92?email_cta=link>
APTO 37 MITZ · MT37 | Confortável e Completo Barra Funda/Pacaembu
23 – 27 de out., 3 hóspedes
A reserva HMS59KPA92 de 23 – 27 de out.. Seu calendário foi atualizado, e essas
datas voltaram a ficar disponíveis.
`;

const ALTERACAO = `
[image: Airbnb]
Beltrana quer alterar a sua reserva
Beltrana
São Paulo
APTO 37 MITZ · MT37 | Confortável e Completo Barra Funda/Pacaembu
Datas Originais
29 de ago. de 2026 - 30 de ago. de 2026
Datas Solicitadas
29 de ago. de 2026 - 31 de ago. de 2026
Se você aceitar o pedido de Beltrana, nós vamos atualizar sua reserva
imediatamente. Se você decidir recusar, a reserva permanecerá inalterada.
<https://www.airbnb.com.br/hosting/reservations/details/HMKKQ3W7ZP>
`;

const iso = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;

describe("parseAirbnbEmail — confirmação", () => {
  const r = parseAirbnbEmail(
    CONFIRMACAO,
    "Reserva confirmada - Fulano de Tal chega em 29 de ago.",
  );

  it("reconhece o tipo", () => {
    expect(r.tipo).toBe("confirmacao");
  });

  it("lê o código de confirmação do rótulo em linha separada", () => {
    expect(r.airbnbRef).toBe("HMRZRPYKJW");
  });

  it("lê entrada e saída, cujos valores vêm na linha seguinte ao rótulo", () => {
    // Sem ano no e-mail: 29 e 30 de agosto do ano corrente ou do seguinte,
    // conforme já tenham passado.
    expect(iso(r.checkIn)).toMatch(/^\d{4}-08-29$/);
    expect(iso(r.checkOut)).toMatch(/^\d{4}-08-30$/);
  });

  it("não confunde o horário (15:00) com data", () => {
    expect(iso(r.checkIn)).not.toBeNull();
    expect(r.checkOut!.getTime()).toBeGreaterThan(r.checkIn!.getTime());
  });
});

describe("parseAirbnbEmail — cancelamento", () => {
  const r = parseAirbnbEmail(
    CANCELAMENTO,
    "Cancelado: reserva HMS59KPA92 de 23 – 27 de outubro",
  );

  it("reconhece o tipo", () => {
    expect(r.tipo).toBe("cancelamento");
  });

  it("tira o código do assunto ou da URL", () => {
    expect(r.airbnbRef).toBe("HMS59KPA92");
  });

  it("entende intervalo de dias com mês compartilhado", () => {
    expect(iso(r.checkIn)).toMatch(/^\d{4}-10-23$/);
    expect(iso(r.checkOut)).toMatch(/^\d{4}-10-27$/);
  });
});

describe("parseAirbnbEmail — alteração", () => {
  const r = parseAirbnbEmail(ALTERACAO, "Beltrana quer alterar a sua reserva");

  it("reconhece o tipo", () => {
    expect(r.tipo).toBe("alteracao");
  });

  it("devolve as datas ORIGINAIS, que identificam a reserva registrada", () => {
    expect(iso(r.checkIn)).toBe("2026-08-29");
    expect(iso(r.checkOut)).toBe("2026-08-30");
  });

  it("pega o código pela URL, já que não há rótulo no corpo", () => {
    expect(r.airbnbRef).toBe("HMKKQ3W7ZP");
  });
});

describe("extração de código — só fontes estruturadas", () => {
  it("não inventa código a partir de sigla com números no texto", () => {
    const r = parseAirbnbEmail(
      "Hóspede: Fulano\nEndereço: Rua das Flores, AP1204\nCheck-in\n10 de março de 2027\nCheckout\n12 de março de 2027",
      "Reserva confirmada",
    );
    expect(r.airbnbRef).toBeNull();
  });

  it("aceita o formato antigo com dois-pontos na mesma linha", () => {
    const r = parseAirbnbEmail(
      "Código de confirmação: HMJKA5R4B4\nCheck-in: 1 de julho de 2027\nCheckout: 4 de julho de 2027",
      "Reserva confirmada",
    );
    expect(r.airbnbRef).toBe("HMJKA5R4B4");
    expect(iso(r.checkIn)).toBe("2027-07-01");
    expect(iso(r.checkOut)).toBe("2027-07-04");
  });
});

describe("datas em português", () => {
  it("lê todos os meses por extenso com o ano explícito", () => {
    const meses = [
      "janeiro",
      "fevereiro",
      "março",
      "abril",
      "maio",
      "junho",
      "julho",
      "agosto",
      "setembro",
      "outubro",
      "novembro",
      "dezembro",
    ];
    for (const [i, mes] of meses.entries()) {
      const r = parseAirbnbEmail(
        `Check-in\n10 de ${mes} de 2027\nCheckout\n12 de ${mes} de 2027`,
        "Reserva confirmada",
      );
      // "março" quebrava aqui: \w não cobre "ç", a captura parava em "mar" e
      // o ano era descartado silenciosamente.
      expect(iso(r.checkIn)).toBe(`2027-${String(i + 1).padStart(2, "0")}-10`);
    }
  });

  it("data sem ano que já passou assume o ano seguinte", () => {
    const r = parseAirbnbEmail(
      "Check-in\n1 de janeiro\nCheckout\n3 de janeiro",
      "Reserva confirmada",
    );
    expect(r.checkIn!.getTime()).toBeGreaterThan(Date.now() - 86400000);
  });
});

describe("valores financeiros", () => {
  const r = parseAirbnbEmail(
    CONFIRMACAO,
    "Reserva confirmada - Fulano de Tal chega em 29 de ago.",
  );

  it("separa bruto, taxa do Airbnb e líquido do anfitrião", () => {
    expect(r.valores.bruto).toBe(390);
    expect(r.valores.taxa).toBe(71.03);
    expect(r.valores.liquido).toBe(318.97);
  });

  it("os três fecham entre si", () => {
    expect(r.valores.bruto! - r.valores.taxa!).toBeCloseTo(
      r.valores.liquido!,
      2,
    );
  });

  it("guarda a taxa como retenção positiva, não como o -R$ do e-mail", () => {
    expect(r.valores.taxa).toBeGreaterThan(0);
  });

  it("não inventa valores em e-mail que não é confirmação", () => {
    const cancel = parseAirbnbEmail(
      CANCELAMENTO,
      "Cancelado: reserva HMS59KPA92",
    );
    expect(cancel.valores.bruto).toBeNull();
  });
});
