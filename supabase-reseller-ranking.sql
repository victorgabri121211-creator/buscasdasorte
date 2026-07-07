-- BuscasDaSorte — Ranking de revendedores
-- Cole este SQL no SQL Editor do Supabase e clique em RUN.
--
-- Retorna o top de revendedores por clientes criados (logins gerados),
-- com recorte dos últimos 30 dias e clientes ativos agora.
-- Expõe APENAS agregados + nome do revendedor — nenhum dado de cliente
-- (usuário/senha/validade individual) sai por aqui.

create or replace function bds_get_reseller_ranking()
returns jsonb language plpgsql security definer as $$
declare
  v_now bigint := (extract(epoch from now()) * 1000)::bigint;
  v_d30 bigint;
begin
  v_d30 := v_now - (30::bigint * 86400000);
  return jsonb_build_object(
    'ok', true,
    'ranking', coalesce((
      select jsonb_agg(jsonb_build_object(
        'reseller', t.display_name,
        'total',    t.total,
        'last30',   t.last30,
        'active',   t.active
      ) order by t.total desc, t.last30 desc, t.display_name asc)
      from (
        select max(reseller_username)                                        as display_name,
               count(*)::int                                                 as total,
               (count(*) filter (where coalesce(created_at, 0) >= v_d30))::int as last30,
               (count(*) filter (where coalesce(expires_at, 0) > v_now))::int  as active
        from bds_reseller_logins
        group by lower(reseller_username)
        order by count(*) desc,
                 count(*) filter (where coalesce(created_at, 0) >= v_d30) desc
        limit 10
      ) t
    ), '[]'::jsonb)
  );
end; $$;

grant execute on function bds_get_reseller_ranking() to anon;
