# Solicitações de edição — memória do repositório

Este arquivo é a **memória versionada** dos pedidos do Marcelo. O que ele
escreve no botão **"Solicitar edições"** (canto inferior direito, visível só
para `rciolette@gmail.com` e `marcelo@concarga.com.br`) fica na tabela
`solicitacoes_edicao` do Supabase; aqui ficam as decisões já tomadas, para que
Raphael e Claude consigam planejar juntos sem depender de print de WhatsApp.

## Como funciona

1. **Marcelo registra** no app: escolhe a tela, descreve o que está errado e
   **como quer que fique**, e marca a urgência (alta / média / baixa).
2. **O pedido fica na lista** dentro do mesmo modal, com status
   `Aberta → Em análise → Feita`.
3. **Para planejar**, o botão "Copiar como texto" / "⤓ Baixar .md" exporta tudo
   em markdown, no mesmo formato das seções abaixo — é só colar aqui, ou pedir
   ao Claude para ler a tabela direto pelo MCP do Supabase.
4. **Quando um pedido vira código**, o commit cita o título do pedido e o
   status passa para "Feita".

## Onde está cada peça

| Peça | Arquivo |
|---|---|
| Botão flutuante + modal | `components/ui/SolicitarEdicoes.tsx` |
| Acesso ao banco, lista de e-mails e exportação em markdown | `lib/solicitacoes.ts` |
| Tabela, índice e RLS | `supabase/migrations/20261014_solicitacoes_edicao.sql` |
| Montagem no shell do app (sem página nova) | `app/layout.tsx` |

Para liberar mais alguém, acrescente o e-mail em **dois** lugares:
`EMAILS_SOLICITACOES` em `lib/solicitacoes.ts` e a função
`public.pode_ver_solicitacoes()` no banco. Só o cliente não basta — a RLS é
quem realmente tranca.

---

## Pedidos já atendidos (antes do canal existir)

Vindos do WhatsApp em 02/10 e das conversas de 14/10:

- Carga com **placa a definir** e botão **Resetar o dia**.
- **Reabrir carga** (aprovada/enviada volta para edição).
- **Acerto de canhoto em XLSX** no modelo `Notas021026`, com PESO e
  QTD.ENT (entregas = destinatários distintos) e rodapé de assinatura.
- **Sugestão de placa por rota de entrega**, alimentada pela planilha
  `ROTAS_13.02.xlsm` e pelo histórico de cargas.
- **Peso sempre em kg exatos**, nunca em toneladas.
- **Observação da NF** abre o texto completo num balão (era cortado pela célula).
- **Rotas do dia** abre em "Em aberto"; aprovadas e enviadas saem da lista
  principal, com contador, **sem apagar nada**.
- **Histórico sobrevive à exclusão** da carga, com o bloco "Cargas excluídas
  no período".
- **QUINZENAL de segunda a sábado**; DIÁRIO incluindo sábado.

## Dúvidas em aberto com o Marcelo

1. Placas dos motoristas que não casaram com veículo ativo: MOISES VINICIUS,
   PAULINHO, MARCELO F, NESTOR, MOACIR, ALESSANDRO, ANDRE e PEDRO.
2. Rotas de entrega sem veículo preferencial: rodízio proposital ou falta de
   cadastro?
3. O perfil de operador deve perder o botão "Aprovar"?
4. Carga aprovada que precisa mudar: basta Reabrir → editar?
5. O acerto de canhoto precisa também de uma versão CSV simples?

## Registro dos pedidos

> Cole aqui a exportação do modal sempre que fechar um ciclo de ajustes.

_(ainda sem pedidos registrados pelo canal)_
