# Rotas do Dia — especificação de implementação

**Status:** aprovado para implementação

**Objetivo:** transformar a página `Rotas do dia` em uma área de trabalho para segmentar NFs importadas do SIAT, montar e revisar rotas sem duplicar NFs, rotas de entrega ou veículos no mesmo dia operacional.

## Decisões confirmadas

1. Uma rota em `aguardando` já reserva definitivamente suas NFs, rotas de entrega e veículo.
2. Ao rejeitar uma rota, todos esses recursos voltam a ficar disponíveis para segmentação.
3. Uma rota de entrega do SIAT usada para compor uma rota de veículo fica indisponível para novas segmentações naquele dia, mesmo quando uma rota de veículo reúne várias rotas de entrega.
4. Cores são alertas visuais; nenhuma cor bloqueia o salvamento por si só.
5. A exportação deve conter uma linha por rota **aprovada**, com os números das NFs concatenados e sem repetir NF ou veículo.
6. A importação de disponibilidade atualiza somente as placas presentes no arquivo; não deve resetar toda a frota do dia.
7. Toda referência visual de veículo deve usar `Placa | Sigla do motorista | Tipo de veículo`, por exemplo `AYAS712 | AYA | VUC`.

## Fontes de verdade

- **SIAT via SQL:** dados operacionais de NF, endereço, rota de entrega, peso, volume, agenda, observações, restrições, veículos e motoristas.
- **Supabase:** estado operacional criado no roteirizador: rotas, vínculos, aprovações, disponibilidade e configurações locais.
- **Planilhas XLSX de operação:** referência de organização visual, segmentação, prioridades e validação humana; não devem substituir silenciosamente dados do SIAT.

Em toda tela, integração e exportação, usar os dados importados do SIAT junto das configurações/cadastros persistidos no projeto. Não inventar placa, sigla, peso, endereço ou rota quando a fonte não os fornecer.

## Invariantes obrigatórios

Para uma mesma data operacional, e enquanto a rota estiver em `rascunho`, `aguardando`, `aprovada` ou `enviada`:

- Cada NF pertence a no máximo uma rota ativa.
- Cada rota de entrega do SIAT pode compor no máximo uma rota ativa.
- Cada veículo pode estar vinculado a no máximo uma rota ativa.
- Alterações são permitidas somente por uma operação explícita de edição/substituição confirmada pelo usuário.
- Uma rota `rejeitada` libera NFs, rotas de entrega e veículo.
- Nunca apagar uma NF do banco ao removê-la de uma rota: desvincular a NF da rota e devolvê-la ao conjunto disponível.

Essas regras precisam ser impostas no banco e validadas na interface. Esconder opções no front não é proteção suficiente contra duas sessões concorrentes.

## Escopo funcional

### 1. Grade de notas fiscais personalizável

Substituir a configuração atual, que só permite redimensionar colunas, por preferências por usuário:

- mostrar, ocultar, reordenar e redimensionar colunas;
- restaurar o conjunto padrão;
- persistir preferência por usuário, não apenas no navegador sem identidade;
- perfis rápidos: `Operação`, `Endereço`, `Financeiro` e `Completo`.

Colunas disponíveis devem incluir, quando existentes no SIAT:

- seleção, NF, status de reserva, rota de entrega, reentrega;
- emissão, agendamento e hora;
- remetente, destinatário, CNPJ/CPF;
- endereço, número, bairro, município, UF e CEP;
- tipo de cliente, tipo de carga, grade e região;
- peso, volume m³, caixas e valor;
- SAC, solução SAC, restrições e observação;
- veículo, placa, sigla e tipo quando a NF estiver vinculada.

Observação deve exibir um botão/ícone destacado que abre um balão com o conteúdo integral. Não depender apenas de texto truncado ou do atributo `title`.

### 2. Segmentação

- Manter seleção múltipla e filtros em cascata.
- Não mover uma opção selecionada para o topo: preservar ordem fixa (natural/alfa-numérica) em todos os segmentadores.
- Não mostrar no universo segmentável NFs, rotas de entrega ou veículos já reservados por rota ativa.
- Manter uma área “Em uso” separada, consultável, para auditoria — ela não pode contaminar a segmentação de novas rotas.
- Compactar os blocos Remetente e Destinatário com busca e lista rolável.
- Permitir ajuste de dimensão dos cards, sem tentar reproduzir literalmente a planilha Excel; preservar responsividade do app.
- No bloco Placa, não mostrar nome de rota. Mostrar `Placa | Sigla | Tipo` e somente veículos livres.
- Ao abrir uma placa de uma rota existente, navegar/abrir o detalhe da rota; não reutilizá-la na segmentação.

### 3. Criação, edição e substituição de rotas

O CTA que conclui a montagem deve ser **Salvar rota**. “Aprovar” é uma etapa posterior de validação, se aplicável.

Ao salvar:

- criar a rota em `aguardando`;
- reservar NFs, rotas de entrega e veículo em uma transação;
- recalcular peso, volume, caixas e identificadores a partir das NFs persistidas;
- validar que veículo/motorista/sigla, peso, NFs concatenadas e rota estejam preenchidos por dados reais.

Edição deve permitir:

- remover NF por desvinculação;
- mover NF para outra rota ativa apenas se isso não criar duplicidade;
- substituir veículo;
- consolidar duas rotas menores em uma rota maior (ex.: dois Fiorinos para um 3/4);
- substituir uma rota por outra somente após uma tela de confirmação que apresente NFs, rotas de entrega, veículo anterior, veículo novo, peso e volume afetados.

Ao rejeitar, liberar recursos automaticamente. Ao aprovar/enviar, manter a reserva e retirar a rota da área de montagem.

### 4. Sugestão e disponibilidade de veículos

- Sugerir tipo de veículo por peso, limite configurado, percentual máximo de ocupação e volume m³ quando disponível.
- Informar capacidade, peso atribuído, ocupação %, volume utilizado/disponível e motivo da sugestão.
- Agrupar a lista de veículos livres por tipo: Fiorino, VUC, 3/4, Truck e Carreta.
- Exibir `Placa | Sigla do motorista | Tipo` em todos os seletores, cards, pop-ups, detalhes, exportações e telas de aprovação.
- Considerar disponibilidade do dia, status do veículo, vínculo com motorista, restrições/configurações já cadastradas e ausência de rota ativa.
- Incluir preferências configuráveis por veículo: regiões, rotas de entrega, viagens/intermunicipal e tipos de carga.

### 5. Endereço e instruções do agente

Atualizar a instrução do agente para:

- considerar segmentação por tipo de veículo;
- em Cozinha Industrial, priorizar endereço alternativo de entrega e rota do SIAT, não o endereço do remetente;
- usar CEP como referência, não como única fonte geográfica;
- normalizar CEP para oito dígitos, preservando/completando zeros à esquerda;
- usar rua + número + bairro + município + UF + CEP para geocodificação;
- impedir que um bairro seja interpretado como UF. Exemplo validado: `Rua Dois, 51 · Pernambuco · Bocaiúva/MG · 33390-000`.

### 6. Cores e prioridade visual

Implementar legenda visível e contraste equivalente à planilha de referência:

| Cor | Significado | Bloqueia? |
|---|---|---|
| Vermelho | agendamento vencido/hoje, restrição crítica ou divergência de endereço | Não |
| Laranja/amarelo | SAC, reentrega, observação operacional ou agenda futura | Não |
| Verde | grupo de mesmo destinatário/endereço ou NF já analisada sem impedimento | Não |
| Azul | NF selecionada na rota em montagem | Não |
| Cinza | recurso reservado/em uso, somente na visão de auditoria | Não |

### 7. Página limpa e mapa

- A área principal de `Rotas do dia` deve mostrar somente NFs e veículos livres para nova montagem.
- Rotas aguardando/aprovadas/enviadas devem ficar em painel, página ou gaveta própria de revisão/aprovação/histórico.
- O quadro do mapa deve mostrar apenas cabeçalho com peso, rota e quantidade de NFs selecionadas.
- Remover do cabeçalho do mapa os contadores de Entregas, CD, Cozinha, Reentregas, Redes, Varejo e Restrições, usando o espaço liberado para ampliar o mapa.

### 8. Importação de disponibilidade

Aceitar CSV/XLSX com, no mínimo:

- `Placa`
- `Disponível Hoje`

Conversões aceitas:

- disponível: `Sim`, `S`, `1`, `Disponível`;
- indisponível: `Não`, `N`, `0`, `Indisponível`.

O arquivo atualiza somente placas presentes: cria/altera o registro de disponibilidade daquela placa e reflete a mudança no banco e no front. Placas ausentes não são resetadas.

Não conectar a implementação a um importador de cadastro de motorista/veículo sem antes definir colunas, chave de identificação e precedência entre planilha e SIAT.

### 9. Exportação

- Exportar exclusivamente rotas `aprovada` (confirmar se `enviada` também deve ser incluída como subconjunto de aprovadas).
- Uma linha por rota.
- NFs concatenadas, sem repetição.
- Incluir código da rota, identificadores relevantes, peso, volume, quantidade de NFs, veículo, placa, sigla, tipo e motorista.
- Excluir rejeitadas e impedir veículo/NF duplicados no arquivo. Se houver inconsistência de dados, bloquear exportação com mensagem operacional clara.

## Problemas conhecidos a corrigir

1. O segmentador atual ordena opções selecionadas antes das demais; isso viola a ordem fixa solicitada.
2. As opções de filtro são formadas a partir da base de NFs importadas e não excluem de forma confiável recursos reservados.
3. A reserva atual de NF é principalmente local/visual; não há garantia transacional abrangente para NF, rota de entrega e veículo.
4. Remover NF de rota atualmente exclui o registro de `notas_fiscais`; deve desvincular.
5. O seletor de veículo da edição considera veículos disponíveis, mas não exclui veículos com rota ativa.
6. A exportação usa as rotas do filtro atual, podendo incluir estados que não são aprovados, e gera uma linha por NF.
7. A importação de disponibilidade lê somente a placa e reseta a disponibilidade global antes de marcar as placas do arquivo.
8. A sigla do motorista existe no banco, mas não percorre todos os pontos do fluxo de rotas.
9. Parte dos campos já retornados pela consulta SQL do SIAT não é normalizada para a tabela de NFs.

## Ordem de implementação

1. Ler `AGENTS.md`, `CLAUDE.md`, a documentação instalada da versão de Next.js em `node_modules/next/dist/docs/` e as skills de Supabase antes de editar código.
2. Mapear esquema real e migrations do Supabase; confirmar colunas, índices, RLS e o estado de produção antes de qualquer escrita.
3. Projetar e aplicar, com migration revisada, as garantias de unicidade/reserva por data operacional.
4. Corrigir fluxos de salvar, editar, rejeitar e substituição com transações/RPC server-side.
5. Ajustar importação de disponibilidade para atualização parcial por placa.
6. Propagar dados SIAT e sigla pelo domínio, UI, aprovação e exportação.
7. Implementar grade configurável, segmentadores estáveis, mapa limpo e regras visuais.
8. Atualizar prompt do agente e normalização/validação de endereço.
9. Criar testes unitários e de integração para todas as invariantes, incluindo concorrência e troca de rotas.
10. Validar no front com dados controlados e, antes de publicar, conferir diff, migrations e regressões de importação.

## Critérios de aceite mínimos

- Duas tentativas concorrentes não conseguem reservar a mesma NF, rota de entrega ou veículo na mesma data.
- Salvar uma rota `aguardando` remove seus recursos de todos os segmentadores de nova montagem.
- Rejeitar a rota devolve todos os recursos à segmentação.
- Editar/consolidar rota libera e reserva recursos corretamente, somente após confirmação explícita.
- Nenhuma operação de edição apaga uma NF para “removê-la” da rota.
- A lista de placas livres mostra sigla e tipo e não oferece veículo com rota ativa.
- A importação parcial interpreta corretamente `Disponível Hoje = NÃO` sem resetar placas ausentes.
- A exportação tem uma linha por rota aprovada, contém NFs concatenadas e não contém duplicidade ou rejeitadas.
- A tabela permite ocultar, ordenar, reordenar e redimensionar colunas; Bairro e observação integral estão disponíveis.
- O exemplo de Bocaiúva/MG não é geocodificado como Pernambuco/UF.

## Comando inicial para Claude Code

```text
Leia primeiro AGENTS.md, CLAUDE.md, a documentação da versão instalada do Next.js em node_modules/next/dist/docs/ e as instruções da skill Supabase. Em seguida, leia integralmente docs/especificacao-rotas-do-dia.md.

Implemente a especificação por etapas, começando por uma auditoria somente leitura do esquema real do Supabase, migrations existentes, RLS, fluxos de salvar/editar/rejeitar rota e consultas SIAT. Antes de qualquer escrita no Supabase, apresente o plano de migration, as constraints/índices/RPCs propostos e peça confirmação. Preserve alterações concorrentes do worktree e não use mocks para SIAT, Supabase ou planilhas.

Regras invioláveis: uma rota aguardando já reserva definitivamente NF, rota de entrega e veículo no dia; rejeitada libera tudo; nunca apagar NF ao removê-la da rota; toda substituição/consolidação precisa de confirmação do usuário; todos os dados de veículo devem mostrar Placa | Sigla do motorista | Tipo; disponibilidade importada atualiza apenas placas presentes; exportar uma linha por rota aprovada, com NFs concatenadas e sem duplicidade.

Depois da confirmação do plano de banco, implemente e teste cada etapa, verificando a interface real antes de declarar concluído.
```
