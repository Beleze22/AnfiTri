# Plataforma de agendamentos para hospedagens — design e UI/UX

> Documento de referência da fase de design. Consolida o design system (tokens, componentes, padrões de interação) e a especificação de cada tela definida na fase de arquitetura. Serve como input direto para implementação (incluindo via Claude Code) — todos os valores aqui (cores, espaçamentos, nomes de componentes) devem ser usados literalmente no código, não como sugestão aproximada.

## 1. Princípios de design

- **Minimalista/clean**, no estilo Airbnb: fundo neutro predominante, com a cor de marca usada só como destaque pontual (accent), nunca como cor de fundo extensa.
- **Mobile-first na área pública** (hóspedes), **desktop-first na área do gestor** (uso majoritariamente em computador, conforme decisão de produto).
- Toda cor definida como **token/variável**, nunca hardcoded — a paleta atual veio da identidade visual da marca "anfitri" (extraída de material comercial existente) e deve ser trivial de substituir no futuro.
- Componentes e padrões de interação são **reaproveitados entre telas** sempre que possível (ex: painel lateral de detalhes, código de cores de status) — não recriar o mesmo conceito de formas diferentes em páginas distintas.

## 2. Design tokens

### 2.1 Cores

| Token | Valor | Uso |
|---|---|---|
| `--color-bg` | `#FAFAFA` | Fundo geral da página |
| `--color-surface` | `#FFFFFF` | Cards, painéis, superfícies elevadas |
| `--color-border` | `#E5E3DE` | Bordas sutis, divisores |
| `--color-text-primary` | `#272727` | Texto principal |
| `--color-text-secondary` | `#6B6862` | Texto secundário, legendas, metadados |
| `--color-accent` | `#F86363` | Cor de marca. Botões primários, links, elementos selecionados, navegação ativa |
| `--color-accent-light` | `#FDE8E8` | Fundo suave do accent (badges, destaques, hover) |
| `--color-accent-dark` | `#D75656` | Hover/active do accent, texto sobre `accent-light` |
| `--color-accent-text` | `#FFFFFF` | Texto sobre fundo `accent` |

**Cores de status** (usadas de forma consistente em todas as telas, gestor e hóspede):

| Token | Valor | Status que representa |
|---|---|---|
| `--color-green` | `#3A9D6F` | Confirmado |
| `--color-green-light` | `#E5F3ED` | Fundo suave de confirmado |
| `--color-amber` | `#E0A030` | Pendente |
| `--color-amber-light` | `#FBF1DE` | Fundo suave de pendente |
| `--color-text-secondary` | `#6B6862` | Cancelado / expirado / concluído (reaproveita o cinza secundário) |
| `--color-blue` | `#4F7CAC` | Origem = Airbnb (usado no calendário consolidado do gestor) |
| `--color-blue-light` | `#E6EDF5` | Fundo suave de origem Airbnb |

> **Nota de origem:** a paleta de accent foi extraída do material comercial da marca "anfitri" (coral `#F86363`, texto `#272727`). Caso a identidade visual mude no futuro, a troca deve se limitar a estes tokens — nenhuma cor deve estar hardcoded em componentes individuais.

### 2.2 Formato e espaçamento

| Token | Valor | Uso |
|---|---|---|
| `--radius-card` | `14px`–`16px` | Cards, painéis, inputs |
| `--radius-pill` | `999px` | Botões de ação principal, badges, chips de filtro |
| Border padrão | `1px solid var(--color-border)` | Toda borda sutil de card/input |

### 2.3 Tipografia

- Família única sans-serif (system font: `-apple-system` e equivalentes) para todo o produto — hierarquia construída por **peso e tamanho**, não por troca de fonte.
- Tamanhos de referência: títulos de página `18–20px` (peso 600), títulos de card `14–15px` (peso 500–600), corpo `13–14px`, legendas/metadados `11–12.5px`.

### 2.4 Iconografia

- Biblioteca de ícones de linha (estilo Tabler Icons) usada em toda a interface: navegação, badges, botões com ícone.

## 3. Padrões de interação reutilizáveis

Estes padrões aparecem em mais de uma tela e devem ser implementados como **componentes únicos reaproveitados**, não recriados por página.

### 3.1 Painel lateral de detalhes (gestor)

- Usado no **Dashboard** (detalhe de reserva pendente) e no **Calendário e bookings** (detalhe de qualquer reserva).
- Desliza da direita, ~340px de largura, com overlay escurecendo o restante da tela (`rgba(39,39,39,0.25)`).
- Conteúdo do painel **se adapta à origem/status da reserva**:
  - Reserva `pendente` (origem `site`/`manual`): mostra dados de contato do hóspede (nome, telefone, e-mail), botão de atalho para WhatsApp, botão "Ver conversa" (leva ao inbox), e ações **Confirmar reserva** / **Cancelar** no final.
  - Reserva `confirmado` com origem `airbnb`: mostra apenas a informação de origem ("Reservado direto no Airbnb") e um aviso de que a comunicação acontece pelo próprio Airbnb — **sem** botões de contato direto nem de confirmar/cancelar (não fazem sentido nesse caso).
  - Reserva `confirmado` com origem `site`/`manual`: mostra contato + opção de cancelar (sem botão de confirmar, já que já está confirmada).

### 3.2 Código de cores de status (global)

Aplicado de forma idêntica em badges, bolinhas de status e bordas de card, em qualquer tela (hóspede ou gestor):

- 🟡 Âmbar = `pendente`
- 🟢 Verde = `confirmado`
- ⚪ Cinza (texto secundário) = `cancelado` / `expirado` / `concluído`
- 🔵 Azul = indicador de origem Airbnb (usado especificamente no calendário consolidado, onde a cor representa origem, não status)

### 3.3 Calendário com seleção de intervalo

- Usado na **página da hospedagem** (lado público).
- Dias ocupados: fundo cinza claro (`var(--color-border)` em baixa opacidade), texto tachado.
- Intervalo selecionado: fundo `--color-accent`, cantos arredondados (`border-radius: 50%`) apenas nas extremidades do intervalo (check-in e check-out), reto no meio — efeito de "pílula contínua".
- Navegação por mês (chevron esquerda/direita) acima da grade.

### 3.4 Grade de calendário consolidado (gestor)

- Usado em **Calendário e bookings**.
- Layout: hospedagens nas linhas, dias nas colunas.
- **Navegação por semana** (não por mês) — 7 colunas, para manter espaço suficiente por dia e permitir exibir o nome do hóspede dentro da própria barra de ocupação.
- Coluna correspondente ao dia atual recebe destaque sutil (fundo `--color-accent-light` no cabeçalho da coluna).
- Cada reserva é uma barra colorida (ver código de cores de status/origem) com cantos arredondados nas extremidades; clique abre o painel lateral de detalhes (3.1).
- Botão "Hoje" ao lado da navegação para retornar rapidamente à semana atual.

### 3.5 Separação de áreas "disponível" vs. "indisponível" (vitrine pública)

- Antes de o hóspede informar datas: lista simples de hospedagens, **sem badge de disponibilidade** (badge sem data de referência não é informativo).
- Depois de informar datas: duas seções —
  - "Disponíveis nessas datas": cards completos, com preço já calculado para o período (**não** por noite).
  - "Indisponíveis nesse período": lista compacta (foto pequena + nome + "Ocupado nesse período"), com opacidade reduzida (~0.55), ainda clicável.

### 3.6 Bottom navigation (área pública, mobile)

- Fixo na parte inferior da viewport (`position: fixed` ou `sticky`, nunca rola junto com o conteúdo).
- 3 itens: Início, Mensagens, Perfil — com ícone + label, item ativo em `--color-accent`.
- Exceção: na página da hospedagem, o bottom nav é substituído por uma **barra de ação fixa** com preço total + botão "Reservar", já que a ação principal da tela é diferente de navegação.

### 3.7 Sidebar (área do gestor, desktop)

- Fixa à esquerda, ~200px de largura.
- Itens: Dashboard, Hospedagens, Calendário, Mensagens, Regras de preço, Configurações — ícone + label, item ativo com fundo `--color-accent-light` e borda à direita em `--color-accent`.
- Identificação do usuário logado fixada na base da sidebar.

## 4. Especificação por tela

### 4.1 Home / vitrine geral (público, mobile-first)

- Header com nome da marca + ícone de perfil.
- Campo de busca com texto dinâmico: "Buscar por data ou local" (sem busca ativa) → "Quando você quer ir?" (convite a definir data).
- Chips de filtro por categoria (ex: Praia, Montanha) roláveis horizontalmente.
- Lista de cards de hospedagem (ver 3.5 para os dois estados).
- Bottom navigation fixo (3.6).

### 4.2 Página da hospedagem (público, mobile-first)

- Carrossel de fotos em tela cheia (aspect-ratio 4:3), com botão de voltar sobreposto e contador de fotos.
- Título, localização, capacidade (hóspedes/quartos).
- Descrição em texto corrido.
- Grade de comodidades (ícone + label, 2 colunas).
- Seção "Disponibilidade": calendário mensal com seleção de intervalo (3.3).
- Barra de ação fixa no rodapé: preço total calculado + datas selecionadas + botão "Reservar".

### 4.3 Confirmação de reserva pendente (público, mobile-first)

- Resumo da hospedagem e datas no topo.
- **Card de aviso obrigatório** (fundo `--color-accent-light`, ícone de relógio): explica que a data fica reservada provisoriamente, com prazo de confirmação explícito (valor vem de `default_expiry_hours`, calculado conforme regras da seção 6 do documento de arquitetura) e o que acontece se o prazo expirar.
- Formulário leve: nome completo, WhatsApp ou e-mail (sem senha).
- Resumo de preço (preço-base × noites = total).
- Botão de ação: **"Solicitar reserva"** (nunca "Confirmar" ou "Reservar" sozinho, para não sugerir reserva definitiva) + texto de apoio "Sem pagamento agora — só confirmamos o interesse".

### 4.4 Tela de sucesso (público, mobile-first)

- Ícone de confirmação + título **"Pedido enviado!"** (não "Reserva confirmada").
- Card-resumo da reserva com status (bolinha âmbar + "Pendente de confirmação") e prazo de expiração reafirmado.
- Caixa apontando para a aba Mensagens como canal de acompanhamento.
- Dois CTAs: "Ver minhas reservas" (primário) e "Voltar ao início" (secundário/texto).

### 4.5 Dashboard (gestor, desktop)

- Cards de métricas no topo: Pendentes, Confirmadas (mês), Ocupação (mês), Mensagens novas.
- Lista de "Reservas pendentes", **ordenada por urgência** (menor tempo restante primeiro). Cada item: foto, hospedagem + hóspede, datas, valor, tempo restante (cor âmbar se urgente, cinza se não), chevron indicando que é clicável.
- Clique no item abre o painel lateral de detalhes (3.1) — **os cards da lista não têm botões de ação diretamente**, para evitar ambiguidade de toque entre "abrir detalhes" e "confirmar/cancelar".
- Lista "Próximos check-ins" (mistura origens — manual, site, Airbnb — refletindo a visão consolidada do sistema).

### 4.6 Calendário e bookings (gestor, desktop)

- Grade de calendário consolidado (3.4), navegação semanal.
- Legenda de cores fixa no topo (Confirmado / Pendente / Airbnb).
- Clique em qualquer reserva abre o painel lateral de detalhes (3.1), com conteúdo adaptado à origem.

### 4.7 Hospedagens — cadastro/edição (gestor, desktop)

- Duas colunas:
  - **Esquerda** (conteúdo da vitrine): galeria de fotos com indicador de capa e botão de adicionar; informações básicas (título, descrição, hóspedes, quartos, preço-base); comodidades (chips com ícone + botão de adicionar).
  - **Direita** (integração Airbnb): dois cards distintos e não-intercambiáveis —
    1. "URL do calendário do Airbnb" — campo onde o gestor cola a URL .ics gerada pelo Airbnb (usada na camada de backup); mostra timestamp da última sincronização.
    2. "Nosso feed para o Airbnb" — URL gerada pela própria plataforma, com botão de copiar, para o gestor cadastrar no painel do Airbnb como calendário externo.
- Botão "Salvar alterações" ao final da coluna direita.
- Badge de status da propriedade (ex: "Publicada") ao lado do título.

### 4.8 Inbox de mensagens (gestor, desktop)

- Três colunas: sidebar de navegação, lista de conversas, thread aberta.
- Cada item da lista de conversas mostra: nome do hóspede, horário/data da última mensagem, **hospedagem + datas da reserva associada** (toda conversa pertence a um booking, nunca solta), preview da última mensagem. Não lida = fundo `--color-accent-light`.
- Header da thread: nome do hóspede + hospedagem/datas/status + botão "Ver reserva" (abre o painel de detalhes 3.1, reaproveitado, sem duplicar interface).
- Bolhas de mensagem: hóspede à esquerda (fundo `--color-bg`), gestor à direita (fundo `--color-accent`, texto branco).
- Campo de envio fixo no rodapé com botão circular de enviar.

### 4.9 Regras de preço (gestor, desktop)

- Seletor de hospedagem no topo (regras são por `Property`).
- Duas colunas:
  - **Esquerda**: lista de regras ativas (nome, período/condição, multiplicador — verde se aumenta o preço, coral/accent-dark se reduz), botão "Nova regra".
  - **Direita**: pré-visualização do calendário do mês corrente já com o preço final calculado por dia (combinação de todas as regras ativas), dias afetados por alguma regra destacados visualmente.

### 4.10 Configurações (gestor, desktop)

- Formulário único, largura limitada (~620px) para legibilidade.
- Três campos, cada um com (a) nome, (b) frase curta explicando o efeito prático, (c) controle (slider para valores numéricos, seletor de hora para horários):
  1. Prazo padrão de expiração (`default_expiry_hours`)
  2. Janela de silêncio (`quiet_hours_start` / `quiet_hours_end`)
  3. Margem após o silêncio (`grace_period_hours`)
- Caixa de exemplo dinâmico (fundo `--color-amber-light`) recalculando o resultado em texto a partir dos valores atuais — evita que o gestor precise calcular mentalmente o efeito combinado das três variáveis.

### 4.11 Perfil do hóspede (público, mobile-first)

- Header com avatar (iniciais), nome, e-mail.
- Lista "Minhas reservas": mesmo padrão visual e código de cores de status do dashboard do gestor (consistência entre as duas áreas do produto). Reserva pendente sempre em destaque, com prazo de expiração visível.
- Cada card é clicável e leva à conversa daquela reserva específica.
- Seção "Conta": editar dados pessoais, sair.
- Bottom navigation fixo (3.6).

## 5. Decisões de UX registradas (changelog da fase de design)

1. Paleta de cores extraída do material comercial da marca "anfitri" (coral `#F86363` como accent), com todos os valores em tokens substituíveis.
2. Área pública desenhada mobile-first; área do gestor desenhada desktop-first, refletindo o uso real esperado de cada uma.
3. Badge de disponibilidade na vitrine só aparece depois que o hóspede informa datas — antes disso, não há informação suficiente para ser útil.
4. Calendário de disponibilidade na página da hospedagem é visível por padrão (não escondido atrás de campos de check-in/check-out), por ser a informação central do produto.
5. Linguagem da reserva pelo site é deliberadamente "provisória" em todos os textos (botões, avisos, título da tela de sucesso) — nunca sugere reserva definitiva, para alinhar com o modelo de `Booking` pendente com expiração.
6. Card da lista de pendentes (dashboard do gestor) não tem botões de ação diretamente — só o painel lateral de detalhes, para eliminar ambiguidade entre "abrir detalhes" e "confirmar/cancelar" no mesmo toque.
7. Painel lateral de detalhes de reserva é um componente único, reaproveitado entre Dashboard e Calendário/bookings, com conteúdo adaptado por origem/status.
8. Calendário consolidado do gestor navega por semana (7 colunas), não por mês, para manter legibilidade e permitir exibir nome do hóspede direto na barra de ocupação.
9. Regras de preço sempre exibidas junto de uma pré-visualização de calendário com o efeito combinado, não isoladamente — uma regra sozinha não comunica o resultado prático.
10. Configurações de expiração usam sliders + exemplo dinâmico recalculado, em vez de campos numéricos isolados, dado que a lógica combina três variáveis de forma não totalmente intuitiva.
11. Código de cores de status (âmbar/verde/cinza) é idêntico em toda a plataforma, incluindo entre área do gestor e área do hóspede.

## 6. Próximos passos

- Fase de implementação: este documento, em conjunto com `arquitetura-e-escopo.md`, serve de input para o desenvolvimento (Claude Code).
- Recomenda-se implementar primeiro os tokens de design (seção 2) e os componentes reutilizáveis (seção 3) como base, antes das telas individuais (seção 4), para evitar duplicação de lógica visual.
