-- Item 3 do feedback do Marcelo (11/08/26): colunas do grid "Motoristas
-- Vinculados" — ANTT, CPF, Fornecedor e TAG. Campos de origem confirmados no
-- SIAT em 14/08/26:
--   [TAB DE MOTORISTAS]: CPF, FORNECEDOR, CERT_ANTT, CERT_ANTT_VALIDADE
--   [TAB DE VEICULOS]:   NumeroTag, TAG_PEDAGIO
-- Vld.Seguro NÃO existe nas tabelas de veículo/motorista do SIAT — pendência
-- em aberto com o Marcelo (onde o seguro é controlado?).

alter table motoristas
  add column if not exists cpf text,
  add column if not exists fornecedor text,
  add column if not exists cert_antt text,
  add column if not exists cert_antt_validade date;

alter table veiculos
  add column if not exists numero_tag text,
  add column if not exists tag_pedagio boolean;
