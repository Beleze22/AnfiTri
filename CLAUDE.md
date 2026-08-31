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
npx prisma dev -P 5433 # Postgres local para os testes de integração (sem Docker)
npm run db:seed        # popula gestor + hospedagens de teste
npx prisma migrate dev --name <nome>   # cria migration (usa DIRECT_URL via prisma.config.ts)
npx prisma generate    # também roda no postinstall
```

**Setup de um clone novo:** o `postinstall` roda `prisma generate`, que lê `prisma.config.ts` → `env("DIRECT_URL")` a partir do `.env.local`. Sem esse arquivo (ou com `DIRECT_URL=` vazio), o `npm install` termina em `PrismaConfigEnvError: Cannot resolve environment variable: DIRECT_URL` — os pacotes já foram instalados, só o script de pós-instalação falhou. Copie `.env.local.example` para `.env.local` e preencha **antes** do primeiro install; valor vazio não conta como definido.

**Testes de integração** (`booking/service.test.ts`, `reports/faturamento.test.ts`) rodam contra Postgres de verdade — o que precisa de garantia são transações serializable, transições atômicas e o isolamento entre proprietários, e mock do Prisma testaria o mock. Eles leem `TEST_DATABASE_URL`; **sem essa variável se marcam como skip**, então uma suíte "verde" pode não ter verificado nada. Para rodá-los:

```bash
npx prisma dev -P 5433                      # sobe o Postgres, imprime a connection string
export DIRECT_URL="postgres://postgres:postgres@localhost:5433/template1?sslmode=disable"
npx prisma migrate deploy                   # aplica o schema nele
export TEST_DATABASE_URL="$DIRECT_URL&connection_limit=10&connect_timeout=0&pool_timeout=0"
npm test
```

Eles dão `TRUNCATE` nas tabelas — apontar `TEST_DATABASE_URL` para o banco de desenvolvimento apaga o catálogo e as fotos do cliente.

**Cuidado com teste dependente de relógio.** O prazo de expiração passa pela janela de silêncio, então asserções como "6 horas depois" passam de manhã e falham à tarde. Compare com a própria função de cálculo, não com uma constante.

O CI (`.github/workflows/ci.yml`) roda, nesta ordem: `prisma generate`, `migrate deploy` num serviço postgres, `lint`, `format:check`, `test`, `build`. Rodar os quatro localmente antes de commitar evita ida e volta.

**Depois de qualquer migration, reinicie o `npm run dev`.** O client do Prisma fica em memória e o servidor devolve 500 com "Unknown field" até subir de novo.

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

JWT (`jose`) em cookie `session`, **três papéis**. Gestor: e-mail + senha (bcrypt), 7 dias. Hóspede: magic link, 60 dias. Proprietário: magic link, 7 dias. O `proxy.ts` protege duas áreas com papéis distintos — `/gestor/*` exige gestor, `/proprietario/*` exige proprietário, e um não entra na área do outro.

Uma reserva pelo site com e-mail já cadastrado nunca sobrescreve dados nem concede sessão (senão qualquer um assumiria a conta sabendo o e-mail).

### Proprietários e a cascata financeira

O gestor administra imóveis de **terceiros**. `Property.ownerId` aponta para um usuário `proprietario` (nulo = imóvel do próprio gestor); `managementFeePercent` guarda a comissão, por imóvel.

```
bruto (totalPrice)  →  taxa da plataforma (platformFee)  →  recebido (netAmount)
                    →  comissão de administração          →  repasse ao proprietário
```

A comissão incide sobre o **líquido**, não sobre o bruto. O gestor vê "recebido"; o proprietário vê "repasse". Percentual nulo conta como zero e é reportado em `reservasSemComissao` — sem isso o dono veria um valor maior do que vai receber.

**`ownerId` vem sempre da sessão, nunca de parâmetro da requisição.** É a única barreira entre um proprietário e o faturamento alheio. As rotas `/api/owner/**` existem separadas das do gestor por isso; juntá-las deixaria a garantia a um `if` de distância. Há teste cobrindo o caso de um dono passar o id do imóvel de outro.

### Alertas de integração

`lib/server/alerts.ts`. O que os jobs detectam e não podem decidir sozinhos vira `Alert`, visível em `/gestor/alertas`. Antes isso ia para um array devolvido no JSON do cron que ninguém lia — o job respondia 200 com a integração quebrada. `dedupeKey` impede repetição a cada execução.

Regra que vale para código novo: **falha de integração vira alerta, não log.**

### Reservas — o núcleo

`lib/server/booking/service.ts`. Ciclo: `pendente → confirmado | cancelado | expirado`. Criação pelo site roda numa transação **serializable** com `findOverlap` para evitar dupla reserva simultânea; `isAvailable` é a versão de leitura fora de transação, usada só pela vitrine. `expires_at` é calculado por `lib/server/booking/expiry.ts` conforme a §6.2 (prazo padrão + janela de silêncio + margem), com config por gestor e fallback embutido; um cron muda pendentes vencidos para `expirado`.

### Sincronização com o Airbnb (assimétrica, §3.2)

- **Airbnb → app (rápido):** Gmail API lê e-mails → `email-parser.ts` reconhece três tipos (confirmação, cancelamento, alteração) e `email-service.ts` age. O parser foi escrito contra e-mails reais: **os rótulos existem, mas o valor vem na linha seguinte**, não depois de dois-pontos, e as datas de confirmação vêm sem ano (inferido a partir da data de envio do e-mail, não de "agora").
- **Sem código de confirmação, nada é criado.** Ele é a chave de deduplicação, e a busca no Gmail olha 3 dias para trás sem filtrar lidos — sem chave, a mesma reserva nasceria a cada execução. O código sai só de fontes estruturadas; um padrão genérico já transformou "AP1204" de endereço em código, e valor errado é pior que nenhum.
- **Cancelamento por e-mail cancela sozinho; por iCal, apenas alerta.** A diferença é o grau de confiança: o e-mail afirma o fato e identifica a reserva; o diff de iCal infere por ausência de dado, e feed quebrado é indistinguível de cancelamento em massa.
- **App → Airbnb (lento):** `export.ts` gera o feed `.ics` em `/api/properties/[id]/calendar.ics` (rota pública, cadastrada no painel do Airbnb). Só entram bookings `confirmado` **de origem `site` ou `manual`** — pendentes ficam só na plataforma, e devolver ao Airbnb o que veio dele criava um laço em que a data nunca era liberada após cancelamento.
- **Backup:** `import.ts` importa o iCal de hora em hora e faz o diff, comparando **conjuntos de dias ocupados, não UIDs** — reserva criada por e-mail guarda o código de confirmação em `airbnbRef`, enquanto a criada por iCal guarda o UID do evento. Três guardas contra falso positivo: feed vazio não conclui nada, reserva além do horizonte do feed é ignorada, e o alerta se resolve sozinho se a reserva reaparece.

### Crons

Três rotas em `app/api/cron/**`, autenticadas por header `Authorization: Bearer $CRON_SECRET`. Agendadas externamente no cron-job.org (o Hobby da Vercel só roda cron diário) — ver `DEPLOY.md`. `expire-bookings` também limpa os contadores de rate limit vencidos.

### Pagamentos — atrás de feature flag

`lib/server/payments/stripe.ts`. Sem `STRIPE_SECRET_KEY`, `isPaymentsEnabled()` é falso e o fluxo de reserva segue sem pagamento — todo código novo precisa manter esse caminho funcionando. Com a chave: captura manual "à la Airbnb" — cartão autorizado na solicitação, capturado quando o gestor confirma, retenção liberada em recusa/expiração, estorno no cancelamento.

### Relatórios

`lib/server/reports/faturamento.ts`. Duas convenções que não batem entre si de propósito: a **receita vai toda para o mês do check-in**, sem rateio; a **ocupação conta as noites dentro do período**, recortando estadias que atravessam a borda. Somar receita de fora do mês e dividir por noites de dentro daria diária média sem sentido, e a ocupação poderia passar de 100%.

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
