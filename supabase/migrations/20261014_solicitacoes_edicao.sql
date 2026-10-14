-- Solicitações de edição (Raphael, 14/10): canal privado entre o Raphael e o
-- Marcelo para registrar, tela por tela, o que precisa mudar e COMO deve ficar.
-- A leitura e a escrita ficam restritas aos dois e-mails; o botão no app faz a
-- mesma checagem do lado do cliente (lib/solicitacoes.ts).

create table if not exists public.solicitacoes_edicao (
  id            uuid primary key default gen_random_uuid(),
  pagina        text not null,
  titulo        text not null,
  como_quer     text,
  prioridade    text not null default 'media',   -- alta | media | baixa
  status        text not null default 'aberta',  -- aberta | em_analise | feita
  autor_email   text,
  autor_nome    text,
  resposta      text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_solicitacoes_status
  on public.solicitacoes_edicao(status, criado_em desc);

alter table public.solicitacoes_edicao enable row level security;

create or replace function public.pode_ver_solicitacoes()
returns boolean language sql stable security definer set search_path to 'public' as $fn$
  select coalesce(lower(auth.jwt() ->> 'email'), '')
         in ('rciolette@gmail.com', 'marcelo@concarga.com.br')
$fn$;

-- Uma política única para todas as operações: quem não está na lista não vê
-- nem grava nada (a tabela se comporta como vazia para os demais usuários).
create policy solicitacoes_somente_raphael_e_marcelo
  on public.solicitacoes_edicao
  for all to authenticated
  using (public.pode_ver_solicitacoes())
  with check (public.pode_ver_solicitacoes());
