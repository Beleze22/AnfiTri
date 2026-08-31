"use client";

import { IconAlertTriangle } from "@tabler/icons-react";
import { useEffect, useState } from "react";

type Linha = {
  chave: string;
  rotulo: string;
  reservas: number;
  noites: number;
  bruto: string;
  taxa: string;
  liquido: string;
  comissao: string;
  repasse: string;
};

type Relatorio = {
  total: Linha;
  ocupacao: { percentual: number; noitesOcupadas: number };
  reservasSemValor: number;
  reservasSemComissao: number;
  porHospedagem: Linha[];
  evolucao: { mes: string; liquido: string }[];
  imoveis: { id: string; title: string; comissao: string | null }[];
};

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const mesCurto = new Intl.DateTimeFormat("pt-BR", {
  month: "short",
  timeZone: "UTC",
});

const dia = (d: Date) => d.toISOString().slice(0, 10);

function periodos() {
  const hoje = new Date();
  const a = hoje.getUTCFullYear();
  const m = hoje.getUTCMonth();
  const ultimoDia = (ano: number, mes: number) =>
    dia(new Date(Date.UTC(ano, mes + 1, 0)));
  return [
    {
      chave: "mes",
      rotulo: "Este mês",
      de: dia(new Date(Date.UTC(a, m, 1))),
      ate: ultimoDia(a, m),
    },
    {
      chave: "anterior",
      rotulo: "Mês passado",
      de: dia(new Date(Date.UTC(a, m - 1, 1))),
      ate: ultimoDia(a, m - 1),
    },
    {
      chave: "trimestre",
      rotulo: "Últimos 3 meses",
      de: dia(new Date(Date.UTC(a, m - 2, 1))),
      ate: ultimoDia(a, m),
    },
    {
      chave: "ano",
      rotulo: "Este ano",
      de: dia(new Date(Date.UTC(a, 0, 1))),
      ate: ultimoDia(a, 11),
    },
  ];
}

// Visão do proprietário. O número em destaque é o REPASSE — o que cai na
// conta dele — e não o "recebido" que o gestor vê, que ainda tem a comissão
// de administração dentro. Mostrar o número do gestor aqui daria ao dono uma
// expectativa maior do que a realidade.
export function OwnerReport() {
  const atalhos = periodos();
  const [atalho, setAtalho] = useState("mes");
  const [de, setDe] = useState(atalhos[0].de);
  const [ate, setAte] = useState(atalhos[0].ate);
  const [propertyId, setPropertyId] = useState("");
  const [dados, setDados] = useState<Relatorio | null>(null);

  useEffect(() => {
    let descartado = false;
    const params = new URLSearchParams({ inicio: de, fim: ate });
    if (propertyId) params.set("propertyId", propertyId);
    fetch(`/api/owner/reports?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (!descartado) setDados(d);
      });
    return () => {
      descartado = true;
    };
  }, [de, ate, propertyId]);

  const pico = Math.max(
    1,
    ...(dados?.evolucao.map((e) => Number(e.liquido)) ?? [1]),
  );
  const umImovel = propertyId !== "";

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      <h1 className="text-page-title font-semibold text-text-primary">
        Desempenho das suas hospedagens
      </h1>

      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-card border border-border bg-surface p-3">
        <div className="flex flex-wrap gap-1.5">
          {atalhos.map((p) => (
            <button
              key={p.chave}
              type="button"
              onClick={() => {
                setAtalho(p.chave);
                setDe(p.de);
                setAte(p.ate);
              }}
              className={`rounded-pill px-3 py-1.5 text-caption ${
                atalho === p.chave
                  ? "bg-accent text-accent-text"
                  : "border border-border text-text-primary"
              }`}
            >
              {p.rotulo}
            </button>
          ))}
        </div>

        <label className="text-caption text-text-secondary">
          De
          <input
            type="date"
            value={de}
            onChange={(e) => {
              setDe(e.target.value);
              setAtalho("livre");
            }}
            className="mt-1 block rounded-card border border-border bg-surface px-2.5 py-1.5 text-body text-text-primary outline-none focus:border-accent"
          />
        </label>
        <label className="text-caption text-text-secondary">
          Até
          <input
            type="date"
            value={ate}
            onChange={(e) => {
              setAte(e.target.value);
              setAtalho("livre");
            }}
            className="mt-1 block rounded-card border border-border bg-surface px-2.5 py-1.5 text-body text-text-primary outline-none focus:border-accent"
          />
        </label>

        {dados && dados.imoveis.length > 1 && (
          <label className="min-w-52 flex-1 text-caption text-text-secondary">
            Hospedagem
            <select
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              className="mt-1 block w-full rounded-card border border-border bg-surface px-2.5 py-1.5 text-body text-text-primary outline-none focus:border-accent"
            >
              <option value="">Todas as suas hospedagens</option>
              {dados.imoveis.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.title}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {!dados ? (
        <p className="mt-6 text-body text-text-secondary">Carregando…</p>
      ) : dados.imoveis.length === 0 ? (
        <div className="mt-6 rounded-card border border-border bg-surface p-6 text-center">
          <p className="text-body text-text-primary">
            Nenhuma hospedagem vinculada à sua conta ainda.
          </p>
          <p className="mt-1 text-caption text-text-secondary">
            Fale com o gestor para vincular seus imóveis.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Cartao
              rotulo="Seu repasse"
              valor={moeda.format(Number(dados.total.repasse))}
              destaque
            />
            <Cartao
              rotulo="Receita das reservas"
              valor={moeda.format(Number(dados.total.bruto))}
              nota={`${dados.total.reservas} reservas · ${dados.total.noites} noites`}
            />
            <Cartao
              rotulo="Descontos"
              valor={`− ${moeda.format(
                Number(dados.total.taxa) + Number(dados.total.comissao),
              )}`}
              nota={`Plataforma ${moeda.format(Number(dados.total.taxa))} · Administração ${moeda.format(Number(dados.total.comissao))}`}
            />
            <Cartao
              rotulo="Ocupação"
              valor={`${dados.ocupacao.percentual}%`}
              nota={`${dados.ocupacao.noitesOcupadas} noites ocupadas`}
            />
          </div>

          {(dados.reservasSemComissao > 0 || dados.reservasSemValor > 0) && (
            <div className="mt-4 flex items-start gap-2 rounded-card border border-border bg-amber-light p-3">
              <IconAlertTriangle
                size={18}
                className="mt-0.5 shrink-0 text-amber"
              />
              <p className="text-caption text-text-primary">
                Alguns valores deste período ainda estão sendo apurados pelo
                gestor. Os números podem mudar quando a apuração for concluída.
              </p>
            </div>
          )}

          <h2 className="mt-8 text-card-title font-semibold text-text-primary">
            Como chegamos ao seu repasse
          </h2>
          <div className="mt-3 overflow-x-auto rounded-card border border-border bg-surface">
            <table className="w-full min-w-120 text-body">
              <tbody>
                <Cascata
                  rotulo="Receita das reservas"
                  valor={dados.total.bruto}
                />
                <Cascata
                  rotulo="Taxa da plataforma (Airbnb, meios de pagamento)"
                  valor={dados.total.taxa}
                  negativo
                />
                <Cascata
                  rotulo="Comissão de administração"
                  valor={dados.total.comissao}
                  negativo
                />
                <Cascata
                  rotulo="Seu repasse"
                  valor={dados.total.repasse}
                  total
                />
              </tbody>
            </table>
          </div>

          {!umImovel && dados.porHospedagem.length > 1 && (
            <>
              <h2 className="mt-8 text-card-title font-semibold text-text-primary">
                Por hospedagem
              </h2>
              <div className="mt-3 overflow-x-auto rounded-card border border-border bg-surface">
                <table className="w-full min-w-120 text-body">
                  <thead>
                    <tr className="border-b border-border text-caption text-text-secondary">
                      <th className="px-4 py-2.5 text-left font-medium">
                        Hospedagem
                      </th>
                      <th className="px-4 py-2.5 text-right font-medium">
                        Reservas
                      </th>
                      <th className="px-4 py-2.5 text-right font-medium">
                        Noites
                      </th>
                      <th className="px-4 py-2.5 text-right font-medium">
                        Seu repasse
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.porHospedagem.map((l) => (
                      <tr
                        key={l.chave}
                        className="border-b border-border last:border-b-0"
                      >
                        <td className="px-4 py-2.5 text-text-primary">
                          {l.rotulo}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-text-secondary">
                          {l.reservas}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-text-secondary">
                          {l.noites}
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium tabular-nums text-text-primary">
                          {moeda.format(Number(l.repasse))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <h2 className="mt-8 text-card-title font-semibold text-text-primary">
            Repasse por mês
          </h2>
          <p className="mt-1 text-caption text-text-secondary">
            Últimos 12 meses, independente do período filtrado acima.
          </p>
          <div className="mt-3 overflow-x-auto rounded-card border border-border bg-surface p-4">
            <div
              className="flex min-w-140 items-end gap-2"
              style={{ height: 150 }}
            >
              {dados.evolucao.map((e) => (
                <div
                  key={e.mes}
                  className="flex flex-1 flex-col items-center gap-1.5"
                >
                  <div
                    className="w-full rounded-t bg-accent-light"
                    style={{
                      height: `${Math.max((Number(e.liquido) / pico) * 100, 1)}%`,
                    }}
                    title={`${e.mes}: ${moeda.format(Number(e.liquido))}`}
                  />
                  <span className="text-caption text-text-secondary capitalize">
                    {mesCurto.format(new Date(`${e.mes}-01T00:00:00Z`))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Cartao({
  rotulo,
  valor,
  nota,
  destaque,
}: {
  rotulo: string;
  valor: string;
  nota?: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={`rounded-card border p-4 ${
        destaque ? "border-accent bg-accent-light" : "border-border bg-surface"
      }`}
    >
      <p className="text-caption text-text-secondary">{rotulo}</p>
      <p
        className={`mt-1 text-page-title font-semibold ${
          destaque ? "text-accent-dark" : "text-text-primary"
        }`}
      >
        {valor}
      </p>
      {nota && <p className="mt-1 text-caption text-text-secondary">{nota}</p>}
    </div>
  );
}

function Cascata({
  rotulo,
  valor,
  negativo,
  total,
}: {
  rotulo: string;
  valor: string;
  negativo?: boolean;
  total?: boolean;
}) {
  return (
    <tr
      className={
        total
          ? "border-t-2 border-ink border-t-border"
          : "border-b border-border"
      }
    >
      <td
        className={`px-4 py-2.5 ${total ? "font-semibold text-text-primary" : "text-text-secondary"}`}
      >
        {rotulo}
      </td>
      <td
        className={`px-4 py-2.5 text-right tabular-nums ${
          total ? "font-semibold text-text-primary" : "text-text-secondary"
        }`}
      >
        {negativo ? "− " : ""}
        {moeda.format(Number(valor))}
      </td>
    </tr>
  );
}
