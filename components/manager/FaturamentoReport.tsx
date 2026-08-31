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
};

type Relatorio = {
  inicio: string;
  fim: string;
  total: Linha;
  diariaMedia: string;
  ocupacao: {
    percentual: number;
    noitesOcupadas: number;
    noitesDisponiveis: number;
  };
  reservasSemValor: number;
  porHospedagem: Linha[];
  porOrigem: Linha[];
  evolucao: { mes: string; liquido: string }[];
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

// Atalhos de período. O gestor raramente quer um intervalo arbitrário — quer
// "este mês", "o ano" ou comparar com o mês passado. O intervalo livre fica
// disponível para o resto.
function atalhos(): {
  chave: string;
  rotulo: string;
  de: string;
  ate: string;
}[] {
  const hoje = new Date();
  const a = hoje.getUTCFullYear();
  const m = hoje.getUTCMonth();
  const fimDoMes = (ano: number, mes: number) =>
    dia(new Date(Date.UTC(ano, mes + 1, 0)));
  return [
    {
      chave: "mes",
      rotulo: "Este mês",
      de: dia(new Date(Date.UTC(a, m, 1))),
      ate: fimDoMes(a, m),
    },
    {
      chave: "anterior",
      rotulo: "Mês passado",
      de: dia(new Date(Date.UTC(a, m - 1, 1))),
      ate: fimDoMes(a, m - 1),
    },
    {
      chave: "trimestre",
      rotulo: "Últimos 3 meses",
      de: dia(new Date(Date.UTC(a, m - 2, 1))),
      ate: fimDoMes(a, m),
    },
    {
      chave: "ano",
      rotulo: "Este ano",
      de: dia(new Date(Date.UTC(a, 0, 1))),
      ate: fimDoMes(a, 11),
    },
  ];
}

// Faturamento por período e hospedagem. Bruto, taxa e líquido lado a lado —
// a diferença entre eles é o custo da plataforma, e é o dado que mostra
// quanto vale trazer o hóspede para a reserva direta.
export function FaturamentoReport() {
  const presets = atalhos();
  const [atalho, setAtalho] = useState("mes");
  const [de, setDe] = useState(presets[0].de);
  const [ate, setAte] = useState(presets[0].ate);
  const [propertyId, setPropertyId] = useState("");
  const [hospedagens, setHospedagens] = useState<
    { id: string; title: string }[]
  >([]);
  const [dados, setDados] = useState<Relatorio | null>(null);

  useEffect(() => {
    fetch("/api/manager/properties")
      .then((r) => r.json())
      .then((lista) =>
        setHospedagens(
          (Array.isArray(lista) ? lista : []).map(
            (p: { id: string; title: string }) => ({
              id: p.id,
              title: p.title,
            }),
          ),
        ),
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    let descartado = false;
    // Sem limpar `dados` antes: manter os números anteriores enquanto a nova
    // consulta chega evita a tela piscar em branco a cada troca de filtro.
    const params = new URLSearchParams({ inicio: de, fim: ate });
    if (propertyId) params.set("propertyId", propertyId);
    fetch(`/api/reports/faturamento?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (!descartado) setDados(d);
      });
    return () => {
      descartado = true;
    };
  }, [de, ate, propertyId]);

  function aplicarAtalho(chave: string) {
    const p = presets.find((x) => x.chave === chave);
    setAtalho(chave);
    if (p) {
      setDe(p.de);
      setAte(p.ate);
    }
  }

  const mesReferencia = de.slice(0, 7);
  const picoEvolucao = Math.max(
    1,
    ...(dados?.evolucao.map((e) => Number(e.liquido)) ?? [1]),
  );
  const filtrandoHospedagem = propertyId !== "";

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-page-title font-semibold text-text-primary">
        Faturamento
      </h1>

      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-card border border-border bg-surface p-3">
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={p.chave}
              type="button"
              onClick={() => aplicarAtalho(p.chave)}
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

        <label className="min-w-52 flex-1 text-caption text-text-secondary">
          Hospedagem
          <select
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            className="mt-1 block w-full rounded-card border border-border bg-surface px-2.5 py-1.5 text-body text-text-primary outline-none focus:border-accent"
          >
            <option value="">Todas as hospedagens</option>
            {hospedagens.map((h) => (
              <option key={h.id} value={h.id}>
                {h.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!dados ? (
        <p className="mt-6 text-body text-text-secondary">Carregando…</p>
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Cartao
              rotulo="Recebido"
              valor={moeda.format(Number(dados.total.liquido))}
              destaque
            />
            <Cartao
              rotulo="Bruto"
              valor={moeda.format(Number(dados.total.bruto))}
            />
            <Cartao
              rotulo="Taxas das plataformas"
              valor={`− ${moeda.format(Number(dados.total.taxa))}`}
            />
            <Cartao
              rotulo="Diária média"
              valor={moeda.format(Number(dados.diariaMedia))}
              nota={`${dados.total.reservas} reservas · ${dados.total.noites} noites`}
            />
            <Cartao
              rotulo="Ocupação"
              valor={`${dados.ocupacao.percentual}%`}
              nota={`${dados.ocupacao.noitesOcupadas} de ${dados.ocupacao.noitesDisponiveis} noites`}
            />
          </div>

          {dados.reservasSemValor > 0 && (
            <div className="mt-4 flex items-start gap-2 rounded-card border border-border bg-amber-light p-3">
              <IconAlertTriangle
                size={18}
                className="mt-0.5 shrink-0 text-amber"
              />
              <p className="text-caption text-text-primary">
                {dados.reservasSemValor}{" "}
                {dados.reservasSemValor === 1
                  ? "reserva entrou"
                  : "reservas entraram"}{" "}
                sem valor registrado e{" "}
                {dados.reservasSemValor === 1 ? "conta" : "contam"} como zero
                aqui. Reservas do Airbnb anteriores à leitura financeira dos
                e-mails ficam assim; as novas já trazem o valor.
              </p>
            </div>
          )}

          {/* Com uma hospedagem selecionada a tabela teria uma linha só,
              repetindo os cartões acima. */}
          {!filtrandoHospedagem && (
            <Tabela titulo="Por hospedagem" linhas={dados.porHospedagem} />
          )}
          <Tabela titulo="Por origem" linhas={dados.porOrigem} />

          <h2 className="mt-8 text-card-title font-semibold text-text-primary">
            Evolução — recebido por mês
          </h2>
          <p className="mt-1 text-caption text-text-secondary">
            Últimos 12 meses{filtrandoHospedagem ? " desta hospedagem" : ""},
            independente do período filtrado acima.
          </p>
          <div className="mt-3 overflow-x-auto rounded-card border border-border bg-surface p-4">
            <div
              className="flex min-w-140 items-end gap-2"
              style={{ height: 160 }}
            >
              {dados.evolucao.map((e) => {
                const altura = (Number(e.liquido) / picoEvolucao) * 100;
                const doMes = e.mes === mesReferencia;
                return (
                  <div
                    key={e.mes}
                    className="flex flex-1 flex-col items-center gap-1.5"
                  >
                    <span className="text-caption text-text-secondary">
                      {Number(e.liquido) > 0
                        ? moeda.format(Number(e.liquido)).replace(/\s/g, "")
                        : ""}
                    </span>
                    <div
                      className={`w-full rounded-t ${doMes ? "bg-accent" : "bg-accent-light"}`}
                      style={{ height: `${Math.max(altura, 1)}%` }}
                      title={`${e.mes}: ${moeda.format(Number(e.liquido))}`}
                    />
                    <span className="text-caption capitalize text-text-secondary">
                      {mesCurto.format(new Date(`${e.mes}-01T00:00:00Z`))}
                    </span>
                  </div>
                );
              })}
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

function Tabela({ titulo, linhas }: { titulo: string; linhas: Linha[] }) {
  return (
    <>
      <h2 className="mt-8 text-card-title font-semibold text-text-primary">
        {titulo}
      </h2>
      {linhas.length === 0 ? (
        <p className="mt-2 text-body text-text-secondary">
          Nenhuma reserva confirmada neste período.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full min-w-140 text-body">
            <thead>
              <tr className="border-b border-border text-caption text-text-secondary">
                <th className="px-4 py-2.5 text-left font-medium">
                  {titulo.replace("Por ", "")}
                </th>
                <th className="px-4 py-2.5 text-right font-medium">Reservas</th>
                <th className="px-4 py-2.5 text-right font-medium">Noites</th>
                <th className="px-4 py-2.5 text-right font-medium">Bruto</th>
                <th className="px-4 py-2.5 text-right font-medium">Taxas</th>
                <th className="px-4 py-2.5 text-right font-medium">Recebido</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr
                  key={l.chave}
                  className="border-b border-border last:border-b-0"
                >
                  <td className="px-4 py-2.5 text-text-primary">{l.rotulo}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-text-secondary">
                    {l.reservas}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-text-secondary">
                    {l.noites}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-text-secondary">
                    {moeda.format(Number(l.bruto))}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-text-secondary">
                    {Number(l.taxa) > 0
                      ? `− ${moeda.format(Number(l.taxa))}`
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium tabular-nums text-text-primary">
                    {moeda.format(Number(l.liquido))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
