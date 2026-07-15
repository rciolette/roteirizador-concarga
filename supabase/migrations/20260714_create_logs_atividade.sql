-- Log de atividade: acessos (login/logout) e ações sensíveis (usuários, convites,
-- empresa, configurações/webhooks). Leitura restrita ao perfil owner.
create table public.logs_atividade (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete set null,
  user_email   text,
  user_perfil  perfil_tipo,
  evento       text not null,
  area         text,
  entidade_id  text,
  descricao    text,
  dados        jsonb,
  ip           text,
  user_agent   text,
  criado_em    timestamptz not null default now()
);

create index logs_atividade_criado_em_idx on public.logs_atividade (criado_em desc);
create index logs_atividade_user_id_idx   on public.logs_atividade (user_id);
create index logs_atividade_area_idx      on public.logs_atividade (area);

alter table public.logs_atividade enable row level security;

create policy "logs: owner le" on public.logs_atividade
  for select to authenticated
  using (public.meu_perfil() = 'owner'::perfil_tipo);
