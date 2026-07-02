# Plataforma de agendamentos para hospedagens — arquitetura e escopo

> Documento de referência da fase de arquitetura/escopo. Consolida as decisões tomadas antes de qualquer linha de código, para servir de base ao design (UI/UX) e à implementação — inclusive como input para o Claude Code.

## 1. Objetivo do projeto

Construir uma plataforma própria para gerenciar e divulgar hospedagens (2 a 10 imóveis, uso próprio do gestor/proprietário), com:

- Vitrine pública de cada hospedagem (fotos, descrição, comodidades).
- Calendário de disponibilidade sincronizado com o Airbnb nas duas direções.
- Reserva preliminar feita pelo próprio site (sem pagamento no MVP).
- Precificação dinâmica configurável.
- Mensagens entre hóspede e gestor.

## 2. Escala e restrições do projeto

| Aspecto | Decisão |
|---|---|
| Escala | 2 a 10 hospedagens, uso próprio (não é um SaaS multi-host) |
| Pagamento no MVP | Não. Modelo de dados já preparado para adicionar depois sem retrabalho |
| Mobile | Web responsivo mobile-first agora. Backend desenhado como API separada da interface, para permitir app nativo/React Native no futuro sem reescrever lógica de negócio |
| Público do mobile futuro | Hóspedes também (não só o gestor) |

## 3. A integração com o Airbnb — contexto e decisão

### 3.1 Por que não existe um caminho simples

- Não há API pública do Airbnb. O acesso oficial ("Homes API") é restrito a parceiros certificados (Smoobu, Lodgify, Hostex etc.), processo de meses voltado a empresas, não a hosts individuais.
- A alternativa gratuita e amplamente usada é o **iCal**: cada anúncio do Airbnb gera uma URL de calendário (.ics) que pode ser importada por terceiros e vice-versa.
- Limitações conhecidas do iCal: transmite apenas datas ocupadas/livres (não preço, não estadia mínima); atraso de sincronização de até 12h; nenhuma das plataformas avisa se um feed parar de funcionar.

### 3.2 Decisão adotada: sincronização assimétrica

Como o usuário é o próprio proprietário das hospedagens no Airbnb, usamos o canal mais rápido disponível em cada direção — não o mesmo mecanismo nos dois sentidos.

**Direção 1 — Airbnb → plataforma (quase instantânea):**

1. Hóspede reserva no Airbnb.
2. Airbnb envia e-mail de confirmação em segundos.
3. Um parser de e-mail (via Gmail API, ou ferramenta como Parseur/Mailparser) extrai datas de check-in/check-out e a propriedade.
4. Sistema cria um `Booking` com `source = airbnb` e `airbnb_ref` (código da reserva, evita duplicidade).
5. Data passa a aparecer como ocupada no calendário da plataforma.

**Direção 2 — plataforma → Airbnb (com atraso,~horas):**

1. Reserva confirmada na plataforma (manual pelo gestor, ou — no futuro — paga pelo hóspede).
2. Sistema gera um feed iCal próprio (uma URL por hospedagem, via biblioteca como `ical-generator`).
3. Essa URL é cadastrada no painel do Airbnb como "calendário externo" (qualquer host pode fazer isso, sem aprovação de parceiro).
4. Airbnb importa o feed periodicamente e bloqueia a data.

**Camada de backup:** o sistema também importa periodicamente o iCal oficial gerado pelo próprio Airbnb e compara com o banco de dados local, para detectar reservas que o parser de e-mail eventualmente não capturou (e-mail não entregue, mudança de formato, etc).

**Limitação assumida no MVP — cancelamentos no Airbnb:** o parser de e-mail trata apenas confirmações de novas reservas. Um cancelamento feito pelo hóspede ou pelo Airbnb **não** é detectado automaticamente; o booking permanece `confirmado` no sistema até o gestor notar a divergência e cancelar manualmente pelo painel. A camada de backup (iCal reverso) ajuda nisso de forma indireta: se uma data antes bloqueada no iCal do Airbnb volta a aparecer livre, é um sinal de possível cancelamento que o gestor deve investigar. Automatizar esse cruzamento fica como melhoria futura, fora do MVP.

**Regra importante:** somente bookings com `status = confirmado` são exportados no feed iCal para o Airbnb. Bookings `pendente` bloqueiam o calendário dentro da própria plataforma, mas não são propagados ao Airbnb — evita bloquear uma data por algo que pode expirar em poucas horas.

### 3.4 Autenticação

- **Gestor:** login com e-mail e senha (`password_hash` armazenado com hash seguro — ex: bcrypt). Único gestor no MVP, sem necessidade de múltiplos papéis administrativos.
- **Hóspede:** sem senha. Cadastro leve (nome + e-mail/telefone) feito no momento da reserva pelo site; acesso ao perfil/histórico via identificação simples (ex: link/código enviado por e-mail), a detalhar na implementação.
- Token-based (JWT) para ambos os papéis, conforme já definido na stack (seção 9), preparando o terreno para o app mobile futuro.

### 3.3 Por que não usamos scraping para preço dinâmico

- Os termos de uso do Airbnb proíbem explicitamente usar dados para "analisar, derivar ou otimizar" preços.
- Scrapers de terceiros existem no mercado, mas quebram a cada mudança de frontend do Airbnb e geram custo de manutenção desproporcional para 2-10 hospedagens.
- Risco direto: suspensão da conta de host.

**Decisão:** construir um motor de precificação dinâmica próprio, baseado em regras configuráveis (ver seção 5), em vez de copiar/raspar o preço do Airbnb.

## 4. Modelo de dados

### 4.1 Entidades principais

**Property** (hospedagem)
- `id`, `title`, `slug`, `description`, `max_guests`, `bedrooms`, `base_price`
- `airbnb_ical_url` — URL do calendário oficial do Airbnb, usada na camada de backup
- `status`

**Photo**
- `id`, `property_id`, `url`, `order`, `is_cover`

**Booking** (reserva — entidade central do sistema)
- `id`, `property_id`, `user_id`
- `check_in`, `check_out`
- `source` — `airbnb` | `manual` | `site` (este último usado pelo fluxo de reserva preliminar do próprio site; reservado também para uma futura reserva paga)
- `status` — `pendente` | `confirmado` | `cancelado` | `expirado`
- `airbnb_ref` — código da reserva extraído do e-mail, evita duplicidade
- `expires_at` — calculado apenas quando `source = site` e `status = pendente` (ver seção 6)
- `total_price`

**PriceRule**
- `id`, `property_id`, `rule_type`, `start_date`, `end_date`, `multiplier`

**Amenity**
- `id`, `property_id`, `name`, `icon`

**User**
- `id`, `name`, `email`, `password_hash` (apenas para `role = gestor`), `role` (`gestor` | `hospede`)
- Campos de configuração do gestor (ver seção 6.2): `default_expiry_hours`, `quiet_hours_start`, `quiet_hours_end`, `grace_period_hours`

**Conversation**
- `id`, `booking_id`, `status`

**Message**
- `id`, `conversation_id`, `sender_id`, `content`, `created_at`, `read`

### 4.2 Relacionamentos

- Uma `Property` tem várias `Photo`, vários `Booking`, várias `PriceRule`, várias `Amenity`.
- Um `Booking` pertence a um `User` (hóspede) e a uma `Property`.
- Um `Booking` tem no máximo uma `Conversation`; uma `Conversation` tem várias `Message`.
- Um `User` envia várias `Message` e faz vários `Booking`.

## 5. Precificação dinâmica

Cada `Property` tem um `base_price`. O preço final de uma data é o `base_price` multiplicado pelas `PriceRule` aplicáveis (fim de semana, feriado/data comemorativa, alta/baixa estação, desconto por estadia longa). Feriados podem ser obtidos de uma API gratuita de feriados nacionais.

O gestor define e ajusta essas regras manualmente pelo painel — não há leitura do preço praticado pelo Airbnb.

## 6. Regras da reserva preliminar (booking pelo site)

### 6.1 Por que a data já fica reservada (e não só "consultada")

Quando o hóspede seleciona datas no site, o sistema cria imediatamente um `Booking` com `status = pendente`, antes de qualquer contato humano. Isso evita que duas pessoas selecionem a mesma data enquanto o gestor está em negociação com a primeira.

**Riscos identificados e mitigação:**

| Risco | Mitigação |
|---|---|
| Alguém seleciona datas sem intenção real de fechar, travando disponibilidade | Expiração automática (ver 6.2) |
| Gestor demora a responder e a data fica bloqueada sem necessidade | Prazo de expiração + destaque no dashboard |
| Pendente esquecido bloqueia a data indefinidamente | Job automático que expira pendentes vencidos |

### 6.2 Cálculo da expiração — configurável pelo gestor

Campos de configuração (por gestor, na tela de Configurações):

| Campo | Tipo | Exemplo |
|---|---|---|
| `default_expiry_hours` | inteiro | 6 |
| `quiet_hours_start` | hora | 22:00 |
| `quiet_hours_end` | hora | 07:00 |
| `grace_period_hours` | inteiro | 2 |

**Lógica de cálculo do `expires_at` no momento da criação do booking:**

1. Calcular `created_at + default_expiry_hours`.
2. Se esse horário cair dentro da janela de silêncio (`quiet_hours_start` até `quiet_hours_end`), substituir por `quiet_hours_end + grace_period_hours`.
3. Caso contrário, manter o valor do passo 1.

**Exemplo:** reserva às 23h30, prazo padrão 6h, silêncio 22h–07h, margem 2h → 23h30 + 6h = 05h30 → cai no silêncio → expiração final = 07h00 + 2h = **09h00**.

Um job periódico verifica bookings `pendente` com `expires_at` no passado e muda o status para `expirado`, liberando a data.

### 6.3 Ciclo de status do Booking

```
pendente → confirmado   (gestor confirma; dispara exportação para o iCal do Airbnb)
pendente → cancelado    (gestor cancela manualmente, ex: hóspede desistiu)
pendente → expirado     (job automático, sem ação do gestor, após expires_at)
```

## 7. Mensagens

Cada `Booking` pode ter uma `Conversation` associada, contendo várias `Message`. Tanto o hóspede quanto o gestor acessam a conversa a partir do contexto da reserva (perfil do hóspede / painel do gestor). Não há notificação push no MVP (sem app); pode-se considerar e-mail de aviso de nova mensagem em uma iteração futura.

## 8. Mapa de páginas

### 8.1 Área pública (sem login)

- **Home / vitrine geral** — lista todas as hospedagens.
- **Página da hospedagem** — fotos, descrição, comodidades, calendário de disponibilidade.
- **Seleção de datas** — cria o `Booking` pendente.
- **Perfil do hóspede** — cadastro leve (nome + e-mail/telefone), histórico de reservas, mensagens.

### 8.2 Área do gestor (login obrigatório)

- **Dashboard** — visão geral, com reservas pendentes em destaque (prazo correndo).
- **Hospedagens** — cadastro/edição de propriedades, fotos, comodidades, URL do iCal do Airbnb.
- **Calendário e bookings** — visão consolidada de todas as reservas (de todas as origens), ações de confirmar/cancelar.
- **Inbox de mensagens** — conversas organizadas por booking.
- **Regras de preço** — cadastro de `PriceRule` por hospedagem.
- **Configurações** — `default_expiry_hours`, `quiet_hours_start/end`, `grace_period_hours`.

## 9. Stack técnica sugerida

| Camada | Escolha | Motivo |
|---|---|---|
| Frontend | Next.js (React) + Tailwind CSS | Performance, SEO para a vitrine, fácil evolução para fluxo de reserva/pagamento |
| Backend | API routes do Next.js (ou NestJS separado, se preferir mais estrutura) | Para 2-10 hospedagens, API routes já bastam |
| Banco de dados | PostgreSQL via Supabase ou Neon | Modelo relacional adequado às relações descritas na seção 4; Supabase já oferece auth, storage e painel admin |
| Storage de fotos | Supabase Storage ou Cloudflare R2 | Simples e barato |
| Sincronização Airbnb → app | Gmail API + parser de e-mail (ou Parseur/Mailparser) | Conforme seção 3.2 |
| Sincronização app → Airbnb | Geração de feed iCal (`ical-generator`) | Conforme seção 3.2 |
| Autenticação | Token-based (JWT) | Funciona igualmente bem em web e em um futuro app mobile |
| Deploy | Vercel | Integração nativa com Next.js |

**Princípio arquitetural:** a lógica de negócio (booking, sincronização, precificação) deve viver em uma camada de API bem definida, consumida pelo frontend web — nunca espalhada diretamente nas páginas. Isso permite que um futuro app mobile (React Native ou nativo) reutilize a mesma API sem reescrever regras de negócio.

## 10. Decisões registradas (changelog da fase de arquitetura)

1. Sincronização com Airbnb via e-mail parsing (rápido) + iCal export (com atraso), com camada de backup via iCal reverso.
2. Escala: 2-10 hospedagens, uso próprio.
3. MVP sem pagamento, mas modelo de dados já preparado para adicioná-lo sem refatoração.
4. Mobile: web responsivo mobile-first agora; API separada da interface para viabilizar app nativo no futuro, incluindo para hóspedes.
5. Stack: Next.js + Tailwind + PostgreSQL (Supabase) + Vercel.
6. Precificação dinâmica via motor de regras próprio (`PriceRule`) — não há scraping do Airbnb.
7. Mensagens: inbox simples vinculada a cada booking.
8. Reserva pelo site cria `Booking` com `status = pendente` imediatamente, bloqueando a data.
9. Expiração de pendentes configurável (prazo padrão + janela de silêncio + margem de tolerância), não fixa em código.
10. Apenas bookings confirmados são exportados ao Airbnb via iCal — pendentes ficam só na plataforma.
11. Autenticação do gestor via e-mail e senha (simples, já que há um único gestor no MVP).
12. Cancelamentos de reserva feitos no Airbnb não são detectados automaticamente — gestor cancela manualmente no painel ao notar a divergência; melhoria futura fora do MVP.

## 11. Pendências para a fase de implementação

Itens que ainda não foram decididos e devem ser resolvidos no início da implementação (ou conforme surgirem, sem bloquear o início):

- **Storage de fotos:** Supabase Storage ou Cloudflare R2 — escolher um na hora de configurar o projeto.
- **Categorias/filtros da vitrine:** quais categorias existem (ex: Praia, Montanha) e se isso é um campo livre ou uma lista fixa em `Property`.
- **Identificação do hóspede sem senha:** mecanismo exato de acesso ao perfil/histórico (ex: link mágico por e-mail, código por WhatsApp) — a decidir durante a implementação da autenticação.

## 12. Próximos passos

- Fase de design (UI/UX): layout de cada página listada na seção 8, com atenção especial à vitrine e ao calendário.
- Fase de implementação.
