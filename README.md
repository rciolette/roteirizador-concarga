# Concarga — Roteirizador Inteligente

Painel web de gestão logística com geração automática de rotas via IA, integrado ao sistema SIAT via SQL.

## Stack

- **Next.js 14** — App Router
- **Tailwind CSS v4** — estilização
- **TypeScript** — tipagem
- **Vercel** — hospedagem
- **Supabase** — banco de dados (a integrar)
- **Claude API** — agente de IA para geração de rotas (a integrar)
- **n8n** — orquestração de workflows (externo)
- **SendPulse** — WhatsApp para motoristas (externo)

## Rodar localmente

```bash
npm install
npm run dev
```

Acesse: http://localhost:3000

## Deploy no Vercel

1. Suba o repositório no GitHub
2. Importe o projeto no [vercel.com](https://vercel.com)
3. Deploy automático a cada `git push`

## Variáveis de ambiente (a configurar no Vercel)

```env
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SIAT_SQL_HOST=siat.dyndns.info
SIAT_SQL_PORT=10143
SIAT_SQL_DATABASE=SiatWeb_Concarga
SIAT_SQL_USER=SIAT_BI
SIAT_SQL_PASSWORD=SIAT_BI
```

## Estrutura do projeto

```
app/
  page.tsx              → Dashboard
  rotas/page.tsx        → Rotas do dia + geração via IA
  historico/page.tsx    → Histórico de rotas
  configuracoes/page.tsx → Configurações completas
components/
  layout/Sidebar.tsx    → Navegação lateral
  ui/index.tsx          → Componentes reutilizáveis
  dashboard/            → Componentes do dashboard
lib/
  data.ts               → Mock data + utilitários
  useImport.ts          → Hook de importação SIAT
types/
  index.ts              → Tipagem global
```

## Próximos passos

- [ ] Integrar Claude API no endpoint `/api/gerar-rotas`
- [ ] Conectar Supabase para persistência real
- [ ] Implementar query SQL real via n8n webhook
- [ ] Integrar SendPulse para envio ao motorista
