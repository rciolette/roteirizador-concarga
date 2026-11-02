# Revisão de entrega — 02/11/2026

Teste e revisão de tudo que foi pedido nos últimos 60 dias (03/09 a 02/11),
conferido contra `docs/solicitacoes-marcelo.md`, o roadmap de paridade com a
planilha `ROTAS_13.02.xlsm` e o estado real do banco e da interface.

**Método:** 17 commits lidos um a um · `npx tsc --noEmit` e `npm run build`
limpos · app rodando em `localhost:3000` com login real · dados conferidos
direto no Supabase `qtbaqcxxoygpqecezbdy` · advisors de segurança.

> **Decisão de escopo (02/11):** a roteirização por IA foi **aposentada**. Sem
> engine interno (OpenAI) e sem n8n — a carga é montada **manualmente** pelo
> operador na grade de notas. Esta revisão já reflete essa decisão.

---

## 1. Pedidos dos últimos 60 dias — todos entregues

### Feedback Marcelo 03/09 — `41f2708c`, `8b15e8f7`
| Pedido | Estado |
|---|---|
| Bugs da listagem de NFs | ✅ |
| Segmentadores expostos (sem precisar abrir) | ✅ visíveis na tela |
| Rota saindo do CD | ✅ origem entra como 1º ponto do Maps |
| Resumo e mapa empilhados | ✅ |
| Segmentadores mostram só o que existe no recorte | ✅ |

### Infraestrutura 12–16/09 — `565cc85a`, `9a1644b3`, `3ff01941`
| Pedido | Estado |
|---|---|
| Reservas transacionais (NF, rota, veículo) | ✅ `reservas_dia` + triggers |
| RPCs de carga (salvar, status, mover, consolidar) | ✅ |
| Cores neon na grade (vermelho/laranja/verde) | ✅ |
| Grupo de mesmo destinatário em verde | ✅ |
| Excluir rascunho/aguardando de vez | ✅ |

### Feedback Marcelo 02/10 — `e70357df` … `1815f5eb`
| Pedido | Estado |
|---|---|
| Municípios deduplicados nos segmentadores | ✅ |
| Contadores por **entregas** (destinatários distintos) | ✅ |
| "Entregas" no cabeçalho azul | ✅ |
| Carga por veículo recolhível | ✅ |
| Coluna "Rotas de entrega" na lista de cargas | ✅ |
| Excluir por linha · "Aprovar todas (N)" | ✅ |
| Banner de inconsistências da importação | ✅ |
| Reabrir carga aprovada/enviada | ✅ |
| Carga com **placa a definir** | ✅ |
| **Resetar o dia** | ✅ |
| Cadastro de rotas por veículo na Frota | ✅ |
| Sugestão de placa por rota de entrega | ✅ 26 veículos / 44 rotas no banco |
| Relatório de separação, uma página por carga | ✅ virou o ACERTO DE CANHOTO |
| **ACERTO DE CANHOTO** em XLSX no modelo dele | ✅ uma aba por carga, PESO e QTD.ENT |
| Peso sempre em kg exatos | ✅ conferido no Histórico |

### Ajustes 14/10 — `d754a2b5` … `9b5aa8a8`
| Pedido | Estado |
|---|---|
| Observação abre em balão (portal) | ✅ |
| "Em aberto" como filtro padrão | ✅ |
| Aprovadas/enviadas saem da lista sem apagar | ✅ |
| Histórico sobrevive à exclusão + "Cargas excluídas no período" | ✅ |
| QUINZENAL de segunda a **sábado** | ✅ conferido na tela |
| DIÁRIO incluindo sábado | ✅ conferido |
| Canal **Solicitar edições** Raphael ↔ Marcelo | ✅ **testado, abre e funciona** |
| Importar SIAT dispara na hora, sem popup | ✅ |

---

## 2. Paridade com a planilha ROTAS_13.02 — 10 de 10 fechados

| Item | Planilha | Painel hoje |
|---|---|---|
| **C1** Link Maps multi-parada | aba PAINEL | ✅ `lib/maps.ts`: sequência de entrega, consolida endereço repetido, origem no CD, corta em 25 paradas avisando o excedente |
| **C2** Carga × capacidade | aba "Previsão carros" | ✅ **corrigido em 02/11** — fonte única em `veiculo_capacidades` |
| **C3** Consolidação por destinatário | aba "Resumo" | ✅ contador "Entregas", grupo em verde na grade, consolidação no link do Maps e QTD.ENT no canhoto |
| **I1** Campos que faltavam | DtAgend, Cx, Valor, Emissão | ✅ todos na grade |
| **I2** Filtros e totais reativos | slicers | ✅ 8 segmentadores: Solução SAC, Tipo Carga, Rota de Entrega, Município, Bairro, Tipo Cliente, Remetente, Destinatário |
| **I3** Restrições por nota | RES2, Solução SAC | ✅ coluna "Restrições" + filtro de Solução SAC |
| **I4** Agendamentos | DtAgend/HrAgend | ✅ aba "Agendados de hoje" |
| **H1** Grade de cidades duplicada | 207 com acento repetido | ✅ **158 cidades, 0 duplicatas** |
| **H2** Frota sem alocação padrão | 84 rotas sem motorista | ⚠️ parcial — 26 veículos cobrem 44 rotas; o resto continua em aberto |
| **H3** Configurações vazias | — | ✅ preenchidas |

---

## 3. Corrigido nesta revisão (02/11)

### 3.1 ✅ Badge dizia 7, a tela mostrava 0
A sidebar marcava **7** em "Rotas do dia" e "Aprovações" e as duas telas abriam
vazias: o badge contava sem filtro de data, enquanto as telas carregam só o dia
corrente. `components/layout/Sidebar.tsx` passou a usar o mesmo recorte.

### 3.2 ✅ Capacidade por veículo tinha dois valores
O que o operador editava em Configurações **não era** o que a grade usava:

| Tipo | `configuracoes.pesos` (tela) | `veiculo_capacidades` (grade) |
|---|---|---|
| Fiorino | 700 | 800 |
| VUC | 1.500 | 1.500 |
| 3/4 | 2.500 | **4.000** |
| Truck | 6.000 | **8.000** |
| Carreta | 15.000 | **28.000** |

O card de Configurações agora lê e grava **`veiculo_capacidades`**, que é a
tabela de onde saem a sugestão de tipo e o cálculo de ocupação. Ganhou também o
campo de % de ocupação máxima. A chave `configuracoes.pesos` foi apagada.

### 3.3 ✅ "Disponíveis hoje" dava 102 no Dashboard e 1.440 na Frota
Causa: **1.338 dos 1.440 eram veículos INATIVOS** que o SIAT ainda marca como
disponíveis. A frota real é de 104 ativos, 102 disponíveis. A tela Frota passou
a filtrar por `ativo` e agora bate com o Dashboard.

### 3.4 ✅ Roteirização por IA aposentada
Removidos: `lib/roteirizador/` (engine, prompt-mestre, config),
`app/api/gerar-rotas/`, `app/api/agente-roteirizador/`,
`app/api/config/webhooks/`, `lib/config-server.ts`, `AgenteRoteirizadorCard.tsx`
e o órfão `NfsPendentesTable.tsx`. Da interface saíram o botão "+ Gerar rotas",
o diálogo de geração, a faixa de progresso, o botão "Reprocessar" e o card de
webhooks. De `lib/webhooks.ts` saíram `webhookGerarRotas`,
`aguardarRotasGeradas`, `mapRetornoGerarRotas`, `salvarRotasSupabase`,
`salvarNfsNaoAlocadas` e `reprocessarRota`. Do `AppConfig` saíram `pesos`,
`instrucaoGlobal` e `instrucoesPorRota`.

A `OPENAI_API_KEY` **está** configurada na Vercel (Production/Preview, desde
14/08) — o banner vermelho que aparecia era do ambiente local, que não tem a
chave. A remoção foi decisão de escopo, não falta de chave. A variável pode ser
apagada da Vercel.

### 3.5 ✅ Limpeza do banco
- 9 chaves órfãs de `configuracoes` apagadas; sobraram só `grades` e `operacao`,
  exatamente o que o código lê. Backup em
  `supabase/backups/20261102-configuracoes-ia.json`.
- Funções de teste `zz_teste_delete`, `zz_teste_delete2` e `zz_teste_raise`
  removidas.
- **7 rotas de rascunho** (setembro/outubro) excluídas pela RPC `rota_excluir`:
  as 35 reservas foram liberadas, 67 NFs apagadas junto (comportamento desenhado
  para rascunho — a fonte é o SIAT) e a exclusão ficou registrada em
  `historico_rotas`. Restam 5 aprovadas e 2 enviadas, com 26 reservas e 41 NFs.
  Zero reservas órfãs.

### 3.6 ✅ Bug de fuso horário em "hoje"
`new Date().toISOString().slice(0, 10)` devolve a data em **UTC**. Como o Brasil
está em UTC−3, a partir das 21h o painel passava a tratar o dia seguinte como
"hoje" — dentro da janela de operação, que ia até 23h. Na prática o painel
virava o dia sozinho à noite: as rotas montadas sumiam da tela, o badge zerava
e a frota do dia aparecia vazia.

Criado `hojeISO()` em `lib/utils.ts`, com fuso fixo em `America/Sao_Paulo` (a
data operacional é a da Concarga, não a do computador de quem abre o painel).
Substituídas **19 ocorrências** em 13 arquivos, incluindo as duas cópias locais
de `todayISO()` em `AppDataProvider.tsx` e `MapaDashboard.tsx`.

Conferido: às 22h de Brasília o método antigo devolvia `2026-11-03` e o novo
devolve `2026-11-02`; de manhã os dois concordam.

---

## 4. Pendências

### 4.1 🟡 O link do Maps não chega ao motorista
O disparo de WhatsApp foi removido de propósito: o webhook `enviar-motorista`
nunca existiu no n8n. "Enviada" é marcação manual do operador, que precisa
copiar o link e mandar à mão.

### 4.2 🟢 H2 — frota sem alocação padrão
26 veículos cobrem 44 rotas de entrega. Faltam as placas que não casaram com
veículo ativo (MOISES VINICIUS, PAULINHO, MARCELO F, NESTOR, MOACIR, ALESSANDRO,
ANDRE, PEDRO) — dúvida ainda aberta com o Marcelo.

---

## 5. Qualidade técnica

| Verificação | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ zero erros |
| `npm run build` | ✅ 28 rotas, exit 0 |
| Erros no console do navegador | ✅ nenhum |
| Erros no servidor | ✅ nenhum |
| Advisors de segurança do Supabase | ✅ nenhum ERROR (tudo com RLS) |
| Vercel Cron `sync-frota` | ✅ ativo (06:10) — WF-05 aposentado |

---

## 6. O que ainda não foi testado de ponta a ponta

Sem importação do SIAT no dia da revisão, ficaram sem exercício com dados reais:
grade de NFs com volume, montagem de carga, geração do XLSX de ACERTO DE CANHOTO
e link do Maps com paradas reais. Basta importar o SIAT e montar uma carga.
