@AGENTS.md

# Roteirizador Concarga — pasta de referência do projeto

**Esta pasta (`~/GitHub/roteirizador-concarga`) é a fonte oficial e única do projeto.**
Toda revisão, análise e edição do Roteirizador Concarga acontece aqui: ler os arquivos
reais desta pasta antes de opinar, e aplicar as mudanças aqui — nunca recriar código
fora dela nem trabalhar sobre cópias antigas.

Não confundir com os repositórios `Roi-Link-Generator` / `roi-link-generator-v2`
(ROI Link Generator), que são outro produto, com outro Supabase e outros fluxos.

## O que é

Painel web de gestão logística integrado ao SIAT, onde o operador monta as cargas
do dia **manualmente**: seleciona as NFs na grade, escolhe a placa e aprova.
Next.js 16 (App Router) + React 18 + Tailwind v4 + TypeScript.

A geração de rotas por IA foi **aposentada em 02/11/2026** (commit `26438de5`) —
não existe mais engine interno nem webhook do n8n no app. Não propor religar.

Rotas do app: `/` (dashboard), `rotas`, `historico`, `frota`, `aprovacoes`,
`configuracoes`, `perfil`, `auth` / `login` / `esqueci-senha` / `redefinir-senha` /
`aceitar-convite`, `api`.

`lib/`: `siat.ts` + `siat-db.ts` (SIAT via MSSQL), `webhooks.ts`, `frota.ts`,
`sync-frota.ts`, `motoristas.ts`, `veiculos.ts`, `geocode.ts`, `rbac.ts`,
`auth.ts` / `auth-server.ts`, `supabase-*.ts`, `config-store.ts`, `export.ts`,
`log-atividade.ts`.

## Integrações

Só dois MCPs são autorizados aqui — ver `.claude/CLAUDE.md` para a regra completa:

- **Supabase**: MCP `Supabase-rot-rc/concarga`, project_ref `qtbaqcxxoygpqecezbdy`
  (ver `.mcp.json`). Confirmar sempre com `get_project_url` antes de usar.
- **n8n**: MCP `mecp-n8n-rc-teste` → `https://n8n.rcdigitais.com.br`. Nunca o
  `n8n-RoiVentures` (`n8n.ecossistemaroi.com.br`), que é de outra empresa.
  **O app não chama mais nenhum webhook do n8n** — a regra vale para quando se
  mexe nos fluxos que ainda vivem lá (ex.: chatbot de WhatsApp), não no painel.
- **SIAT**: SQL Server (`siat.dyndns.info:10143`, base `SiatWeb_Concarga`),
  consultado direto por `/api/siat` (MSSQL, sem intermediário).
- **Google Maps API** para geocodificação; o link multi-parada é montado no app
  (`lib/maps.ts`), não por serviço externo.
- Sync da frota: **Vercel Cron** diário (`vercel.json`, 06:10) — substituiu o WF-05.

## Cuidados

- Next.js 16 tem breaking changes: consultar `node_modules/next/dist/docs/` antes de
  escrever código (ver `AGENTS.md`), não confiar em padrões de memória.
- **Cliente Supabase**: no browser, sempre `getSupabaseBrowser()` (`lib/supabase-browser.ts`);
  no servidor, `createSupabaseServerClient()` (`lib/supabase-server.ts`). A sessão vive em
  **cookie** — um `createClient()` do `supabase-js` usa localStorage, roda como `anon` e o RLS
  devolve zero linhas **sem erro**. Foi a causa de um bug de listas vazias.
- **Paginação**: PostgREST corta em 1000 linhas. Listagens completas (`motoristas` ~1,7k,
  `veiculos` ~2k) precisam de `fetchAllPages()` (`lib/supabase-paginate.ts`).
- Segredos ficam em `.env.local` (não versionado); `.env.example` lista as chaves.
- **Data de hoje**: usar sempre `hojeISO()` (`lib/utils.ts`), com fuso fixo em
  `America/Sao_Paulo`. `new Date().toISOString().slice(0,10)` devolve UTC e, em
  UTC−3, faz o painel virar o dia às 21h — dentro da janela de operação.
- **Capacidade por tipo de veículo**: fonte única é a tabela `veiculo_capacidades`
  (a chave `configuracoes.pesos` foi apagada). É dela que saem a sugestão de tipo
  e o cálculo de ocupação.
- **Frota do dia**: `disponivel_hoje` sem filtro de `ativo` conta ~1.340 veículos
  inativos que o SIAT ainda marca. A frota real são ~104 ativos.
- Branch de trabalho: `main`.
