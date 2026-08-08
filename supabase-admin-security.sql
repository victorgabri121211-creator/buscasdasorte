-- FASE 1 - Seguranca do admin (server-side). Seguro rodar sobre o banco atual.
-- NAO troca a senha ainda; apenas move o hash para uma tabela privada.

create table if not exists bds_admin_config (
  id int primary key default 1,
  admin_hash text not null,
  constraint bds_admin_single check (id = 1)
);
alter table bds_admin_config enable row level security;

-- NAO coloque aqui o hash real da sua senha de admin — este arquivo fica
-- versionado em repositorio publico, e um hash exposto pode ser atacado
-- offline (forca bruta / dicionario) sem limite de tentativas.
-- Gere o hash da SUA senha (SHA-256, minusculo, hex) no console do navegador:
--   crypto.subtle.digest('SHA-256', new TextEncoder().encode('SUA_SENHA_AQUI'))
--     .then(b => console.log(Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2,'0')).join('')))
-- e substitua o placeholder abaixo antes de rodar (ou rode com o
-- placeholder e troque depois com o UPDATE comentado mais abaixo).
insert into bds_admin_config(id, admin_hash) values (1, 'REPLACE_WITH_YOUR_OWN_SHA256_ADMIN_HASH')
on conflict (id) do nothing;

-- Para trocar a senha de admin depois (ex.: rotacionar uma credencial
-- exposta), rode isto direto no SQL Editor do Supabase — nunca commite o
-- hash real no repositorio:
--   update bds_admin_config set admin_hash = 'NOVO_HASH_AQUI' where id = 1;

create or replace function bds_admin_hash() returns text
language sql security definer stable as $$
  select admin_hash from bds_admin_config where id = 1
$$;
revoke all on function bds_admin_hash() from public;
revoke all on function bds_admin_hash() from anon;

create or replace function bds_admin_check(p_hash text)
returns jsonb language plpgsql security definer as $$
begin
  return jsonb_build_object('ok', p_hash is not null and p_hash = bds_admin_hash());
end; $$;
grant execute on function bds_admin_check(text) to anon;

create or replace function bds_admin_full_sync(p_hash text)
returns jsonb language plpgsql security definer as $$
declare v_hash text := bds_admin_hash();
begin
  if p_hash != v_hash then
    return jsonb_build_object('ok', false, 'msg', 'Unauthorized');
  end if;
  return jsonb_build_object(
    'ok', true,
    'users', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'user', u.username,
        'created_at', u.created_at,
        'created_by_reseller', u.created_by_reseller,
        'plan', case when p.plan_id is not null then jsonb_build_object(
          'id', p.plan_id, 'period', p.period, 'expiresAt', p.expires_at,
          'grantedByAdmin', p.granted_by_admin, 'grantedBy', p.granted_by
        ) else null end,
        'reseller_enabled', coalesce(ra.enabled, false),
        'reseller_credits', coalesce(rc.credits, 0)
      ) order by u.created_at desc), '[]'::jsonb)
      from bds_users u
      left join bds_plans p on lower(p.username) = lower(u.username)
      left join bds_reseller_access ra on lower(ra.username) = lower(u.username)
      left join bds_reseller_credits rc on lower(rc.username) = lower(u.username)
    ),
    'reseller_logins', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'reseller_username', reseller_username, 'username', username,
        'password', password, 'days', days, 'created_at', created_at, 'expires_at', expires_at
      ) order by created_at desc), '[]'::jsonb)
      from bds_reseller_logins
    ),
    'sales', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'tx_id', tx_id, 'ts', ts, 'category', category,
        'product_id', product_id, 'label', label, 'amount', amount, 'buyer', buyer
      ) order by ts desc), '[]'::jsonb)
      from bds_sales
    )
  );
end; $$;

-- Admin: ativar plano para usuário
create or replace function bds_admin_set_plan(p_hash text, p_username text, p_plan_id text, p_period text, p_expires_at bigint)
returns jsonb language plpgsql security definer as $$
declare v_hash text := bds_admin_hash();
begin
  if p_hash != v_hash then return jsonb_build_object('ok', false, 'msg', 'Unauthorized'); end if;
  insert into bds_plans(username, plan_id, period, expires_at, granted_by_admin, updated_at)
  values(p_username, p_plan_id, p_period, p_expires_at, true, (extract(epoch from now()) * 1000)::bigint)
  on conflict (username) do update set
    plan_id = excluded.plan_id, period = excluded.period, expires_at = excluded.expires_at,
    granted_by_admin = excluded.granted_by_admin, updated_at = excluded.updated_at;
  return jsonb_build_object('ok', true);
end; $$;

-- Admin: remover plano
create or replace function bds_admin_clear_plan(p_hash text, p_username text)
returns jsonb language plpgsql security definer as $$
declare v_hash text := bds_admin_hash();
begin
  if p_hash != v_hash then return jsonb_build_object('ok', false, 'msg', 'Unauthorized'); end if;
  delete from bds_plans where lower(username) = lower(p_username);
  return jsonb_build_object('ok', true);
end; $$;

-- Admin: configurar acesso de revendedor
create or replace function bds_admin_set_reseller(p_hash text, p_username text, p_enabled boolean)
returns jsonb language plpgsql security definer as $$
declare v_hash text := bds_admin_hash();
begin
  if p_hash != v_hash then return jsonb_build_object('ok', false, 'msg', 'Unauthorized'); end if;
  insert into bds_reseller_access(username, enabled) values(p_username, p_enabled)
  on conflict (username) do update set enabled = excluded.enabled;
  return jsonb_build_object('ok', true);
end; $$;

-- Admin: adicionar créditos ao revendedor
create or replace function bds_admin_add_credits(p_hash text, p_username text, p_amount integer)
returns jsonb language plpgsql security definer as $$
declare
  v_hash text := bds_admin_hash();
  v_total integer;
begin
  if p_hash != v_hash then return jsonb_build_object('ok', false, 'msg', 'Unauthorized'); end if;
  insert into bds_reseller_credits(username, credits) values(p_username, p_amount)
  on conflict (username) do update set credits = bds_reseller_credits.credits + p_amount;
  select credits into v_total from bds_reseller_credits where lower(username) = lower(p_username);
  return jsonb_build_object('ok', true, 'credits', v_total);
end; $$;

-- Revendedor: criar login de cliente

grant execute on function bds_admin_full_sync(text) to anon;
grant execute on function bds_admin_set_plan(text, text, text, text, bigint) to anon;
grant execute on function bds_admin_clear_plan(text, text) to anon;
grant execute on function bds_admin_set_reseller(text, text, boolean) to anon;
grant execute on function bds_admin_add_credits(text, text, integer) to anon;
