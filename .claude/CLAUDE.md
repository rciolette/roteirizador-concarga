# Concarga Roteirizador — Contexto do Projeto

## Stack
- Next.js 14 App Router + Tailwind CSS + shadcn/ui
- Supabase: qtbaqcxxoygpqecezbdy
- Deploy: Vercel (rciolette/roteirizador-concarga)
- n8n: https://n8n.rcdigitais.com.br

## MCP Supabase — regra crítica
- Usar SEMPRE o MCP `mcp__supabase__*` (prefixo `mcp__supabase__`)
- NUNCA usar `mcp__supabase-roi-ventures__*` (projeto errado) nem `mcp__claude_ai_Supabase__*` (sem permissão)
- O .mcp.json do projeto já aponta para qtbaqcxxoygpqecezbdy — não alterar
- Se ocorrer erro de autenticação: chamar `mcp__supabase__authenticate` uma vez e aguardar o usuário autorizar no browser

## Regras obrigatórias
- Sempre consultar o Supabase antes de criar novas tabelas ou colunas
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

## Webhooks n8n
- WF-A: https://n8n.rcdigitais.com.br/webhook/Execute-SQL-SIAT (consulta NFs)
- WF-B: https://n8n.rcdigitais.com.br/webhook/gerar-rotas (gerador IA)
- WF-C: https://n8n.rcdigitais.com.br/webhook/n8n_chatbot_concarga (agente WhatsApp)

## Workflow n8n On Schedule Trigger
- WF-05: sync SIAT → Supabase

## Comportamento esperado do agente
1. Sempre ler os arquivos relevantes antes de modificar
2. Propor a mudança e aguardar confirmação antes de implementar
3. Rodar npx tsc --noEmit após qualquer alteração de TypeScript
4. Nunca criar páginas novas — o app tem páginas fixas: /, /rotas, /historico, /frota, /configuracoes
5. Reportar o que foi feito ao finalizar cada tarefa