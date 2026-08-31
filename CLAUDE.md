# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Comandos

```bash
npm run dev            # servidor de desenvolvimento (lê .env.local automaticamente)
npm run build          # next build — roda no CI, precisa de DATABASE_URL/DIRECT_URL/JWT_SECRET definidos (placeholders bastam)
npm run lint           # eslint (flat config, next core-web-vitals + typescript + prettier)
npm run format         # prettier --write .   |   npm run format:check no CI
npm test               # vitest run — só arquivos lib/**/*.test.ts, ambiente node
npx vitest run lib/server/pricing/calculate.test.ts   # um arquivo
npx vitest run -t "expira"                            # um teste por nome
npm run db:seed        # popula gestor + hospedagens de teste
npx prisma migrate dev --name <nome>   # cria migration (usa DIRECT_URL via prisma.config.ts)
npx prisma generate    # também roda no postinstall
```

**Setup de um clone novo:** o `postinstall` roda `prisma generate`, que lê `prisma.config.ts` → `env("DIRECT_URL")` a partir do `.env.local`. Sem esse arquivo (ou com `DIRECT_URL=` vazio), o `npm install` termina em `PrismaConfigEnvError: Cannot resolve environment variable: DIRECT_URL` — os pacotes já foram instalados, só o script de pós-instalação falhou. Copie `.env.local.example` para `.env.local` e preencha **antes** do primeiro install; valor vazio não conta como definido.

O CI (`.github/workflows/ci.yml`) roda, nesta ordem: `prisma generate`, `lint`, `format:check`, `test`, `build`. Rodar os quatro localmente antes de commitar evita ida e volta.

## Idioma

Todo o produto é pt-BR: textos de interface, mensagens de erro da API, comentários de código, mensagens de commit e até os valores dos enums do banco (`pendente`, `confirmado`, `gestor`, `hospede`). Código novo deve seguir isso — não introduza comentários ou identificadores de domínio em inglês.

## Fonte da verdade do produto

`escopo/arquitetura-e-escopo.md` (regras de negócio) e `escopo/design-ui-ux.md` (design system e especificação tela a tela) são o contrato do produto, não rascunhos. O código os cita por seção nos comentários (ex: "seção 6.2"). Antes de mudar comportamento de negócio ou visual, confira a seção correspondente; se a implementação divergir do documento de propósito, o comentário deve explicar por quê (é o padrão já usado em `prisma/schema.prisma`).

## Arquitetura

**Princípio central (arquitetura §9):** lógica de negócio vive em `lib/server/**`, nunca nas páginas nem espalhada em route handlers. Route handlers em `app/api/**` são finos: validam com Zod, checam sessão, chamam um serviço, formatam a resposta. Isso existe para um futuro app mobile consumir a mesma API.

- `lib/server/http.ts` — `apiError(code, message, status)` (formato de erro único da API), `requireSession(role?)`, `readJson()`. Use sempre esses helpers em rotas novas.
- `lib/db/client.ts` — singleton do Prisma com `@prisma/adapter-pg`. Runtime usa `DATABASE_URL` (pooler Supabase, 6543); o CLI do Prisma usa `DIRECT_URL` (5432) via `prisma.config.ts`.
- Server Components (páginas do gestor, página da hospedagem) chamam os serviços de `lib/server/**` diretamente; Client Components fazem `fetch` nas rotas de `app/api/**`.

**Next.js 16** — `proxy.ts` na raiz é o middleware (nome novo); protege `/gestor/:path*`. `params` de páginas e rotas é uma `Promise` e precisa de `await`. Antes de escrever código de framework, leia o guia relevante em `node_modules/next/dist/docs/`.

### Autenticação

JWT (`jose`) em cookie `session`, dois papéis. Gestor: e-mail + senha (bcrypt), sessão de 7 dias, protegido pelo `proxy.ts`. Hóspede: sem senha — magic link por e-mail (`lib/server/auth/magic-link.ts`), sessão de 60 dias. Uma reserva pelo site com e-mail já cadastrado nunca sobrescreve dados nem concede sessão (senão qualquer um assumiria a conta sabendo o e-mail).

### Reservas — o núcleo

`lib/server/booking/service.ts`. Ciclo: `pendente → confirmado | cancelado | expirado`. Criação pelo site roda numa transação **serializable** com `findOverlap` para evitar dupla reserva simultânea; `isAvailable` é a versão de leitura fora de transação, usada só pela vitrine. `expires_at` é calculado por `lib/server/booking/expiry.ts` conforme a §6.2 (prazo padrão + janela de silêncio + margem), com config por gestor e fallback embutido; um cron muda pendentes vencidos para `expirado`.

### Sincronização com o Airbnb (assimétrica, §3.2)

- **Airbnb → app (rápido):** Gmail API lê e-mails de confirmação → `lib/server/airbnb/email-parser.ts` + `email-service.ts` criam `Booking` com `source=airbnb` e `airbnbRef` (único, garante idempotência).
- **App → Airbnb (lento):** `lib/server/airbnb/export.ts` gera o feed `.ics` em `/api/properties/[id]/calendar.ics` (rota pública, cadastrada no painel do Airbnb). **Só bookings `confirmado` entram no feed** — pendentes bloqueiam a data apenas dentro da plataforma.
- **Backup:** `import.ts` importa o iCal oficial do Airbnb de hora em hora para pegar o que o parser perdeu. Cancelamentos feitos no Airbnb não são detectados — limitação assumida do MVP.

### Crons

Três rotas em `app/api/cron/**`, autenticadas por header `Authorization: Bearer $CRON_SECRET`. Agendadas externamente no cron-job.org (o Hobby da Vercel só roda cron diário) — ver `DEPLOY.md`. `expire-bookings` também limpa os contadores de rate limit vencidos.

### Pagamentos — atrás de feature flag

`lib/server/payments/stripe.ts`. Sem `STRIPE_SECRET_KEY`, `isPaymentsEnabled()` é falso e o fluxo de reserva segue sem pagamento — todo código novo precisa manter esse caminho funcionando. Com a chave: captura manual "à la Airbnb" — cartão autorizado na solicitação, capturado quando o gestor confirma, retenção liberada em recusa/expiração, estorno no cancelamento.

### Datas e fuso

`check_in`/`check_out` são `@db.Date` — trate-as sempre como meia-noite UTC e formate com `timeZone: "UTC"`, senão o fuso local (UTC-3) mostra o dia anterior. Para horários reais (expiração, janela de silêncio) use `lib/server/timezone.ts` (`America/Sao_Paulo`), que calcula offset via `Intl` e não depende do `TZ` do processo.

### Outros pontos não óbvios

- **Categorias** são dinâmicas: JSON em `SystemConfig` (`lib/server/categories.ts`), não enum — o gestor as edita em Configurações.
- **Preço:** multiplicação sequencial de todas as `PriceRule` aplicáveis ao dia (não soma de percentuais). `calculateNightPrices` é pura e testável sem banco; `calculatePriceForStay` busca do banco.
- **Rate limit** em Postgres (model `RateLimit`, janela fixa embutida na chave) em vez de Redis, para funcionar em serverless.
- **Upload de fotos:** só JPG/PNG/WebP; SVG é barrado de propósito (XSS armazenado no bucket público).
- **Mensagens** não têm websocket — polling (`MessageThread` a cada 5s, badge da `Sidebar` a cada 30s).
- `node-ical` está em `serverExternalPackages` no `next.config.ts` — não remova, quebra o build.

## UI

Tailwind v4 com tokens declarados em `@theme` dentro de [app/globals.css](app/globals.css), derivados de `escopo/design-ui-ux.md` §2. **Nenhuma cor, raio ou tamanho de texto literal em componente** — use os utilitários gerados (`bg-accent`, `text-text-secondary`, `rounded-card`, `text-page-title`). Ícones: `@tabler/icons-react`. Público é mobile-first (`components/public/`, `BottomNav`); painel do gestor é desktop-first (`components/manager/`, `Sidebar`). Padrões que aparecem em mais de uma tela (painel lateral de detalhes, badge de status, calendário de intervalo) são componentes únicos reaproveitados — não recrie variantes por página.
