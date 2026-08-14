-- Pedido do Marcelo (11/08/26, item 1): cadastro de motorista deve nascer
-- ativo por padrão quando tipo motorista = "03/TAC".
--
-- Esta coluna guarda o código de tipo de motorista trazido pelo SIAT
-- (ex.: "03/TAC" — Transportador Autônomo de Carga), para uso em
-- syncFrotaDoSiat() (lib/sync-frota.ts).
--
-- BLOQUEIO CONHECIDO: a query atual em lib/siat-db.ts (queryVeiculosDisponiveis)
-- não traz o campo de tipo de motorista da tabela [TAB DE MOTORISTAS] do SIAT
-- — precisa confirmar com o time do SIAT qual coluna carrega esse código antes
-- de popular esta coluna e de fato acionar a lógica de "ativo por padrão".
-- Até lá, o comportamento de `ativo` para motoristas continua inalterado
-- (sempre true no sync).

alter table motoristas
  add column if not exists tipo_motorista text;

comment on column motoristas.tipo_motorista is
  'Código de tipo de motorista do SIAT (ex.: 03/TAC). Ainda não populado — '
  'aguardando confirmação do campo de origem em [TAB DE MOTORISTAS].';
