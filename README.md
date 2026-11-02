# Concarga — Roteirizador

Painel web de gestão logística integrado ao SIAT. O operador monta as cargas do
dia **manualmente**: importa as notas fiscais pendentes, seleciona o que vai em
cada carga na grade, escolhe a placa e aprova.

> A geração automática de rotas por IA foi **aposentada em 02/11/2026**. Não há
> engine interno nem webhook do n8n no app — ver `CLAUDE.md`.

## Stack

- **Next.js 16** — App Router, React 18
- **Tailwind CSS v4** + shadcn/ui
- **TypeScript**
- **Supabase** — banco, autenticação e RLS (`qtbaqcxxoygpqecezbdy`)
- **SQL Server (SIAT)** — origem das notas fiscais, via MSSQL direto
- **Google Maps API** — geocodificação
- **Vercel** — hospedagem e cron diário de sync da frota

## Rodar localmente

```bash
npm install
npm run dev
```

Acesse http://localhost:3000. É preciso um `.env.local` — veja `.env.example`
para a lista de chaves.

## Telas

As páginas são fixas; não criar páginas novas.

| Rota | O que faz |
|---|---|
| `/` | Dashboard — KPIs do dia, alertas e mapa |
| `/rotas` | Rotas do dia — grade de NFs, montagem da carga, carga por veículo |
| `/aprovacoes` | Aprovar e marcar como enviada |
| `/historico` | Rotas por período, incluindo as cargas excluídas |
| `/frota` | Veículos, motoristas, disponibilidade e rotas por veículo |
| `/configuracoes` | Operação, grades, cidades, capacidades, logs e acessos |
| `/perfil` | Conta do usuário |

## Estrutura

```
app/            → páginas (App Router) e rotas de API
components/
  notas/        → grade de NFs e mapa da seleção
  ui/           → componentes reutilizáveis
  layout/       → Sidebar
  providers/    → contexto de dados, auth, tema, onboarding
lib/
  siat.ts, siat-db.ts      → SIAT via MSSQL
  webhooks.ts              → acesso às rotas no Supabase (RPCs)
  frota.ts, veiculos.ts    → frota, disponibilidade e capacidades
  maps.ts                  → link multi-parada do Google Maps
  acerto-canhoto.ts        → XLSX de acerto de canhoto
  rbac.ts, auth*.ts        → permissões e sessão
  utils.ts                 → helpers (inclui hojeISO)
supabase/migrations/       → schema versionado
docs/                      → especificação, pedidos do Marcelo, revisões
```

## Convenções que não dão para adivinhar

- **Data de hoje**: sempre `hojeISO()` de `lib/utils.ts` (fuso fixo
  `America/Sao_Paulo`). `toISOString()` devolve UTC e vira o dia às 21h.
- **Cliente Supabase**: `getSupabaseBrowser()` no browser,
  `createSupabaseServerClient()` no servidor. Um `createClient()` cru roda como
  `anon` e o RLS devolve zero linhas sem erro.
- **Paginação**: PostgREST corta em 1000 linhas; listagens completas usam
  `fetchAllPages()`.
- **Capacidade por veículo**: tabela `veiculo_capacidades`.
- **Peso** sempre em kg exatos, nunca em toneladas.

## Deploy

Push na `main` → deploy automático na Vercel. Rodar `npx tsc --noEmit` e
`npm run build` antes.
