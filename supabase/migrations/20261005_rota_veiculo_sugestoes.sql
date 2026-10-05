-- Sugestão de placa que aprende sozinha (Raphael, 05/10).
--
-- Além do cadastro manual em `veiculo_preferencias` (preenchido a partir da
-- planilha ROTAS_13.02 que o Marcelo enviou), o app passa a olhar as cargas que
-- já foram montadas: qual veículo costuma levar cada rota de entrega.
-- O cadastro manual sempre tem prioridade; o histórico complementa.

create or replace function public.rota_veiculo_sugestoes(p_desde date default null)
 returns table (rota_entrega text, veiculo_id uuid, placa text, cargas bigint, nfs bigint, ultima date)
 language sql
 stable
 set search_path to 'public'
as $function$
  select nf.rota_entrega,
         r.veiculo_id,
         r.veiculo_placa                as placa,
         count(distinct r.id)           as cargas,
         count(*)                       as nfs,
         max(r.data)                    as ultima
  from notas_fiscais nf
  join rotas r on r.id = nf.rota_id
  where nf.rota_entrega is not null
    and btrim(nf.rota_entrega) <> ''
    and r.veiculo_id is not null
    and r.status <> 'rejeitada'
    and (p_desde is null or r.data >= p_desde)
  group by 1, 2, 3
  order by 1, 4 desc, 6 desc
$function$;

grant execute on function public.rota_veiculo_sugestoes(date) to authenticated;

-- Carga inicial de veiculo_preferencias.rotas_entrega: feita uma vez, em
-- 05/10/2026, a partir da aba "Rotas" da planilha ROTAS_13.02 (coluna Rota ×
-- coluna PLACA, que na planilha traz o nome do motorista). 26 veículos ativos
-- casaram pelo nome do motorista, cobrindo 44 rotas de entrega. Os apelidos sem
-- motorista ativo correspondente ficaram de fora: MOISES VINICIUS, PAULINHO,
-- MARCELO F, NESTOR, MOACIR, ALESSANDRO (ambíguo), ANDRE e PEDRO "2ª carga".
