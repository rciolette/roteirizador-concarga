-- Regra (Raphael, 16/09): rota rascunho/aguardando pode ser removida do front sem deixar
-- nada no banco. Rejeitar/remover = apagar rota, NFs copiadas, histórico e reservas.
-- Só rotas aprovadas/enviadas ficam gravadas.

create or replace function public.rota_excluir(p_rota_id uuid, p_usuario text default null)
returns void language plpgsql security invoker set search_path = public as $$
declare v_status text; v_codigo text;
begin
  select status, codigo_rota into v_status, v_codigo from rotas where id = p_rota_id for update;
  if not found then return; end if;
  if v_status in ('aprovada', 'enviada') then
    raise exception 'Rota % está %: aprovadas/enviadas não podem ser excluídas', v_codigo, v_status;
  end if;
  delete from notas_fiscais   where rota_id = p_rota_id;
  delete from historico_rotas where rota_id = p_rota_id;
  delete from reservas_dia    where rota_id = p_rota_id;
  delete from rotas           where id = p_rota_id;
end $$;
revoke all on function public.rota_excluir(uuid, text) from anon;

create or replace function public.rota_mudar_status(p_rota_id uuid, p_status text, p_usuario text default null, p_obs text default null)
returns void language plpgsql security invoker set search_path = public as $$
declare v_de text;
begin
  select status into v_de from rotas where id = p_rota_id for update;
  if not found then raise exception 'Rota não encontrada'; end if;
  if p_status not in ('rascunho','aguardando','aprovada','enviada','rejeitada') then raise exception 'Status inválido: %', p_status; end if;
  if p_status = 'rejeitada' and v_de not in ('aprovada', 'enviada') then
    perform rota_excluir(p_rota_id, p_usuario);
    return;
  end if;
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

create or replace function public.rota_consolidar(p_rota_ids uuid[], p_veiculo_id uuid, p_codigo text, p_usuario text default null)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_data date; v_regiao text; v_id uuid; v_codigos text; rid uuid;
begin
  if p_rota_ids is null or array_length(p_rota_ids, 1) < 2 then raise exception 'Selecione ao menos duas rotas'; end if;
  select min(data), string_agg(codigo_rota, ' + ' order by codigo_rota), min(regiao)
    into v_data, v_codigos, v_regiao from rotas where id = any(p_rota_ids);
  if (select count(distinct data) from rotas where id = any(p_rota_ids)) <> 1 then raise exception 'As rotas precisam ser da mesma data'; end if;
  if exists (select 1 from rotas where id = any(p_rota_ids) and status not in ('rascunho','aguardando')) then raise exception 'Só rotas rascunho/aguardando podem ser consolidadas'; end if;
  delete from reservas_dia where rota_id = any(p_rota_ids);
  insert into rotas (data, codigo_rota, regiao, status, criado_por, observacoes)
    values (v_data, coalesce(nullif(btrim(p_codigo),''), v_codigos), v_regiao, 'aguardando', auth.uid(), 'Consolidação de ' || v_codigos)
    returning id into v_id;
  perform rota_aplicar_veiculo(v_id, p_veiculo_id);
  update notas_fiscais set rota_anterior_id = null, rota_id = v_id, placa = (select veiculo_placa from rotas where id = v_id)
    where rota_id = any(p_rota_ids);
  perform rota_recalcular(v_id);
  foreach rid in array p_rota_ids loop
    perform rota_excluir(rid, p_usuario);
  end loop;
  insert into historico_rotas (rota_id, status_de, status_para, usuario, observacao)
    values (v_id, null, 'aguardando', coalesce(p_usuario,'operador'), 'Consolidação de ' || v_codigos);
  return v_id;
end $$;

do $$
declare rid uuid;
begin
  for rid in select id from rotas where status = 'rejeitada' loop
    delete from notas_fiscais where rota_id = rid; delete from historico_rotas where rota_id = rid;
    delete from reservas_dia where rota_id = rid; delete from rotas where id = rid;
  end loop;
end $$;
