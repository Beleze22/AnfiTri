"use client";

import { useEffect, useState } from "react";

type Ocupacao = {
  id: string;
  checkIn: string;
  checkOut: string;
  origem: string;
};
type Imovel = { id: string; title: string; ocupacoes: Ocupacao[] };

const mesLongo = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
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

// Ocupação do mês, um imóvel por linha. Sem nome ou contato do hóspede: ele
// contratou com o gestor, não com o dono. O que o dono precisa saber é em
// quais dias o imóvel está comprometido.
export function OwnerCalendar() {
  const [mes, setMes] = useState(mesAtual());
  const [imoveis, setImoveis] = useState<Imovel[] | null>(null);

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

  const [ano, m] = mes.split("-").map(Number);
  const diasNoMes = new Date(Date.UTC(ano, m, 0)).getUTCDate();
  const dias = Array.from({ length: diasNoMes }, (_, i) => i + 1);

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
            onClick={() => setMes((x) => deslocar(x, -1))}
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
            onClick={() => setMes((x) => deslocar(x, 1))}
            className="rounded-pill border border-border px-3 py-1.5 text-caption text-text-primary"
          >
            →
          </button>
        </div>
      </div>

      <div className="mt-4 flex gap-4 text-caption text-text-secondary">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green" /> Ocupado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-border" /> Livre
        </span>
      </div>

      {!imoveis ? (
        <p className="mt-6 text-body text-text-secondary">Carregando…</p>
      ) : imoveis.length === 0 ? (
        <p className="mt-6 text-body text-text-secondary">
          Nenhuma hospedagem vinculada à sua conta ainda.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-card border border-border bg-surface">
          <table className="min-w-160 border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 bg-surface px-3 py-2 text-left text-caption font-medium text-text-secondary">
                  Hospedagem
                </th>
                {dias.map((d) => (
                  <th
                    key={d}
                    className="px-0.5 py-2 text-center text-caption font-normal text-text-secondary"
                  >
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {imoveis.map((imovel) => (
                <tr key={imovel.id} className="border-t border-border">
                  <td className="sticky left-0 max-w-44 truncate bg-surface px-3 py-2.5 text-body text-text-primary">
                    {imovel.title}
                  </td>
                  {dias.map((d) => {
                    const o = ocupado(imovel, d);
                    return (
                      <td key={d} className="px-0.5 py-2.5">
                        <div
                          className={`mx-auto h-5 w-full rounded-sm ${o ? "bg-green" : "bg-border/50"}`}
                          title={
                            o
                              ? `${o.origem}: ${o.checkIn} a ${o.checkOut}`
                              : "Livre"
                          }
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

      <p className="mt-3 text-caption text-text-secondary">
        As reservas são geridas pelo administrador das hospedagens. Esta tela é
        somente para acompanhamento.
      </p>
    </div>
  );
}
