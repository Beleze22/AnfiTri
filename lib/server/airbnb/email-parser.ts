// Parser dos e-mails do Airbnb (arquitetura, seção 3.2).
//
// Reescrito em 31/08/2026 a partir de três e-mails reais encaminhados pelo
// gestor — antes disso os padrões eram suposição e não casavam com nada. O
// que os e-mails reais mostraram:
//
//   • Os rótulos existem, mas o VALOR VEM NA LINHA SEGUINTE, não depois de
//     dois-pontos:      Check-in ⏎ sáb., 29 de ago. ⏎ 15:00
//   • Datas de confirmação vêm SEM ANO ("29 de ago."), então o ano é
//     inferido — estadia do Airbnb é sempre futura.
//   • Cancelamento traz o período como intervalo de dias com mês
//     compartilhado:    23 – 27 de out.
//   • Alteração traz dois intervalos rotulados, com ano completo.
//   • O código de confirmação aparece rotulado no corpo e também dentro da
//     URL da reserva; no cancelamento, no próprio assunto.

const PT_MONTHS: Record<string, number> = {
  jan: 0,
  fev: 1,
  mar: 2,
  abr: 3,
  mai: 4,
  jun: 5,
  jul: 6,
  ago: 7,
  set: 8,
  out: 9,
  nov: 10,
  dez: 11,
  janeiro: 0,
  fevereiro: 1,
  março: 2,
  abril: 3,
  maio: 4,
  junho: 5,
  julho: 6,
  agosto: 7,
  setembro: 8,
  outubro: 9,
  novembro: 10,
  dezembro: 11,
};

const EN_MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

export type TipoEmailAirbnb =
  | "confirmacao"
  | "cancelamento"
  | "alteracao"
  | "desconhecido";

// Valores em reais, já convertidos do formato brasileiro. `bruto` é o que o
// hóspede pagou, `liquido` o que o anfitrião recebe, e `taxa` a retenção do
// Airbnb entre os dois (positiva).
export type ValoresAirbnb = {
  bruto: number | null;
  taxa: number | null;
  liquido: number | null;
};

export type ParsedAirbnbEmail = {
  tipo: TipoEmailAirbnb;
  airbnbRef: string | null;
  valores: ValoresAirbnb;
  checkIn: Date | null;
  checkOut: Date | null;
  propertyHint: string;
  rawSnippet: string;
};

// Confirmação do Airbnb é sempre de estadia futura. Sem ano no corpo, usar o
// ano corrente joga uma reserva de janeiro, lida em dezembro, para onze meses
// atrás — bloqueia data passada e deixa a real livre.
// A referência é a data DO E-MAIL, não "agora": o Airbnb avisa da estadia
// antes ou no dia dela, então relativo ao envio a data está sempre à frente.
// Ancorar em "agora" erra ao processar e-mail de dias atrás — a janela de
// busca do Gmail é de 3 dias — e joga a reserva para o ano seguinte.
function inferirAno(month: number, day: number, referencia: Date): Date {
  const candidato = new Date(Date.UTC(referencia.getUTCFullYear(), month, day));
  const vespera = new Date(referencia.getTime() - 24 * 60 * 60 * 1000);
  if (candidato < vespera) {
    return new Date(Date.UTC(referencia.getUTCFullYear() + 1, month, day));
  }
  return candidato;
}

function mesPt(palavra: string): number | undefined {
  // A forma abreviada está no mapa, então o prefixo de 3 letras resgata
  // grafias que a captura não trouxe inteiras ("março" com cedilha).
  return PT_MONTHS[palavra] ?? PT_MONTHS[palavra.slice(0, 3)];
}

// \p{L} no lugar de \w: \w é [A-Za-z0-9_] e não cobre "ç", então "março" era
// capturado como "mar" e o " de 2027" seguinte deixava de casar.
const DATA_PT = /(\d{1,2})\s+de\s+(\p{L}+)\.?(?:\s+de\s+(\d{4}))?/u;

export function parseData(texto: string, referencia = new Date()): Date | null {
  const pt = texto.toLowerCase().match(DATA_PT);
  if (pt) {
    const dia = Number(pt[1]);
    const mes = mesPt(pt[2]);
    if (mes !== undefined) {
      return pt[3]
        ? new Date(Date.UTC(Number(pt[3]), mes, dia))
        : inferirAno(mes, dia, referencia);
    }
  }

  const en = texto.toLowerCase().match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (en) {
    const mes = EN_MONTHS[en[1].slice(0, 3)];
    if (mes !== undefined) {
      return new Date(Date.UTC(Number(en[3]), mes, Number(en[2])));
    }
  }

  const enInv = texto.toLowerCase().match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (enInv) {
    const mes = EN_MONTHS[enInv[2].slice(0, 3)];
    if (mes !== undefined) {
      return new Date(Date.UTC(Number(enInv[3]), mes, Number(enInv[1])));
    }
  }

  return null;
}

// "23 – 27 de out." — dois dias compartilhando o mês, com travessão ou hífen.
// Formato do e-mail de cancelamento.
function intervaloDiasMesUnico(
  texto: string,
  referencia: Date,
): { inicio: Date; fim: Date } | null {
  const m = texto
    .toLowerCase()
    .match(/(\d{1,2})\s*[–—-]\s*(\d{1,2})\s+de\s+(\p{L}+)\.?/u);
  if (!m) return null;
  const mes = mesPt(m[3]);
  if (mes === undefined) return null;
  return {
    inicio: inferirAno(mes, Number(m[1]), referencia),
    fim: inferirAno(mes, Number(m[2]), referencia),
  };
}

// "29 de ago. de 2026 - 30 de ago. de 2026" — duas datas completas.
// Formato do e-mail de alteração.
function intervaloDatasCompletas(
  texto: string,
  referencia: Date,
): { inicio: Date; fim: Date } | null {
  const partes = texto.split(/\s+[–—-]\s+/);
  if (partes.length < 2) return null;
  const inicio = parseData(partes[0], referencia);
  const fim = parseData(partes[1], referencia);
  return inicio && fim ? { inicio, fim } : null;
}

function linhas(corpo: string): string[] {
  return corpo
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

// Valor de um rótulo cujo conteúdo está NAS LINHAS SEGUINTES. É assim que o
// Airbnb formata "Check-in", "Checkout" e "Código de confirmação" — o parser
// antigo só procurava "rótulo: valor" na mesma linha e por isso não achava
// nada nos e-mails de verdade.
function valorAposRotulo(
  ls: string[],
  rotulo: RegExp,
  aceita: (linha: string) => boolean,
  alcance = 3,
): string | null {
  for (let i = 0; i < ls.length; i += 1) {
    if (!rotulo.test(ls[i])) continue;
    // Mesma linha, no formato "rótulo: valor".
    const mesmaLinha = ls[i].split(":").slice(1).join(":").trim();
    if (mesmaLinha && aceita(mesmaLinha)) return mesmaLinha;
    for (let j = i + 1; j <= i + alcance && j < ls.length; j += 1) {
      if (aceita(ls[j])) return ls[j];
    }
  }
  return null;
}

const TEM_DATA = (l: string) => DATA_PT.test(l.toLowerCase());
const TEM_VALOR = (l: string) => /-?R\$\s?[\d.]+,\d{2}/.test(l);

// "R$ 1.234,56" → 1234.56. Milhar com ponto e decimal com vírgula; o sinal
// negativo aparece nas linhas de taxa ("-R$ 71,03").
function valorBRL(texto: string): number | null {
  const m = texto.match(/(-?)R\$\s?([\d.]+),(\d{2})/);
  if (!m) return null;
  const inteiro = m[2].replace(/\./g, "");
  return Number(`${m[1]}${inteiro}.${m[3]}`);
}

// O e-mail de confirmação traz o desdobramento financeiro em dois blocos:
//
//   O hóspede pagou            Pagamento do anfitrião
//     R$ 250,00 x 1 noite        Preço da acomodação ....... R$ 250,00
//     Taxa de limpeza .......    Taxa de limpeza ........... R$ 140,00
//     Total (BRL) .. R$ 390,00   Taxa de serviço (16%+IVA) . -R$ 71,03
//                                                            R$ 318,97
//
// Sem isso a reserva do Airbnb entra com valor nulo e some de qualquer
// relatório de faturamento.
function extrairValores(corpo: string): ValoresAirbnb {
  const ls = linhas(corpo);
  const bruto = valorBRL(valorAposRotulo(ls, /^total\s*\(/i, TEM_VALOR) ?? "");

  const taxaBruta = valorBRL(
    valorAposRotulo(ls, /taxa de servi[çc]o do anfitri/i, TEM_VALOR) ?? "",
  );
  // A taxa vem negativa no e-mail; guardamos como retenção positiva.
  const taxa = taxaBruta === null ? null : Math.abs(taxaBruta);

  // O líquido é o valor logo após a linha da taxa — último número do bloco
  // do anfitrião.
  let liquido: number | null = null;
  const iTaxa = ls.findIndex((l) => /taxa de servi[çc]o do anfitri/i.test(l));
  if (iTaxa >= 0) {
    for (let j = iTaxa + 1; j < Math.min(iTaxa + 5, ls.length); j += 1) {
      const v = valorBRL(ls[j]);
      if (v !== null && v > 0) {
        liquido = v;
        break;
      }
    }
  }

  return { bruto, taxa, liquido };
}
const TEM_CODIGO = (l: string) => /^[A-Z0-9]{8,12}$/.test(l.trim());

// Códigos só de fontes estruturadas. Existia aqui um padrão
// /\b([A-Z]{2,4}[0-9]{4,8})\b/ que casava qualquer sigla seguida de números
// em qualquer lugar do texto: um "AP1204" de endereço virava código. Como
// esse valor é a chave de deduplicação, código errado é pior que nenhum.
function extrairCodigo(corpo: string, assunto: string): string | null {
  const ls = linhas(corpo);

  const rotulado = valorAposRotulo(ls, /c[oó]digo de confirma/i, TEM_CODIGO);
  if (rotulado) return rotulado.toUpperCase();

  // A URL da reserva no domínio do Airbnb carrega o código no caminho.
  // Sem a flag `i` no grupo capturado: o código do Airbnb é maiúsculo, e
  // aceitar minúsculas faz qualquer palavra de 8 a 12 letras virar código —
  // foi assim que "Reserva confirmada" produziu o código "CONFIRMADA".
  const url = corpo.match(/[Rr]eservations\/details\/([A-Z0-9]{8,12})/);
  if (url) return url[1];

  // "Cancelado: reserva HMS59KPA92 de 23 – 27 de outubro"
  const noAssunto = assunto.match(/[Rr]eserva\s+([A-Z0-9]{8,12})\b/);
  if (noAssunto) return noAssunto[1];

  return null;
}

function detectarTipo(assunto: string, corpo: string): TipoEmailAirbnb {
  const texto = `${assunto}\n${corpo.slice(0, 600)}`.toLowerCase();
  if (/cancelad[oa]|cancelamento|foi cancelada/.test(texto))
    return "cancelamento";
  if (
    /quer alterar|alterar a sua reserva|solicita[çc][ãa]o de altera/.test(texto)
  )
    return "alteracao";
  if (/reserva confirmada|nova reserva|booking confirmed/.test(texto))
    return "confirmacao";
  return "desconhecido";
}

function datasDaConfirmacao(ls: string[], referencia: Date) {
  const entrada = valorAposRotulo(ls, /^check[\s-]?in\b/i, TEM_DATA);
  const saida = valorAposRotulo(ls, /^check[\s-]?out\b|^sa[íi]da\b/i, TEM_DATA);
  return {
    checkIn: entrada ? parseData(entrada, referencia) : null,
    checkOut: saida ? parseData(saida, referencia) : null,
  };
}

function datasDoCancelamento(corpo: string, assunto: string, referencia: Date) {
  // O assunto costuma trazer o período inteiro; o corpo repete.
  for (const fonte of [assunto, corpo]) {
    const intervalo =
      intervaloDiasMesUnico(fonte, referencia) ??
      intervaloDatasCompletas(fonte, referencia);
    if (intervalo) {
      return { checkIn: intervalo.inicio, checkOut: intervalo.fim };
    }
  }
  return { checkIn: null, checkOut: null };
}

// Alteração traz "Datas Originais" e "Datas Solicitadas". Devolvemos as
// ORIGINAIS: são elas que identificam a reserva que temos registrada. A
// mudança em si é decisão do gestor no painel do Airbnb — o e-mail é um
// pedido, não um fato consumado ("se você aceitar... vamos atualizar").
function datasDaAlteracao(ls: string[], referencia: Date) {
  const originais = valorAposRotulo(ls, /datas?\s+originais/i, TEM_DATA);
  if (originais) {
    const intervalo =
      intervaloDatasCompletas(originais, referencia) ??
      intervaloDiasMesUnico(originais, referencia);
    if (intervalo) {
      return { checkIn: intervalo.inicio, checkOut: intervalo.fim };
    }
  }
  return { checkIn: null, checkOut: null };
}

export function parseAirbnbEmail(
  corpo: string,
  assunto: string,
  // Data de envio do e-mail; ancora a inferência de ano das datas sem ano.
  referencia = new Date(),
): ParsedAirbnbEmail {
  const ls = linhas(corpo);
  const tipo = detectarTipo(assunto, corpo);

  let datas: { checkIn: Date | null; checkOut: Date | null };
  if (tipo === "cancelamento") {
    datas = datasDoCancelamento(corpo, assunto, referencia);
  } else if (tipo === "alteracao") {
    datas = datasDaAlteracao(ls, referencia);
  } else {
    datas = datasDaConfirmacao(ls, referencia);
  }

  return {
    tipo,
    airbnbRef: extrairCodigo(corpo, assunto),
    valores:
      tipo === "confirmacao"
        ? extrairValores(corpo)
        : {
            bruto: null,
            taxa: null,
            liquido: null,
          },
    checkIn: datas.checkIn,
    checkOut: datas.checkOut,
    // O nome do anúncio aparece como texto no corpo — a camada de serviço faz
    // o casamento contra os imóveis cadastrados.
    propertyHint: corpo.slice(0, 4000),
    rawSnippet: corpo.slice(0, 500),
  };
}

// Nome anterior, mantido para não quebrar chamadas existentes.
export const parseAirbnbConfirmationEmail = parseAirbnbEmail;
