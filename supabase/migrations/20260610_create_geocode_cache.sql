-- Cache persistente de geocodificação para evitar chamadas repetidas à Google Geocoding API.
-- Chave = endereço normalizado (municipio + bairro + cep), valor = lat/lng.
CREATE TABLE IF NOT EXISTS public.geocode_cache (
  chave      text        PRIMARY KEY,
  lat        float8      NOT NULL,
  lng        float8      NOT NULL,
  criado_em  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.geocode_cache ENABLE ROW LEVEL SECURITY;

-- Coordenadas são dados públicos — leitura aberta
CREATE POLICY "geocode_cache_select"
  ON public.geocode_cache FOR SELECT
  USING (true);

-- Inserção e atualização via service_role (API route usa getAdminClient)
CREATE POLICY "geocode_cache_insert"
  ON public.geocode_cache FOR INSERT
  WITH CHECK (true);

CREATE POLICY "geocode_cache_update"
  ON public.geocode_cache FOR UPDATE
  USING (true);
