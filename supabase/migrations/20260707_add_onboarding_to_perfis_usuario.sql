-- Marca quando o usuário concluiu (ou pulou) o tutorial de primeiro acesso.
-- NULL = ainda não viu o onboarding.
ALTER TABLE perfis_usuario ADD COLUMN IF NOT EXISTS onboarding_visto_em timestamptz;
