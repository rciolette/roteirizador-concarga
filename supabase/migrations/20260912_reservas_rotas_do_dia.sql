-- ============================================================================
-- Rotas do Dia — reservas por data operacional, RPCs transacionais,
-- preferências por usuário e importação parcial de disponibilidade.
-- Espec: docs/especificacao-rotas-do-dia.md
-- ============================================================================

-- ── 1. Colunas novas ────────────────────────────────────────────────────────
alter table public.notas_fiscais
  add column if not exists rota_entrega     text,
  add column if not exists volume_m3        numeric,
  add column if not exists desvinculada_em  timestamptz,
  add column if not exists rota_anterior_id uuid references public.rotas(id) on delete set null;

comment on column public.notas_fiscais.rota_entrega is 'Rota de entrega do SIAT (TAB NFS.ROTA). Reserva o dia enquanto a rota de veículo estiver ativa.';
comment on column public.notas_fiscais.desvinculada_em is 'Preenchido quando a NF foi retirada da rota (nunca é apagada).';

alter table public.rotas
  add column if not exists volume_total    numeric default 0,
  add column if not exists caixas_total    integer default 0,
  add column if not exists motorista_sigla text,
  add column if not exists veiculo_tipo    text,
  add column if not exists criado_por      uuid;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'rotas_status_check') then
    alter table public.rotas add constraint rotas_status_check
      check (status in ('rascunho','aguardando','aprovada','enviada','rejeitada'));
  end if;
end $$;

create index if not exists idx_nfs_rota_numero    on public.notas_fiscais (rota_id, n_nfs);
create index if not exists idx_rotas_data_status  on public.rotas (data, status);
create index if not exists idx_rotas_data_veiculo on public.rotas (data, veiculo_id);

-- ── 2. Tabela de reservas do dia (garantia de unicidade) ─────────────────────
create table if not exists public.reservas_dia (
  data      date        not null,
  tipo      text        not null check (tipo in ('nf','rota_entrega','veiculo')),
  chave     text        not null,
  rota_id   uuid        not null references public.rotas(id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (data, tipo, chave)
);
create index if not exists idx_reservas_dia_rota on public.reservas_dia (rota_id);

alter table public.reservas_dia enable row level security;
drop policy if exists reservas_dia_select on public.reservas_dia;
create policy reservas_dia_select on public.reservas_dia
  for select to authenticated using (true);
-- Escrita só pelos triggers (SECURITY DEFINER) — nenhuma policy de insert/update/delete.

-- ── 3. Helpers ───────────────────────────────────────────────────────────────
create or replace function public.rota_status_ativo(p_status text)
returns boolean language sql immutable as $$
  select p_status in ('rascunho','aguardando','aprovada','enviada')
$$;

-- Espelha lib/siat.ts tipoVeiculoFromSiat
create or replace function public.tipo_veiculo_normalizado(p_tipo text)
returns text language sql immutable as $$
  select case
    when p_tipo is null then 'VUC'
    when lower(p_tipo) like '%fiorin%'  then 'Fiorino'
    when p_tipo like '%3/4%'            then '3/4'
    when lower(p_tipo) like '%truck%' or lower(p_tipo) like '%caminh%' then 'Truck'
    when lower(p_tipo) like '%carreta%' or lower(p_tipo) like '%bitrem%' then 'Carreta'
    else 'VUC' end
$$;

-- Rota de entrega que conta como recurso reservável (S/ROTA, vazio e '—' não contam)
create or replace function public.rota_entrega_reservavel(p text)
returns boolean language sql immutable as $$
  select p is not null and btrim(p) <> '' and btrim(p) <> '—'
     and upper(p) not like '%S/ROTA%' and upper(p) not like '%S/ ROTA%'
$$;

-- ── 4. Reservas: rebuild completo de uma rota ────────────────────────────────
create or replace function public.reservas_rebuild(p_rota_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_conf uuid;
  nf record;
begin
  delete from reservas_dia where rota_id = p_rota_id;

  select id, data, status, veiculo_id, codigo_rota into r from rotas where id = p_rota_id;
  if not found or not rota_status_ativo(r.status) then return; end if;

  -- veículo
  if r.veiculo_id is not null then
    select rota_id into v_conf from reservas_dia
      where data = r.data and tipo = 'veiculo' and chave = r.veiculo_id::text;
    if found and v_conf <> p_rota_id then
      raise exception 'Veículo já reservado em % pela rota %', r.data,
        (select codigo_rota from rotas where id = v_conf)
        using errcode = 'unique_violation';
    end if;
    insert into reservas_dia (data, tipo, chave, rota_id)
      values (r.data, 'veiculo', r.veiculo_id::text, p_rota_id)
      on conflict do nothing;
  end if;

  -- NFs e rotas de entrega
  for nf in select n_nfs, rota_entrega from notas_fiscais where rota_id = p_rota_id loop
    select rota_id into v_conf from reservas_dia
      where data = r.data and tipo = 'nf' and chave = nf.n_nfs::text;
    if found and v_conf <> p_rota_id then
      raise exception 'NF % já reservada em % pela rota %', nf.n_nfs, r.data,
        (select codigo_rota from rotas where id = v_conf)
        using errcode = 'unique_violation';
    end if;
    insert into reservas_dia (data, tipo, chave, rota_id)
      values (r.data, 'nf', nf.n_nfs::text, p_rota_id)
      on conflict do nothing;

    if rota_entrega_reservavel(nf.rota_entrega) then
      select rota_id into v_conf from reservas_dia
        where data = r.data and tipo = 'rota_entrega' and chave = upper(btrim(nf.rota_entrega));
      if found and v_conf <> p_rota_id then
        raise exception 'Rota de entrega % já reservada em % pela rota %', nf.rota_entrega, r.data,
          (select codigo_rota from rotas where id = v_conf)
          using errcode = 'unique_violation';
      end if;
      insert into reservas_dia (data, tipo, chave, rota_id)
        values (r.data, 'rota_entrega', upper(btrim(nf.rota_entrega)), p_rota_id)
        on conflict do nothing;
    end if;
  end loop;
end $$;

-- ── 5. Trigger em notas_fiscais ──────────────────────────────────────────────
create or replace function public.trg_nf_reserva()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_conf uuid;
  v_chave_re text;
begin
  -- Libera o que a NF antiga reservava
  if tg_op in ('UPDATE','DELETE') and old.rota_id is not null then
    select data, status into r from rotas where id = old.rota_id;
    if found then
      delete from reservas_dia where rota_id = old.rota_id and tipo = 'nf' and chave = old.n_nfs::text;
      if rota_entrega_reservavel(old.rota_entrega)
         and not exists (select 1 from notas_fiscais
                          where rota_id = old.rota_id and id <> old.id
                            and upper(btrim(rota_entrega)) = upper(btrim(old.rota_entrega))) then
        delete from reservas_dia where rota_id = old.rota_id and tipo = 'rota_entrega'
          and chave = upper(btrim(old.rota_entrega));
      end if;
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;

  -- Reserva para a NF nova/atualizada
  if new.rota_id is null then return new; end if;
  select data, status, codigo_rota into r from rotas where id = new.rota_id;
  if not found or not rota_status_ativo(r.status) then return new; end if;

  select rota_id into v_conf from reservas_dia
    where data = r.data and tipo = 'nf' and chave = new.n_nfs::text;
  if found and v_conf <> new.rota_id then
    raise exception 'NF % já está na rota % de %', new.n_nfs,
      (select codigo_rota from rotas where id = v_conf), to_char(r.data, 'DD/MM')
      using errcode = 'unique_violation';
  end if;
  if not found then
    insert into reservas_dia (data, tipo, chave, rota_id) values (r.data, 'nf', new.n_nfs::text, new.rota_id);
  end if;

  if rota_entrega_reservavel(new.rota_entrega) then
    v_chave_re := upper(btrim(new.rota_entrega));
    select rota_id into v_conf from reservas_dia
      where data = r.data and tipo = 'rota_entrega' and chave = v_chave_re;
    if found and v_conf <> new.rota_id then
      raise exception 'Rota de entrega % já está na rota % de %', new.rota_entrega,
        (select codigo_rota from rotas where id = v_conf), to_char(r.data, 'DD/MM')
        using errcode = 'unique_violation';
    end if;
    if not found then
      insert into reservas_dia (data, tipo, chave, rota_id) values (r.data, 'rota_entrega', v_chave_re, new.rota_id);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists nf_reserva on public.notas_fiscais;
create trigger nf_reserva
  after insert or update of rota_id, rota_entrega, n_nfs or delete on public.notas_fiscais
  for each row execute function public.trg_nf_reserva();

-- ── 6. Trigger em rotas ──────────────────────────────────────────────────────
create or replace function public.trg_rota_reserva()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_conf uuid;
begin
  if tg_op = 'DELETE' then
    delete from reservas_dia where rota_id = old.id;
    return old;
  end if;

  -- ficou inativa → libera tudo
  if not rota_status_ativo(new.status) then
    delete from reservas_dia where rota_id = new.id;
    return new;
  end if;

  -- voltou a ficar ativa ou mudou de data → reconstrói
  if tg_op = 'UPDATE' and (not rota_status_ativo(old.status) or old.data is distinct from new.data) then
    perform reservas_rebuild(new.id);
    return new;
  end if;

  -- troca de veículo
  if tg_op = 'INSERT' or old.veiculo_id is distinct from new.veiculo_id then
    delete from reservas_dia where rota_id = new.id and tipo = 'veiculo';
    if new.veiculo_id is not null then
      select rota_id into v_conf from reservas_dia
        where data = new.data and tipo = 'veiculo' and chave = new.veiculo_id::text;
      if found and v_conf <> new.id then
        raise exception 'Veículo % já está na rota % de %',
          (select placa from veiculos where id = new.veiculo_id),
          (select codigo_rota from rotas where id = v_conf), to_char(new.data, 'DD/MM')
          using errcode = 'unique_violation';
      end if;
      insert into reservas_dia (data, tipo, chave, rota_id)
        values (new.data, 'veiculo', new.veiculo_id::text, new.id)
        on conflict do nothing;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists rota_reserva on public.rotas;
create trigger rota_reserva
  after insert or update of status, veiculo_id, data or delete on public.rotas
  for each row execute function public.trg_rota_reserva();

-- ── 7. Recalcular totais ─────────────────────────────────────────────────────
-- Espelha lib/siat.ts capKgFromSiat: capacidade < 100 no SIAT é lixo/tonelada → usa a tabela por tipo.
create or replace function public.veiculo_capacidade_efetiva(p_veiculo_id uuid)
returns numeric language sql stable security invoker set search_path = public as $$
  select case when v.capacidade_kg is not null and v.capacidade_kg >= 100 then v.capacidade_kg
              else coalesce(c.capacidade_kg,
                     case tipo_veiculo_normalizado(v.tipo_veiculo)
                       when 'Fiorino' then 700 when '3/4' then 2500 when 'Carreta' then 15000 when 'Truck' then 6000 else 1500 end)
         end
  from veiculos v
  left join veiculo_capacidades c on c.tipo = tipo_veiculo_normalizado(v.tipo_veiculo)
  where v.id = p_veiculo_id
$$;

create or replace function public.rota_recalcular(p_rota_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare v_cap numeric;
begin
  select veiculo_capacidade_efetiva(veiculo_id) into v_cap from rotas where id = p_rota_id;
  update rotas r set
    peso_total    = coalesce(t.peso, 0),
    volume_total  = coalesce(t.vol, 0),
    caixas_total  = coalesce(t.cx, 0)::integer,
    qtd_notas     = coalesce(t.qtd, 0)::integer,
    ocupacao_percent = case when v_cap is not null and v_cap > 0
      then round(coalesce(t.peso,0) / v_cap * 100, 1) else r.ocupacao_percent end,
    atualizado_em = now()
  from (select rota_id, sum(peso_kg) peso, sum(volume_m3) vol, sum(quantidade) cx, count(*) qtd
          from notas_fiscais where rota_id = p_rota_id group by rota_id) t
  where r.id = p_rota_id and t.rota_id = r.id;

  update rotas set peso_total = 0, volume_total = 0, caixas_total = 0, qtd_notas = 0, ocupacao_percent = 0, atualizado_em = now()
   where id = p_rota_id and not exists (select 1 from notas_fiscais where rota_id = p_rota_id);
end $$;

-- ── 8. Dados do veículo para a rota (placa, tipo, motorista, sigla) ──────────
create or replace function public.rota_aplicar_veiculo(p_rota_id uuid, p_veiculo_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare v record;
begin
  if p_veiculo_id is null then
    update rotas set veiculo_id = null, veiculo_placa = null, veiculo_tipo = null,
      motorista_id = null, motorista_nome = null, motorista_celular = null, motorista_sigla = null,
      atualizado_em = now() where id = p_rota_id;
    return;
  end if;
  select ve.id, ve.placa, ve.tipo_veiculo, ve.motorista_id, m.nome, m.celular, m.sigla
    into v from veiculos ve left join motoristas m on m.id = ve.motorista_id where ve.id = p_veiculo_id;
  if not found then raise exception 'Veículo não encontrado'; end if;
  if v.motorista_id is null then raise exception 'Veículo % sem motorista vinculado', v.placa; end if;
  update rotas set
    veiculo_id = v.id, veiculo_placa = v.placa, veiculo_tipo = tipo_veiculo_normalizado(v.tipo_veiculo),
    motorista_id = v.motorista_id, motorista_nome = v.nome, motorista_celular = v.celular,
    motorista_sigla = nullif(btrim(v.sigla), ''),
    atualizado_em = now()
  where id = p_rota_id;
end $$;

-- ── 9. RPC: salvar rota (aguardando) com NFs + veículo em uma transação ──────
create or replace function public.rota_salvar(
  p_data date, p_codigo text, p_regiao text, p_veiculo_id uuid, p_nfs jsonb, p_usuario text default null
) returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid;
begin
  if p_nfs is null or jsonb_typeof(p_nfs) <> 'array' or jsonb_array_length(p_nfs) = 0 then
    raise exception 'Selecione ao menos uma NF';
  end if;
  if p_veiculo_id is null then raise exception 'Selecione o veículo (Placa | Sigla | Tipo) antes de salvar'; end if;
  if p_codigo is null or btrim(p_codigo) = '' then raise exception 'Código da rota obrigatório'; end if;

  insert into rotas (data, codigo_rota, regiao, status, criado_por)
    values (p_data, p_codigo, nullif(p_regiao,''), 'aguardando', auth.uid())
    returning id into v_id;

  perform rota_aplicar_veiculo(v_id, p_veiculo_id);

  insert into notas_fiscais (
    rota_id, n_nfs, destinatario, municipio, municipio_dest, bairro, bairro_dest, endereco, endereco_dest,
    numero, uf, cep, cep_dest, peso_kg, peso_bruto, volume_m3, quantidade, valor_nf, tipo_cliente, cond, grade, tp_carga,
    regiao, rota_entrega, agendamento, dt_agend, hora_agendamento, reentrega, ind_reentrega, sac, solucao_sac,
    observacao, restricoes, restricao_desc, remetente, cnpj_destinatario, data_emissao, placa, sequencia)
  select
    v_id,
    (n->>'numnfs')::bigint,
    n->>'destinatario', n->>'municipio', n->>'municipio', n->>'bairro', n->>'bairro', n->>'endereco', n->>'endereco',
    nullif(n->>'numero',''), nullif(n->>'uf',''), nullif(n->>'cep',''), nullif(n->>'cep',''),
    coalesce((n->>'peso')::numeric, 0), coalesce((n->>'peso')::numeric, 0),
    nullif(n->>'volume','')::numeric, nullif(n->>'qtd','')::integer, nullif(n->>'valor','')::numeric,
    n->>'tipoCliente', coalesce(n->>'cond','ok'), nullif(n->>'grade',''), nullif(n->>'grade',''),
    nullif(n->>'regiao',''), nullif(n->>'rota',''),
    case when n->>'dataAgendamento' ~ '^\d{4}-\d{2}-\d{2}' then left(n->>'dataAgendamento',10)::date end,
    case when n->>'dataAgendamento' ~ '^\d{4}-\d{2}-\d{2}' then left(n->>'dataAgendamento',10)::date end,
    case when n->>'horaAgendamento' ~ '^\d{2}:\d{2}' then left(n->>'horaAgendamento',8)::time end,
    coalesce((n->>'indRee')::boolean, false), coalesce((n->>'indiceReentrega')::integer, 0),
    nullif(n->>'sac',''), nullif(n->>'solucaoSac',''),
    nullif(n->>'observacao',''), nullif(n->>'restricoes',''), nullif(n->>'restricaoDesc',''),
    nullif(n->>'remetente',''), nullif(n->>'cnpjDestinatario',''),
    case when n->>'dataEmissao' ~ '^\d{4}-\d{2}-\d{2}' then left(n->>'dataEmissao',10)::date end,
    (select veiculo_placa from rotas where id = v_id),
    (ord)::integer
  from jsonb_array_elements(p_nfs) with ordinality as t(n, ord);

  perform rota_recalcular(v_id);
  insert into historico_rotas (rota_id, status_de, status_para, usuario, observacao)
    values (v_id, null, 'aguardando', coalesce(p_usuario, 'operador'), 'Rota salva com ' || jsonb_array_length(p_nfs) || ' NFs');
  return v_id;
end $$;

-- ── 10. RPC: mudar status (aprovar / enviar / rejeitar) ──────────────────────
create or replace function public.rota_mudar_status(p_rota_id uuid, p_status text, p_usuario text default null, p_obs text default null)
returns void language plpgsql security invoker set search_path = public as $$
declare v_de text;
begin
  select status into v_de from rotas where id = p_rota_id for update;
  if not found then raise exception 'Rota não encontrada'; end if;
  if p_status not in ('rascunho','aguardando','aprovada','enviada','rejeitada') then raise exception 'Status inválido: %', p_status; end if;
  update rotas set
    status = p_status,
    aprovado_em = case when p_status = 'aprovada' then now() else aprovado_em end,
    aprovado_por = case when p_status = 'aprovada' then coalesce(p_usuario, aprovado_por) else aprovado_por end,
    enviado_em  = case when p_status = 'enviada'  then now() else enviado_em end,
    observacoes = coalesce(p_obs, observacoes),
    atualizado_em = now()
  where id = p_rota_id;
  insert into historico_rotas (rota_id, status_de, status_para, usuario, observacao)
    values (p_rota_id, v_de, p_status, coalesce(p_usuario, 'operador'), p_obs);
end $$;

-- ── 11. RPC: desvincular NFs (nunca apaga) ───────────────────────────────────
create or replace function public.rota_desvincular_nfs(p_rota_id uuid, p_nf_ids uuid[])
returns integer language plpgsql security invoker set search_path = public as $$
declare v_n integer;
begin
  update notas_fiscais set rota_anterior_id = rota_id, rota_id = null, desvinculada_em = now(), placa = null
    where rota_id = p_rota_id and id = any(p_nf_ids);
  get diagnostics v_n = row_count;
  perform rota_recalcular(p_rota_id);
  return v_n;
end $$;

-- ── 12. RPC: mover NFs entre rotas ativas ────────────────────────────────────
create or replace function public.rota_mover_nfs(p_origem uuid, p_destino uuid, p_nf_ids uuid[])
returns integer language plpgsql security invoker set search_path = public as $$
declare o record; d record; v_n integer; v_split text;
begin
  select data, status, codigo_rota into o from rotas where id = p_origem for update;
  select data, status, veiculo_placa, codigo_rota into d from rotas where id = p_destino for update;
  if o is null or d is null then raise exception 'Rota não encontrada'; end if;
  if not rota_status_ativo(d.status) then raise exception 'Rota de destino não está ativa'; end if;
  if o.data <> d.data then raise exception 'As rotas precisam ser da mesma data'; end if;

  -- Uma rota de entrega não pode ficar dividida entre duas rotas ativas:
  -- se alguma NF da mesma rota de entrega ficar para trás, bloqueia.
  select string_agg(distinct rota_entrega, ', ') into v_split
  from notas_fiscais fica
  where fica.rota_id = p_origem and not (fica.id = any(p_nf_ids))
    and rota_entrega_reservavel(fica.rota_entrega)
    and exists (select 1 from notas_fiscais vai
                 where vai.rota_id = p_origem and vai.id = any(p_nf_ids)
                   and upper(btrim(vai.rota_entrega)) = upper(btrim(fica.rota_entrega)));
  if v_split is not null then
    raise exception 'A rota de entrega % ficaria dividida entre % e %. Mova todas as NFs dessa rota de entrega juntas.',
      v_split, o.codigo_rota, d.codigo_rota using errcode = 'check_violation';
  end if;

  update notas_fiscais set rota_id = p_destino, rota_anterior_id = p_origem, placa = d.veiculo_placa
    where rota_id = p_origem and id = any(p_nf_ids);
  get diagnostics v_n = row_count;
  perform rota_recalcular(p_origem);
  perform rota_recalcular(p_destino);
  return v_n;
end $$;

-- ── 13. RPC: definir / substituir veículo ────────────────────────────────────
create or replace function public.rota_definir_veiculo(p_rota_id uuid, p_veiculo_id uuid, p_usuario text default null)
returns void language plpgsql security invoker set search_path = public as $$
declare v_antes text;
begin
  select veiculo_placa into v_antes from rotas where id = p_rota_id for update;
  if not found then raise exception 'Rota não encontrada'; end if;
  perform rota_aplicar_veiculo(p_rota_id, p_veiculo_id);
  update notas_fiscais set placa = (select veiculo_placa from rotas where id = p_rota_id) where rota_id = p_rota_id;
  perform rota_recalcular(p_rota_id);
  insert into historico_rotas (rota_id, status_de, status_para, usuario, observacao)
    select p_rota_id, status, status, coalesce(p_usuario,'operador'),
           'Veículo ' || coalesce(v_antes,'—') || ' → ' || coalesce(veiculo_placa,'—') from rotas where id = p_rota_id;
end $$;

-- ── 14. RPC: consolidar rotas em uma nova ────────────────────────────────────
create or replace function public.rota_consolidar(p_rota_ids uuid[], p_veiculo_id uuid, p_codigo text, p_usuario text default null)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_data date; v_regiao text; v_id uuid; v_codigos text; rid uuid;
begin
  if p_rota_ids is null or array_length(p_rota_ids, 1) < 2 then raise exception 'Selecione ao menos duas rotas'; end if;
  select min(data), string_agg(codigo_rota, ' + ' order by codigo_rota), min(regiao)
    into v_data, v_codigos, v_regiao from rotas where id = any(p_rota_ids);
  if (select count(distinct data) from rotas where id = any(p_rota_ids)) <> 1 then raise exception 'As rotas precisam ser da mesma data'; end if;
  if exists (select 1 from rotas where id = any(p_rota_ids) and not rota_status_ativo(status)) then raise exception 'Só rotas ativas podem ser consolidadas'; end if;

  foreach rid in array p_rota_ids loop
    perform rota_mudar_status(rid, 'rejeitada', p_usuario, 'Consolidada em ' || coalesce(p_codigo, v_codigos));
  end loop;

  insert into rotas (data, codigo_rota, regiao, status, criado_por, observacoes)
    values (v_data, coalesce(nullif(btrim(p_codigo),''), v_codigos), v_regiao, 'aguardando', auth.uid(), 'Consolidação de ' || v_codigos)
    returning id into v_id;
  perform rota_aplicar_veiculo(v_id, p_veiculo_id);

  update notas_fiscais set rota_anterior_id = rota_id, rota_id = v_id, placa = (select veiculo_placa from rotas where id = v_id)
    where rota_id = any(p_rota_ids);
  perform rota_recalcular(v_id);
  insert into historico_rotas (rota_id, status_de, status_para, usuario, observacao)
    values (v_id, null, 'aguardando', coalesce(p_usuario,'operador'), 'Consolidação de ' || v_codigos);
  return v_id;
end $$;

-- ── 15. RPC: importação parcial de disponibilidade ───────────────────────────
create or replace function public.disponibilidade_importar(p_data date, p_itens jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  it record; v_id uuid; v_ok integer := 0; v_nao text[] := '{}';
begin
  for it in select upper(btrim(x->>'placa')) as placa, (x->>'disponivel')::boolean as disp
              from jsonb_array_elements(p_itens) x loop
    if it.placa is null or it.placa = '' or it.disp is null then continue; end if;
    select id into v_id from veiculos where upper(placa) = it.placa;
    if not found then v_nao := array_append(v_nao, it.placa); continue; end if;
    insert into veiculo_disponibilidade (veiculo_id, data, disponivel, origem, confirmado_por, confirmado_em)
      values (v_id, p_data, it.disp, 'operador', auth.uid(), now())
      on conflict (veiculo_id, data) do update
        set disponivel = excluded.disponivel, origem = 'operador', confirmado_por = excluded.confirmado_por, confirmado_em = now();
    if p_data = current_date then
      update veiculos set disponivel_hoje = it.disp, updated_at = now() where id = v_id;
    end if;
    v_ok := v_ok + 1;
  end loop;
  return jsonb_build_object('atualizadas', v_ok, 'nao_encontradas', to_jsonb(v_nao));
end $$;

-- ── 16. Veículos livres do dia (Placa | Sigla | Tipo, sem rota ativa) ────────
create or replace function public.veiculos_livres(p_data date)
returns table (
  id uuid, placa text, sigla text, tipo text, tipo_siat text, modelo text,
  capacidade_kg numeric, volume_m3 numeric, motorista_id uuid, motorista_nome text, motorista_celular text,
  situacao_siat text, disponivel boolean
) language sql stable security invoker set search_path = public as $$
  select v.id, v.placa, coalesce(nullif(btrim(m.sigla),''), '—') as sigla,
         tipo_veiculo_normalizado(v.tipo_veiculo) as tipo, v.tipo_veiculo, v.modelo,
         veiculo_capacidade_efetiva(v.id), v.volume_m3, m.id, m.nome, m.celular, v.situacao_siat, true
  from veiculos v
  join motoristas m on m.id = v.motorista_id
  left join veiculo_disponibilidade d on d.veiculo_id = v.id and d.data = p_data
  where v.ativo = true
    and coalesce(d.disponivel, case when p_data = current_date then v.disponivel_hoje else false end) = true
    and upper(coalesce(v.situacao_siat,'')) not like '%MANUT%'
    and not exists (select 1 from reservas_dia r where r.data = p_data and r.tipo = 'veiculo' and r.chave = v.id::text)
  order by tipo_veiculo_normalizado(v.tipo_veiculo), v.placa
$$;

-- ── 17. Preferências por usuário (grade de colunas etc.) ─────────────────────
create table if not exists public.preferencias_usuario (
  user_id       uuid not null references auth.users(id) on delete cascade,
  chave         text not null,
  valor         jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now(),
  primary key (user_id, chave)
);
alter table public.preferencias_usuario enable row level security;
drop policy if exists pref_select on public.preferencias_usuario;
drop policy if exists pref_insert on public.preferencias_usuario;
drop policy if exists pref_update on public.preferencias_usuario;
drop policy if exists pref_delete on public.preferencias_usuario;
create policy pref_select on public.preferencias_usuario for select to authenticated using ((select auth.uid()) = user_id);
create policy pref_insert on public.preferencias_usuario for insert to authenticated with check ((select auth.uid()) = user_id);
create policy pref_update on public.preferencias_usuario for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy pref_delete on public.preferencias_usuario for delete to authenticated using ((select auth.uid()) = user_id);

-- ── 18. Preferências por veículo ─────────────────────────────────────────────
create table if not exists public.veiculo_preferencias (
  veiculo_id     uuid primary key references public.veiculos(id) on delete cascade,
  regioes        text[] not null default '{}',
  rotas_entrega  text[] not null default '{}',
  intermunicipal boolean not null default false,
  tipos_carga    text[] not null default '{}',
  observacao     text,
  atualizado_em  timestamptz not null default now()
);
alter table public.veiculo_preferencias enable row level security;
drop policy if exists veiculo_pref_all on public.veiculo_preferencias;
create policy veiculo_pref_all on public.veiculo_preferencias for all to authenticated using (true) with check (true);

-- ── 19. Grants ───────────────────────────────────────────────────────────────
revoke all on function public.reservas_rebuild(uuid) from public, anon;
revoke all on function public.rota_salvar(date,text,text,uuid,jsonb,text) from anon;
revoke all on function public.rota_mudar_status(uuid,text,text,text) from anon;
revoke all on function public.rota_desvincular_nfs(uuid,uuid[]) from anon;
revoke all on function public.rota_mover_nfs(uuid,uuid,uuid[]) from anon;
revoke all on function public.rota_definir_veiculo(uuid,uuid,text) from anon;
revoke all on function public.rota_consolidar(uuid[],uuid,text,text) from anon;
revoke all on function public.disponibilidade_importar(date,jsonb) from anon;
revoke all on function public.veiculos_livres(date) from anon;
grant select on public.reservas_dia to authenticated;
alter function public.rota_status_ativo(text) set search_path = public;
alter function public.tipo_veiculo_normalizado(text) set search_path = public;
alter function public.rota_entrega_reservavel(text) set search_path = public;
revoke all on function public.trg_nf_reserva() from public, anon, authenticated;
revoke all on function public.trg_rota_reserva() from public, anon, authenticated;
revoke all on function public.reservas_rebuild(uuid) from public, anon, authenticated;
revoke all on function public.veiculo_capacidade_efetiva(uuid) from anon;

-- ── 20. Backfill: reservas das rotas ativas de hoje em diante ────────────────
do $$
declare rid uuid;
begin
  for rid in select id from rotas where data >= current_date and rota_status_ativo(status) order by criado_em loop
    perform reservas_rebuild(rid);
  end loop;
end $$;
