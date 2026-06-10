-- Função de normalização baseada em translate() — sem dependência de extensão,
-- sempre disponível, inherentemente IMMUTABLE.
-- Cobre todos os caracteres acentuados do português e espanhol usados em cidades.
CREATE OR REPLACE FUNCTION unaccent_immutable(text)
RETURNS text AS $$
  SELECT translate(
    $1,
    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
    'AAAAAaaaaaeEEEEeeeeIIIIiiiioOOOOoooooUUUUuuuuCcNn'
  );
$$ LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE;

-- Remove os 16 registros duplicados sem acento/inválidos,
-- mantendo sempre a versão com grafia acentuada correta.
DELETE FROM grade_cidades
WHERE id IN (
  '81823454-e985-4fd6-a986-c5fb867039b1', -- ABAETE        (manter ABAETÉ)
  'ce109220-3063-44a6-af21-2b2a8d844da5', -- BARAO DE COCAIS (manter BARÃO DE COCAIS)
  '5837c306-d749-451f-b19d-286e4138375a', -- BRASILIA DE MINAS (manter BRASÍLIA DE MINAS)
  '6b1632b7-a6da-408c-85e2-93eb0a54aa26', -- CAETANOPOLIS   (manter CAETANÓPOLIS)
  '2201a567-10f6-4253-ab2e-a08aa7dcc376', -- CAETE          (manter CAETÉ)
  '7af6ade2-8e6f-4e72-b3e5-df87af6a2afd', -- CONCEICAO DO MATO DE (entrada truncada)
  'ddeb0a3c-7797-4e71-88a7-2d351b25522e', -- CONCEICAO DO MATO DENTRO (manter CONCEIÇÃO DO MATO DENTRO)
  'f5701f30-8796-412f-b043-e5cd00ea7e0d', -- IBIRITE        (manter IBIRITÉ)
  'c4e9cd6f-50fb-4bcf-a3ab-9172fadbbcac', -- ITAUNA         (manter ITAÚNA)
  'cf35a518-10e2-4f3a-ad8c-7be0818a20c6', -- JOAO MONLEVADE (manter JOÃO MONLEVADE)
  'b6310bbb-2116-4d08-997a-8af6bdd70512', -- JOAO PINHEIRO  (manter JOÃO PINHEIRO)
  '2148e943-45a9-4abf-b0a0-a1c0973ffb96', -- MURIAE         (manter MURIAÉ)
  '9198db33-f4ae-474b-b6c1-099cb5f61bb7', -- POMPEU         (manter POMPÉU)
  '070fd736-bcb9-4397-9a22-8326d0a385d0', -- RIBEIRAO DAS NEVES (manter RIBEIRÃO DAS NEVES)
  'befcf0c3-7550-4073-beeb-741569bcebc6', -- TEOFILO OTONI  (manter TEÓFILO OTONI)
  'b3fe96d0-7226-4844-afc9-bbfeb9f0b8e6'  -- POCOS DE CALDAS (manter POÇOS DE CALDAS)
);

-- Remove o índice único antigo (só upper, sem unaccent)
DROP INDEX IF EXISTS idx_grade_cidade;

-- Cria o novo índice único normalizado: sem acento, maiúsculas, sem espaços extras
CREATE UNIQUE INDEX idx_grade_cidade_norm
  ON grade_cidades (upper(trim(unaccent_immutable(cidade))));

-- Verifica que não restaram duplicatas
DO $$
DECLARE dup_count integer;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT upper(trim(unaccent_immutable(cidade))) AS norm
    FROM grade_cidades
    GROUP BY norm
    HAVING COUNT(*) > 1
  ) t;
  IF dup_count > 0 THEN
    RAISE EXCEPTION 'Ainda existem % grupo(s) de duplicatas após a migration.', dup_count;
  END IF;
END $$;
