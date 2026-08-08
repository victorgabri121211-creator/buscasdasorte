-- BuscasDaSorte — Chave de API por cliente (uso em bots externos)
-- Cole este SQL no SQL Editor do Supabase e clique em RUN.
-- Pré-requisito: supabase-admin-security.sql já aplicado (usa bds_admin_hash()).
--
-- O que faz:
--   - cada cliente com plano ativo pode gerar uma chave fixa (bds_live_...)
--     para usar em bots/integrações externas, sem depender do token de sessão
--     de 24h do site;
--   - a chave só autentica enquanto o plano do dono estiver ativo — o worker
--     confere isso a cada chamada (ver bds_api_key_check);
--   - gerar/regenerar exige a senha do próprio usuário (mesmo padrão das
--     funções de revendedor) — sem isso, IDOR de novo.

create extension if not exists pgcrypto;

create table if not exists bds_api_keys (
  username text primary key,
  api_key text unique not null,
  created_at bigint default (extract(epoch from now()) * 1000)::bigint,
  last_used_at bigint
);
alter table bds_api_keys enable row level security;
create index if not exists bds_api_keys_key_idx on bds_api_keys (api_key);

-- Cliente: pega a chave existente ou cria uma na primeira vez.
create or replace function bds_get_or_create_api_key(p_username text, p_password text)
returns jsonb language plpgsql security definer as $$
declare
  v_admin_hash text := bds_admin_hash();
  v_key text;
begin
  if p_password is null or (
     p_password != v_admin_hash
     and not exists(select 1 from bds_users where lower(username) = lower(p_username) and password = p_password)
  ) then
    return jsonb_build_object('ok', false, 'msg', 'Não autorizado.');
  end if;

  select api_key into v_key from bds_api_keys where lower(username) = lower(p_username);
  if v_key is null then
    v_key := 'bds_live_' || encode(gen_random_bytes(24), 'hex');
    insert into bds_api_keys(username, api_key) values (p_username, v_key);
  end if;
  return jsonb_build_object('ok', true, 'api_key', v_key);
end; $$;

-- Cliente: invalida a chave atual e gera outra (ex.: suspeita de vazamento).
create or replace function bds_regenerate_api_key(p_username text, p_password text)
returns jsonb language plpgsql security definer as $$
declare
  v_admin_hash text := bds_admin_hash();
  v_key text;
begin
  if p_password is null or (
     p_password != v_admin_hash
     and not exists(select 1 from bds_users where lower(username) = lower(p_username) and password = p_password)
  ) then
    return jsonb_build_object('ok', false, 'msg', 'Não autorizado.');
  end if;

  v_key := 'bds_live_' || encode(gen_random_bytes(24), 'hex');
  insert into bds_api_keys(username, api_key, created_at, last_used_at)
  values (p_username, v_key, (extract(epoch from now()) * 1000)::bigint, null)
  on conflict (username) do update set
    api_key = excluded.api_key, created_at = excluded.created_at, last_used_at = null;
  return jsonb_build_object('ok', true, 'api_key', v_key);
end; $$;

-- Worker (service_role apenas — nunca liberar para anon): valida uma chave de
-- API recebida de um bot externo e confere se o plano do dono ainda vale.
create or replace function bds_api_key_check(p_api_key text)
returns jsonb language plpgsql security definer as $$
declare
  v_user     text;
  v_now      bigint := (extract(epoch from now()) * 1000)::bigint;
  v_plan_id  text;
  v_plan_exp bigint;
begin
  if p_api_key is null or p_api_key = '' then
    return jsonb_build_object('ok', false);
  end if;
  select username into v_user from bds_api_keys where api_key = p_api_key;
  if v_user is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_key');
  end if;

  select plan_id, expires_at into v_plan_id, v_plan_exp
    from bds_plans where lower(username) = lower(v_user) limit 1;

  if v_plan_id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_plan');
  end if;
  if v_plan_exp is not null and v_plan_exp <= v_now then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  update bds_api_keys set last_used_at = v_now where lower(username) = lower(v_user);
  return jsonb_build_object('ok', true, 'username', v_user, 'valid_until', v_plan_exp);
end; $$;
revoke all on function bds_api_key_check(text) from public, anon;
grant execute on function bds_api_key_check(text) to service_role;

grant execute on function bds_get_or_create_api_key(text, text) to anon;
grant execute on function bds_regenerate_api_key(text, text) to anon;
