-- Migration: add_nf_operational_columns
-- Data: 2026-05-23
-- Adiciona colunas operacionais à tabela notas_fiscais conforme mapeamento da planilha ROTAS_13_02

ALTER TABLE notas_fiscais ADD COLUMN IF NOT EXISTS cond TEXT;
ALTER TABLE notas_fiscais ADD COLUMN IF NOT EXISTS grade TEXT;
ALTER TABLE notas_fiscais ADD COLUMN IF NOT EXISTS tipo_cliente TEXT;
ALTER TABLE notas_fiscais ADD COLUMN IF NOT EXISTS bairro_dest TEXT;
ALTER TABLE notas_fiscais ADD COLUMN IF NOT EXISTS municipio_dest TEXT;
ALTER TABLE notas_fiscais ADD COLUMN IF NOT EXISTS cep_dest TEXT;
ALTER TABLE notas_fiscais ADD COLUMN IF NOT EXISTS endereco_dest TEXT;
ALTER TABLE notas_fiscais ADD COLUMN IF NOT EXISTS peso_bruto NUMERIC;
ALTER TABLE notas_fiscais ADD COLUMN IF NOT EXISTS reentrega BOOLEAN DEFAULT false;
ALTER TABLE notas_fiscais ADD COLUMN IF NOT EXISTS ind_reentrega INTEGER DEFAULT 0;
ALTER TABLE notas_fiscais ADD COLUMN IF NOT EXISTS sac INTEGER DEFAULT 0;
ALTER TABLE notas_fiscais ADD COLUMN IF NOT EXISTS solucao_sac TEXT;
ALTER TABLE notas_fiscais ADD COLUMN IF NOT EXISTS restricoes TEXT;
ALTER TABLE notas_fiscais ADD COLUMN IF NOT EXISTS restricao_desc TEXT;
ALTER TABLE notas_fiscais ADD COLUMN IF NOT EXISTS dt_agend DATE;
ALTER TABLE notas_fiscais ADD COLUMN IF NOT EXISTS data_emissao DATE;
ALTER TABLE notas_fiscais ADD COLUMN IF NOT EXISTS remetente TEXT;
ALTER TABLE notas_fiscais ADD COLUMN IF NOT EXISTS cnpj_destinatario TEXT;
ALTER TABLE notas_fiscais ADD COLUMN IF NOT EXISTS observacao TEXT;
ALTER TABLE notas_fiscais ADD COLUMN IF NOT EXISTS placa TEXT;
ALTER TABLE notas_fiscais ADD COLUMN IF NOT EXISTS regiao TEXT;
ALTER TABLE notas_fiscais ADD COLUMN IF NOT EXISTS tp_carga TEXT;
ALTER TABLE notas_fiscais ADD COLUMN IF NOT EXISTS cliente_rede_cnpj TEXT;
ALTER TABLE notas_fiscais ADD COLUMN IF NOT EXISTS cd_cnpj TEXT;
ALTER TABLE notas_fiscais ADD COLUMN IF NOT EXISTS valor_nf NUMERIC;
ALTER TABLE notas_fiscais ADD COLUMN IF NOT EXISTS quantidade INTEGER;
