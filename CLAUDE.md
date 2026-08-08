@AGENTS.md

# Roteirizador Concarga — pasta de referência do projeto

**Esta pasta (`~/GitHub/roteirizador-concarga`) é a fonte oficial e única do projeto.**
Toda revisão, análise e edição do Roteirizador Concarga acontece aqui: ler os arquivos
reais desta pasta antes de opinar, e aplicar as mudanças aqui — nunca recriar código
fora dela nem trabalhar sobre cópias antigas.

Não confundir com os repositórios `Roi-Link-Generator` / `roi-link-generator-v2`
(ROI Link Generator), que são outro produto, com outro Supabase e outros fluxos.

## O que é

Painel web de gestão logística com geração automática de rotas via IA, integrado ao
SIAT. Next.js 16 (App Router) + React 18 + Tailwind v4 + TypeScript.

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
- **SIAT**: SQL Server (`siat.dyndns.info:10143`, base `SiatWeb_Concarga`).
- **Claude API** para geração de rotas, **n8n** para orquestração,
  **SendPulse** (WhatsApp motoristas), **Google Maps API**.

## Cuidados

- Next.js 16 tem breaking changes: consultar `node_modules/next/dist/docs/` antes de
  escrever código (ver `AGENTS.md`), não confiar em padrões de memória.
- **Cliente Supabase**: no browser, sempre `getSupabaseBrowser()` (`lib/supabase-browser.ts`);
  no servidor, `createSupabaseServerClient()` (`lib/supabase-server.ts`). A sessão vive em
  **cookie** — um `createClient()` do `supabase-js` usa localStorage, roda como `anon` e o RLS
  devolve zero linhas **sem erro**. Foi a causa do bug das listas vazias em "Gerar rotas".
- **Paginação**: PostgREST corta em 1000 linhas. Listagens completas (`motoristas` ~1,7k,
  `veiculos` ~2k) precisam de `fetchAllPages()` (`lib/supabase-paginate.ts`).
- Segredos ficam em `.env.local` (não versionado); `.env.example` lista as chaves.
- Branch de trabalho: `main`.
