"use client";

import {
  IconHome2,
  IconPencil,
  IconPlus,
  IconTrash,
  IconUserCircle,
  IconX,
} from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";

type Imovel = { id: string; title: string; comissao: string | null };
type Dono = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  imoveis: Imovel[];
};

// Proprietários que terceirizam a administração para o gestor. Cadastrar aqui
// só cria a conta; o vínculo com cada imóvel e o percentual de administração
// ficam no cadastro da hospedagem, que é onde a negociação acontece.
export function OwnersManager() {
  const [donos, setDonos] = useState<Dono[] | null>(null);
  const [abrindo, setAbrindo] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [imoveisLivres, setImoveisLivres] = useState<
    { id: string; title: string; ownerId: string | null }[]
  >([]);

  const carregar = useCallback(() => {
    Promise.all([
      fetch("/api/manager/owners").then((r) => r.json()),
      fetch("/api/manager/properties").then((r) => r.json()),
    ]).then(([lista, props]) => {
      setDonos(lista);
      setImoveisLivres(Array.isArray(props) ? props : []);
    });
  }, []);

  useEffect(carregar, [carregar]);

  // Vincular e desvincular passam pelo PATCH da hospedagem, que já é onde o
  // ownerId vive — evita uma segunda rota fazendo a mesma coisa.
  async function vincular(propertyId: string, ownerId: string | null) {
    await fetch(`/api/properties/${propertyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerId: ownerId ?? "" }),
    });
    carregar();
  }

  async function salvarDados(
    id: string,
    dados: { name: string; email: string; phone: string },
  ) {
    setErro(null);
    const r = await fetch(`/api/manager/owners/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    });
    if (!r.ok) {
      const b = await r.json();
      setErro(b.error?.message ?? "Não foi possível salvar.");
      return;
    }
    setEditando(null);
    carregar();
  }

  async function excluir(id: string, nome: string) {
    if (
      !confirm(
        `Excluir ${nome}? As hospedagens dele voltam a ser tratadas como suas. O histórico de reservas não é afetado.`,
      )
    ) {
      return;
    }
    await fetch(`/api/manager/owners/${id}`, { method: "DELETE" });
    carregar();
  }

  async function criar(event: React.FormEvent) {
    event.preventDefault();
    setErro(null);
    setEnviando(true);

    const r = await fetch("/api/manager/owners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone: phone || undefined }),
    });
    setEnviando(false);

    if (!r.ok) {
      const b = await r.json();
      setErro(b.error?.message ?? "Não foi possível cadastrar.");
      return;
    }

    setName("");
    setEmail("");
    setPhone("");
    setAbrindo(false);
    carregar();
  }

  const campo =
    "mt-1 w-full rounded-card border border-border bg-surface px-3 py-2 text-body text-text-primary outline-none focus:border-accent";

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-page-title font-semibold text-text-primary">
          Proprietários
        </h1>
        <button
          type="button"
          onClick={() => setAbrindo((x) => !x)}
          className="flex items-center gap-1.5 rounded-pill bg-accent px-3 py-1.5 text-caption font-medium text-accent-text"
        >
          <IconPlus size={16} /> Novo proprietário
        </button>
      </div>

      <p className="mt-1 text-body text-text-secondary">
        Donos de hospedagens que acompanham o desempenho dos próprios imóveis. O
        acesso deles é somente leitura.
      </p>

      {abrindo && (
        <form
          onSubmit={criar}
          className="mt-4 rounded-card border border-border bg-surface p-4"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-caption text-text-secondary">
              Nome
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={campo}
              />
            </label>
            <label className="text-caption text-text-secondary">
              E-mail
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={campo}
              />
            </label>
            <label className="text-caption text-text-secondary">
              WhatsApp (opcional)
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={campo}
              />
            </label>
          </div>

          {erro && (
            <p className="mt-3 rounded-card bg-accent-light p-2.5 text-caption text-accent-dark">
              {erro}
            </p>
          )}

          <p className="mt-3 text-caption text-text-secondary">
            Ele entra pelo e-mail, sem senha — recebe um link de acesso quando
            pedir em <code>/proprietario/login</code>.
          </p>

          <button
            type="submit"
            disabled={enviando}
            className="mt-3 rounded-pill bg-accent px-4 py-2 text-body font-medium text-accent-text disabled:opacity-60"
          >
            {enviando ? "Cadastrando…" : "Cadastrar"}
          </button>
        </form>
      )}

      {!donos ? (
        <p className="mt-6 text-body text-text-secondary">Carregando…</p>
      ) : donos.length === 0 ? (
        <div className="mt-6 rounded-card border border-border bg-surface p-6 text-center">
          <IconUserCircle size={28} className="mx-auto text-text-secondary" />
          <p className="mt-2 text-body text-text-primary">
            Nenhum proprietário cadastrado.
          </p>
          <p className="mt-1 text-caption text-text-secondary">
            Hospedagens sem dono vinculado são tratadas como suas.
          </p>
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-3">
          {donos.map((d) => (
            <article
              key={d.id}
              className="rounded-card border border-border bg-surface p-4"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="text-card-title font-semibold text-text-primary">
                  {d.name}
                </p>
                <p className="text-caption text-text-secondary">{d.email}</p>
                {d.phone && (
                  <p className="text-caption text-text-secondary">{d.phone}</p>
                )}
                <div className="ml-auto flex gap-1">
                  <button
                    type="button"
                    onClick={() => setEditando(editando === d.id ? null : d.id)}
                    aria-label={`Editar ${d.name}`}
                    className="rounded-pill border border-border p-1.5 text-text-secondary"
                  >
                    <IconPencil size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => excluir(d.id, d.name)}
                    aria-label={`Excluir ${d.name}`}
                    className="rounded-pill border border-border p-1.5 text-text-secondary"
                  >
                    <IconTrash size={15} />
                  </button>
                </div>
              </div>

              {d.imoveis.length === 0 ? (
                <p className="mt-2 text-caption text-text-secondary">
                  Nenhuma hospedagem vinculada — ele ainda não vê nada ao
                  entrar. O vínculo é feito no cadastro da hospedagem.
                </p>
              ) : (
                <ul className="mt-2 flex flex-col gap-1">
                  {d.imoveis.map((i) => (
                    <li
                      key={i.id}
                      className="flex flex-wrap items-center gap-2 text-body text-text-secondary"
                    >
                      <IconHome2 size={15} className="shrink-0" />
                      <span className="text-text-primary">{i.title}</span>
                      {editando === d.id && (
                        <button
                          type="button"
                          onClick={() => vincular(i.id, null)}
                          aria-label={`Desvincular ${i.title}`}
                          title="Desvincular esta hospedagem"
                          className="text-text-secondary"
                        >
                          <IconX size={14} />
                        </button>
                      )}
                      {i.comissao ? (
                        <span className="rounded-pill bg-green-light px-2 py-0.5 text-caption text-green">
                          {Number(i.comissao).toFixed(0)}% de administração
                        </span>
                      ) : (
                        <span className="rounded-pill bg-amber-light px-2 py-0.5 text-caption text-amber">
                          Comissão não configurada
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {/* O painel de edição abre por ÚLTIMO, depois da lista: aberto
                  entre o cabeçalho e as hospedagens, ele empurrava a lista
                  para baixo e o × de desvincular ficava longe do contexto. */}
              {editando === d.id && (
                <EditarDono
                  dono={d}
                  imoveis={imoveisLivres}
                  onSalvar={(dados) => salvarDados(d.id, dados)}
                  onVincular={(propertyId) => vincular(propertyId, d.id)}
                  onCancelar={() => setEditando(null)}
                />
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

// Bloco de edição, aberto sob o card do proprietário. Vincular imóvel aqui é
// mais natural do que abrir o cadastro de cada hospedagem quando o dono tem
// vários — o caminho pelo imóvel continua existindo.
function EditarDono({
  dono,
  imoveis,
  onSalvar,
  onVincular,
  onCancelar,
}: {
  dono: Dono;
  imoveis: { id: string; title: string; ownerId: string | null }[];
  onSalvar: (dados: { name: string; email: string; phone: string }) => void;
  onVincular: (propertyId: string) => void;
  onCancelar: () => void;
}) {
  const [name, setName] = useState(dono.name);
  const [email, setEmail] = useState(dono.email);
  const [phone, setPhone] = useState(dono.phone ?? "");
  const [aVincular, setAVincular] = useState("");

  const disponiveis = imoveis.filter((i) => i.ownerId !== dono.id);
  const campo =
    "mt-1 w-full rounded-card border border-border bg-surface px-3 py-2 text-body text-text-primary outline-none focus:border-accent";

  return (
    <div className="mt-3 rounded-card border border-border bg-bg p-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-caption text-text-secondary">
          Nome
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={campo}
          />
        </label>
        <label className="text-caption text-text-secondary">
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={campo}
          />
        </label>
        <label className="text-caption text-text-secondary">
          WhatsApp
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={campo}
          />
        </label>
      </div>
      <p className="mt-1.5 text-caption text-text-secondary">
        O e-mail é a credencial de acesso: trocá-lo passa a enviar o link de
        entrada para o endereço novo.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3">
        <label className="min-w-52 flex-1 text-caption text-text-secondary">
          Vincular hospedagem
          <select
            value={aVincular}
            onChange={(e) => setAVincular(e.target.value)}
            className={campo}
          >
            <option value="">Escolha uma hospedagem…</option>
            {disponiveis.map((i) => (
              <option key={i.id} value={i.id}>
                {i.title}
                {i.ownerId ? " (vinculada a outro proprietário)" : ""}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={!aVincular}
          onClick={() => {
            onVincular(aVincular);
            setAVincular("");
          }}
          className="rounded-pill border border-border px-4 py-2 text-body text-text-primary disabled:opacity-40"
        >
          Vincular
        </button>
      </div>
      <p className="mt-1.5 text-caption text-text-secondary">
        Para desvincular, use o × ao lado da hospedagem na lista acima.
      </p>

      <div className="mt-3 flex gap-2 border-t border-border pt-3">
        <button
          type="button"
          onClick={() => onSalvar({ name, email, phone })}
          className="rounded-pill bg-accent px-4 py-2 text-body font-medium text-accent-text"
        >
          Salvar dados
        </button>
        <button
          type="button"
          onClick={onCancelar}
          className="rounded-pill border border-border px-4 py-2 text-body text-text-primary"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
