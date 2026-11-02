# Concarga Roteirizador — Contexto do Projeto

## Stack
- Next.js 16 App Router + Tailwind CSS + shadcn/ui
- Supabase: qtbaqcxxoygpqecezbdy
- Deploy: Vercel (rciolette/roteirizador-concarga)
- n8n: https://n8n.rcdigitais.com.br

## MCPs permitidos — regra crítica

**Só existem DOIS MCPs válidos neste projeto. Qualquer outro é proibido.**

| Serviço  | MCP autorizado                | Alvo                                    |
|----------|-------------------------------|-----------------------------------------|
| Supabase | `Supabase-rot-rc/concarga`    | project_ref `qtbaqcxxoygpqecezbdy`      |
| n8n      | `mecp-n8n-rc-teste`           | `https://n8n.rcdigitais.com.br`         |

Proibidos, sem exceção — são de outro produto (ROI Link Generator) ou de outra
empresa (ROI Ventures), com outro banco e outros fluxos:
`n8n-RoiVentures` (`n8n.ecossistemaroi.com.br`), `supabase-link-generator`,
`supabase-roi-ventures`, `supabase-roi-mcp`, e o conector genérico `Supabase`.

- Antes de usar um MCP de Supabase, confirmar a identidade com `get_project_url`:
  tem que responder `https://qtbaqcxxoygpqecezbdy.supabase.co`. Nunca presumir
  pelo nome ou pelo ID do servidor.
- O `.mcp.json` do projeto já aponta para `qtbaqcxxoygpqecezbdy` — não alterar.
- Atenção: existe um `supabase` em escopo de usuário apontando para outro
  project_ref (`mnrnnmfaupvmjfgpzkou`). O escopo de projeto é o que vale.
- Nunca colocar Personal Access Token (`sbp_...`) em `settings.local.json`,
  comando de shell ou qualquer arquivo. Use os MCPs.

## Regras obrigatórias
- Sempre consultar o Supabase antes de criar novas tabelas ou colunas
- Data de "hoje" sempre por `hojeISO()` (`lib/utils.ts`), nunca `toISOString()`
- Capacidade de veículo vem de `veiculo_capacidades`, nunca de `configuracoes.pesos`
- Nunca fazer push direto — sempre aguardar confirmação do Raphael
- Nunca alterar arquivos de configuração (.env.local, vercel.json) sem confirmar
- TypeScript sem erros antes de qualquer commit
- Usar a paleta: primário #1B4F8A, fundo #D5E8F0

## Tabelas Supabase existentes
- motoristas (codigo_siat, nome, telefone, celular, sigla, ativo)
- veiculos (placa, modelo, categoria, capacidade_kg, situacao_siat, motorista_id, codigo_siat_motorista)
- rotas (data, codigo_rota, status, motorista_nome, peso_total, qtd_notas)
- notas_fiscais (rota_id, n_nfs, destinatario, municipio, peso_kg, cond)
- nfs_nao_alocadas, ocorrencias_whatsapp, historico_rotas, configuracoes, grade_cidades

## Webhooks n8n — o app NÃO usa mais nenhum

Aposentados em 02/11/2026 (commit `26438de5`), quando a roteirização passou a ser
manual. Ficam aqui só como histórico:

- ~~WF-A `Execute-SQL-SIAT`~~ → hoje é `/api/siat`, MSSQL direto (`lib/siat-db.ts`)
- ~~WF-B `gerar-rotas`~~ → a geração por IA foi removida; o operador monta a carga
- ~~WF-05 (schedule) sync SIAT → Supabase~~ → hoje é Vercel Cron (`vercel.json`, 06:10)
- WF-C `n8n_chatbot_concarga` (agente WhatsApp) — **segue existindo fora do app**,
  alimentando `ocorrencias_whatsapp`; o painel não o chama

Não criar webhook novo sem combinar com o Raphael: o caminho atual é código no
próprio app.

## Comportamento esperado do agente
1. Sempre ler os arquivos relevantes antes de modificar
2. Propor a mudança e aguardar confirmação antes de implementar
3. Rodar npx tsc --noEmit após qualquer alteração de TypeScript
4. Nunca criar páginas novas — o app tem páginas fixas: /, /rotas, /historico, /frota, /configuracoes
5. Reportar o que foi feito ao finalizar cada tarefa