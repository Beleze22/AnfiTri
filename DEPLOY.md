# Deploy — Vercel (Hobby) + agendador externo gratuito

O app é um Next.js fullstack: front e API sobem juntos num único deploy.
Banco (Postgres) e fotos (Storage) já estão hospedados no Supabase, então o
deploy é só o aplicativo + variáveis de ambiente + crons externos.

## 1. Subir o código para o GitHub

O deploy da Vercel acompanha o repositório. Commit e push de tudo que está
pendente para `master` (repo: `Beleze22/AnfiTri`).

## 2. Criar o projeto na Vercel

1. [vercel.com](https://vercel.com) → **Add New → Project** → importar
   `Beleze22/AnfiTri` (login com a conta do GitHub).
2. Framework: Next.js é detectado sozinho — não mude build/output.
3. Antes do primeiro deploy, cadastrar as variáveis de ambiente (abaixo).

### Variáveis de ambiente (Settings → Environment Variables)

Copiar os valores do `.env.local`, com duas exceções marcadas:

| Variável                    | Valor                                                                  |
| --------------------------- | ---------------------------------------------------------------------- |
| `DATABASE_URL`              | igual ao `.env.local` (pooler Supabase, porta 6543)                    |
| `DIRECT_URL`                | igual ao `.env.local` (porta 5432 — usada só por migrations)           |
| `JWT_SECRET`                | **gerar um novo** para produção: `openssl rand -hex 32`                |
| `CRON_SECRET`               | **gerar um novo**: `openssl rand -hex 32` (vai também no cron-job.org) |
| `SUPABASE_URL`              | igual ao `.env.local`                                                  |
| `SUPABASE_SERVICE_ROLE_KEY` | igual ao `.env.local`                                                  |
| `SUPABASE_STORAGE_BUCKET`   | igual ao `.env.local`                                                  |
| `GMAIL_CLIENT_ID`           | igual ao `.env.local`                                                  |
| `GMAIL_CLIENT_SECRET`       | igual ao `.env.local`                                                  |
| `GMAIL_REFRESH_TOKEN`       | igual ao `.env.local`                                                  |
| `GMAIL_USER`                | igual ao `.env.local`                                                  |
| `STRIPE_SECRET_KEY`         | **opcional** — liga o pagamento (ver seção Pagamentos)                 |
| `STRIPE_WEBHOOK_SECRET`     | **opcional** — assinatura do webhook do Stripe                         |

Trocar o `JWT_SECRET` invalida sessões antigas (ninguém tem sessão em
produção ainda — sem efeito). O banco é o mesmo do desenvolvimento por
enquanto — os dados de teste (Apartamento de Teste 2 etc.) aparecem na demo,
o que é desejável; quando o produto for real, criar um projeto Supabase
separado para produção.

4. **Deploy**. A URL sai como `https://<projeto>.vercel.app`.

## 3. Crons no cron-job.org (gratuito)

O plano Hobby da Vercel só roda cron diário, então os três jobs ficam no
[cron-job.org](https://cron-job.org) (conta gratuita, precisão de 1 min):

| Job              | URL                                                    | Frequência    |
| ---------------- | ------------------------------------------------------ | ------------- |
| Expirar reservas | `https://<app>.vercel.app/api/cron/expire-bookings`    | a cada 15 min |
| E-mail do Airbnb | `https://<app>.vercel.app/api/cron/check-airbnb-email` | a cada 10 min |
| iCal do Airbnb   | `https://<app>.vercel.app/api/cron/sync-airbnb-ical`   | a cada 1 h    |

Em cada job: **Advanced → Headers** → adicionar
`Authorization: Bearer <CRON_SECRET de produção>`. Sem o header a rota
responde 401 (dá para conferir pelo histórico de execuções do próprio
cron-job.org: 200 = ok).

## 4. Checklist pós-deploy

- [ ] Home pública abre e lista as hospedagens com fotos.
- [ ] Login do gestor funciona (`/gestor/login`).
- [ ] Criar uma reserva de teste com um e-mail novo → página de sucesso logada.
- [ ] Pedir magic link (`/perfil`) para esse e-mail → chega e-mail real e o
      link loga.
- [ ] Execuções dos 3 jobs no cron-job.org retornando 200.

## Pagamentos (Stripe) — desligado por padrão

Sem `STRIPE_SECRET_KEY`, o fluxo de reserva funciona sem pagamento (como na
demo). Com a chave configurada, o pedido passa pelo checkout: o cartão do
hóspede é **autorizado na solicitação** e **cobrado só quando o gestor
aprova** (captura manual — mesmo modelo do Airbnb). Recusa/expiração libera
a retenção; cancelamento de reserva paga faz estorno integral.

Para ativar:

1. Conta em [stripe.com](https://stripe.com) (modo teste funciona na hora;
   o onboarding do CNPJ do gestor é necessário só para dinheiro real).
2. `STRIPE_SECRET_KEY` = chave secreta (`sk_test_...` para testes).
3. Dashboard → Developers → Webhooks → Add endpoint:
   `https://<app>.vercel.app/api/webhooks/stripe`, eventos
   `checkout.session.completed` e `checkout.session.expired` →
   copiar o signing secret para `STRIPE_WEBHOOK_SECRET`.
4. Redeploy. Teste com o cartão `4242 4242 4242 4242` (qualquer validade
   futura/CVC).
5. Local: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
   (CLI do Stripe) e usar o secret que o comando imprime.

PIX fica para uma fase 2 (não suporta autorizar-sem-cobrar; exigirá fluxo
de estorno na recusa).

## O que pode ser trocado depois (sem novo deploy de código)

- **URL do iCal do Airbnb**: campo por hospedagem na tela de edição do gestor.
- **E-mail definitivo do gestor**: exige (1) atualizar o usuário gestor no
  banco (e-mail de login), e (2) refazer o OAuth do Gmail para a caixa nova —
  gerar novo refresh token e atualizar `GMAIL_*` na Vercel. O envio de magic
  link passa a sair da caixa nova automaticamente.
- **Domínio próprio**: Settings → Domains na Vercel; magic link e feed .ics
  usam a URL da requisição, então se ajustam sozinhos.
