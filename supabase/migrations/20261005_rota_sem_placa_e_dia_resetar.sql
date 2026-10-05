-- Marcelo 02/10: "Só permite criar rota com placa? Tem que criar rota com placa a
-- definir." + "Como resetar o dia?"  (Raphael liberou em 04/10)
--
-- 1) rota_salvar aceita p_veiculo_id null → carga nasce com "placa a definir".
-- 2) rota_mudar_status recusa aprovar/enviar carga sem veículo.
-- 3) dia_resetar(data) apaga as cargas rascunho/aguardando do dia e devolve as NFs.

create or replace function public.rota_salvar(p_data date, p_codigo text, p_regiao text, p_veiculo_id uuid, p_nfs jsonb, p_usuario text default null::text)
 returns uuid
 language plpgsql
 set search_path to 'public'
as $function$
declare
  v_id uuid;
begin
  if p_nfs is null or jsonb_typeof(p_nfs) <> 'array' or jsonb_array_length(p_nfs) = 0 then
    raise exception 'Selecione ao menos uma NF';
  end if;
  -- Veículo deixou de ser obrigatório: a carga pode nascer com "placa a definir"
  -- e só recebe o veículo depois. Aprovar/enviar continua exigindo placa.
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
    values (v_id, null, 'aguardando', coalesce(p_usuario, 'operador'),
            'Rota salva com ' || jsonb_array_length(p_nfs) || ' NFs'
            || case when p_veiculo_id is null then ' (placa a definir)' else '' end);
  return v_id;
end $function$;

create or replace function public.rota_mudar_status(p_rota_id uuid, p_status text, p_usuario text default null::text, p_obs text default null::text)
 returns void
 language plpgsql
 set search_path to 'public'
as $function$
declare v_de text; v_veic uuid; v_cod text;
begin
  select status, veiculo_id, codigo_rota into v_de, v_veic, v_cod from rotas where id = p_rota_id for update;
  if not found then raise exception 'Rota não encontrada'; end if;
  if p_status not in ('rascunho','aguardando','aprovada','enviada','rejeitada') then raise exception 'Status inválido: %', p_status; end if;
  if p_status = 'rejeitada' and v_de not in ('aprovada', 'enviada') then
    perform rota_excluir(p_rota_id, p_usuario);
    return;
  end if;
  -- Carga com "placa a definir" não pode ser aprovada nem enviada.
  if p_status in ('aprovada','enviada') and v_veic is null then
    raise exception 'Carga % está sem veículo: defina a placa antes de aprovar', v_cod;
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
end $function$;

-- Resetar o dia: apaga as cargas que ainda não foram aprovadas e devolve as NFs,
-- as rotas de entrega e os veículos para a roteirização. Aprovadas/enviadas são
-- preservadas de propósito — para apagá-las, reabra a carga antes.
create or replace function public.dia_resetar(p_data date, p_usuario text default null::text)
 returns integer
 language plpgsql
 set search_path to 'public'
as $function$
declare v_id uuid; v_n integer := 0;
begin
  for v_id in select id from rotas where data = p_data and status in ('rascunho','aguardando') loop
    perform rota_excluir(v_id, p_usuario);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $function$;

grant execute on function public.dia_resetar(date, text) to authenticated;
