"use client";

import { useEffect, useState } from "react";

type Ocupacao = {
  id: string;
  checkIn: string;
  checkOut: string;
  origem: string;
  repasse: string | null;
};
type Imovel = { id: string; title: string; ocupacoes: Ocupacao[] };

const mesLongo = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const dataCurta = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});
const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function mesAtual() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function deslocar(mes: string, passo: number) {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + passo, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

type Balao = { ocupacao: Ocupacao; imovel: string; x: number; y: number };

// Ocupação do mês, um imóvel por linha. Sem nome ou contato do hóspede: ele
// contratou com o gestor, não com o dono. O que o dono precisa saber é em
// quais dias o imóvel está comprometido — e quanto aquela estadia rende
// para ele.
export function OwnerCalendar() {
  const [mes, setMes] = useState(mesAtual());
  const [imoveis, setImoveis] = useState<Imovel[] | null>(null);
  const [balao, setBalao] = useState<Balao | null>(null);

  useEffect(() => {
    let descartado = false;
    fetch(`/api/owner/calendar?mes=${mes}`)
      .then((r) => r.json())
      .then((d) => {
        if (!descartado) setImoveis(d.imoveis ?? []);
      });
    return () => {
      descartado = true;
    };
  }, [mes]);

  // Trocar de mês fecha o balão junto: deixá-lo aberto manteria na tela a
  // informação de uma reserva que não está mais sendo exibida.
  function trocarMes(proximo: string) {
    setMes(proximo);
    setBalao(null);
  }

  const [ano, m] = mes.split("-").map(Number);
  const diasNoMes = new Date(Date.UTC(ano, m, 0)).getUTCDate();
  const dias = Array.from({ length: diasNoMes }, (_, i) => i + 1);
  const hoje = new Date().toISOString().slice(0, 10);

  function ocupado(imovel: Imovel, dia: number) {
    const data = `${mes}-${String(dia).padStart(2, "0")}`;
    // check-out exclusivo: quem sai no dia 12 não ocupa a noite do dia 12.
    return imovel.ocupacoes.find((o) => o.checkIn <= data && o.checkOut > data);
  }

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-page-title font-semibold text-text-primary">
          Ocupação
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Mês anterior"
            onClick={() => trocarMes(deslocar(mes, -1))}
            className="rounded-pill border border-border px-3 py-1.5 text-caption text-text-primary"
          >
            ←
          </button>
          <span className="min-w-36 text-center text-body text-text-primary capitalize">
            {mesLongo.format(new Date(`${mes}-01T00:00:00Z`))}
          </span>
          <button
            type="button"
            aria-label="Próximo mês"
            onClick={() => trocarMes(deslocar(mes, 1))}
            className="rounded-pill border border-border px-3 py-1.5 text-caption text-text-primary"
          >
            →
          </button>
          <button
            type="button"
            onClick={() => trocarMes(mesAtual())}
            className="rounded-pill border border-border px-3 py-1.5 text-caption text-text-primary"
          >
            Hoje
          </button>
        </div>
      </div>

      <div className="mt-4 flex gap-4 text-caption text-text-secondary">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-xs bg-green" /> Ocupado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-xs bg-border" /> Livre
        </span>
        <span className="ml-auto">Passe o mouse sobre um dia ocupado</span>
      </div>

      {!imoveis ? (
        <p className="mt-6 text-body text-text-secondary">Carregando…</p>
      ) : imoveis.length === 0 ? (
        <p className="mt-6 text-body text-text-secondary">
          Nenhuma hospedagem vinculada à sua conta ainda.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-card border border-border bg-surface">
          {/* table-fixed: sem isso as colunas se ajustam ao conteúdo do
              cabeçalho e os dias de 1 a 9, com um dígito só, ficam mais
              estreitos que os de 10 a 31. */}
          <table className="w-full min-w-180 table-fixed border-collapse">
            <colgroup>
              <col className="w-44" />
              {dias.map((d) => (
                <col key={d} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th className="bg-surface px-3 py-2 text-left text-caption font-medium text-text-secondary">
                  Hospedagem
                </th>
                {dias.map((d) => {
                  const data = `${mes}-${String(d).padStart(2, "0")}`;
                  return (
                    <th
                      key={d}
                      className={`py-2 text-center text-caption font-normal ${
                        data === hoje
                          ? "bg-accent-light font-semibold text-accent-dark"
                          : "text-text-secondary"
                      }`}
                    >
                      {d}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {imoveis.map((imovel) => (
                <tr key={imovel.id} className="border-t border-border">
                  <td className="truncate px-3 py-2.5 text-body text-text-primary">
                    {imovel.title}
                  </td>
                  {dias.map((d) => {
                    const o = ocupado(imovel, d);
                    return (
                      <td key={d} className="px-px py-2.5">
                        <div
                          onMouseEnter={(event) => {
                            if (!o) return;
                            const r =
                              event.currentTarget.getBoundingClientRect();
                            // Coordenadas de viewport + posição fixa: o balão
                            // escapa do overflow do container rolável, que de
                            // outra forma o cortaria.
                            setBalao({
                              ocupacao: o,
                              imovel: imovel.title,
                              x: r.left + r.width / 2,
                              y: r.top,
                            });
                          }}
                          onMouseLeave={() => setBalao(null)}
                          className={`h-6 w-full ${
                            o ? "cursor-pointer bg-green" : "bg-border/40"
                          } ${
                            o &&
                            o.checkIn === `${mes}-${String(d).padStart(2, "0")}`
                              ? "rounded-l-sm"
                              : ""
                          }`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {balao && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-card border border-border bg-surface p-3 shadow-lg"
          style={{ left: balao.x, top: balao.y - 8 }}
        >
          <p className="text-caption font-semibold text-text-primary">
            {balao.imovel}
          </p>
          <p className="mt-1 text-caption text-text-secondary">
            {dataCurta.format(new Date(`${balao.ocupacao.checkIn}T00:00:00Z`))}{" "}
            até{" "}
            {dataCurta.format(new Date(`${balao.ocupacao.checkOut}T00:00:00Z`))}
          </p>
          <p className="text-caption text-text-secondary">
            {balao.ocupacao.origem}
          </p>
          <p className="mt-1.5 border-t border-border pt-1.5 text-caption text-text-secondary">
            Seu repasse:{" "}
            <strong className="text-text-primary">
              {balao.ocupacao.repasse
                ? moeda.format(Number(balao.ocupacao.repasse))
                : "em apuração"}
            </strong>
          </p>
        </div>
      )}

      <p className="mt-3 text-caption text-text-secondary">
        As reservas são geridas pelo administrador das hospedagens. Esta tela é
        somente para acompanhamento.
      </p>
    </div>
  );
}
