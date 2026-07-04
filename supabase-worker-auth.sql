-- #1 (fechar o worker) — função de checagem de acesso usada pelo Cloudflare Worker
-- para decidir se um usuário pode consultar (credenciais válidas + plano ativo).
-- Seguro rodar sobre o banco atual. Rode no SQL Editor do Supabase.
--
-- Cobre usuários normais e clientes de revendedor: os dois têm entrada em
-- bds_plans (o cliente de revendedor recebe plan_id='reseller' com expires_at).
-- O admin ('Dasorte') NÃO passa por aqui — é validado pelo hash no worker.

create or replace function bds_access_check(p_username text, p_password text)
returns jsonb language plpgsql security definer as $$
declare
  v_user      text;
  v_now       bigint := (extract(epoch from now()) * 1000)::bigint;
  v_plan_id   text;
  v_plan_exp  bigint;
begin
  -- 1) credenciais
  select username into v_user
    from bds_users
   where lower(username) = lower(p_username) and password = p_password;
  if v_user is null then
    return jsonb_build_object('ok', false, 'reason', 'credentials');
  end if;

  -- 2) plano ativo (expires_at null = vitalício)
  select plan_id, expires_at into v_plan_id, v_plan_exp
    from bds_plans
   where lower(username) = lower(v_user)
   limit 1;

  if v_plan_id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_plan');
  end if;
  if v_plan_exp is not null and v_plan_exp <= v_now then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  -- valid_until: epoch ms do vencimento, ou null p/ vitalício
  return jsonb_build_object('ok', true, 'username', v_user, 'valid_until', v_plan_exp);
end; $$;

grant execute on function bds_access_check(text, text) to anon;
