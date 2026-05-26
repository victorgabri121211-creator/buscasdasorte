-- BuscasDaSorte — Setup do banco de dados Supabase
-- Cole este SQL inteiro no SQL Editor do seu projeto Supabase e clique em RUN

-- ── Tabelas ────────────────────────────────────────────────────────────────

create table if not exists bds_users (
  id uuid default gen_random_uuid() primary key,
  username text unique not null,
  password text not null,
  created_at bigint default (extract(epoch from now()) * 1000)::bigint,
  created_by_reseller text
);

create table if not exists bds_plans (
  username text primary key,
  plan_id text not null,
  period text,
  expires_at bigint,
  granted_by_admin boolean default false,
  granted_by text,
  updated_at bigint default (extract(epoch from now()) * 1000)::bigint
);

create table if not exists bds_reseller_access (
  username text primary key,
  enabled boolean default false
);

create table if not exists bds_reseller_credits (
  username text primary key,
  credits integer default 0
);

create table if not exists bds_reseller_logins (
  id text primary key,
  reseller_username text not null,
  username text not null,
  password text not null,
  days integer,
  created_at bigint default (extract(epoch from now()) * 1000)::bigint,
  expires_at bigint
);

-- ── Row Level Security (acesso apenas via funções abaixo) ──────────────────

alter table bds_users enable row level security;
alter table bds_plans enable row level security;
alter table bds_reseller_access enable row level security;
alter table bds_reseller_credits enable row level security;
alter table bds_reseller_logins enable row level security;

-- ── Funções ────────────────────────────────────────────────────────────────

-- Registrar novo usuário
create or replace function bds_register(p_username text, p_password text, p_created_by_reseller text default null)
returns jsonb language plpgsql security definer as $$
begin
  if lower(p_username) = 'dasorte' then
    return jsonb_build_object('ok', false, 'msg', 'Nome de usuário indisponível');
  end if;
  if exists(select 1 from bds_users where lower(username) = lower(p_username)) then
    return jsonb_build_object('ok', false, 'msg', 'Usuário já existe');
  end if;
  insert into bds_users(username, password, created_by_reseller)
  values(p_username, p_password, p_created_by_reseller);
  return jsonb_build_object('ok', true);
end; $$;

-- Fazer login
create or replace function bds_login(p_username text, p_password text)
returns jsonb language plpgsql security definer as $$
declare v bds_users%rowtype;
begin
  select * into v from bds_users
  where lower(username) = lower(p_username) and password = p_password;
  if not found then return jsonb_build_object('ok', false); end if;
  return jsonb_build_object(
    'ok', true,
    'user', v.username,
    'created_by_reseller', coalesce(v.created_by_reseller, '')
  );
end; $$;

-- Buscar plano do usuário
create or replace function bds_get_plan(p_username text)
returns jsonb language plpgsql security definer as $$
declare p bds_plans%rowtype;
begin
  select * into p from bds_plans where lower(username) = lower(p_username);
  if not found then return jsonb_build_object('ok', true, 'plan', null); end if;
  return jsonb_build_object('ok', true, 'plan', jsonb_build_object(
    'id', p.plan_id, 'period', p.period, 'expiresAt', p.expires_at,
    'grantedByAdmin', p.granted_by_admin, 'grantedBy', p.granted_by
  ));
end; $$;

-- Buscar acesso de revendedor
create or replace function bds_get_reseller_access(p_username text)
returns jsonb language plpgsql security definer as $$
declare v boolean := false;
begin
  select enabled into v from bds_reseller_access where lower(username) = lower(p_username);
  return jsonb_build_object('ok', true, 'enabled', coalesce(v, false));
end; $$;

-- Buscar créditos de revendedor
create or replace function bds_get_reseller_credits(p_username text)
returns jsonb language plpgsql security definer as $$
declare v integer := 0;
begin
  select credits into v from bds_reseller_credits where lower(username) = lower(p_username);
  return jsonb_build_object('ok', true, 'credits', coalesce(v, 0));
end; $$;

-- Buscar logins criados pelo revendedor
create or replace function bds_get_reseller_logins(p_reseller text)
returns jsonb language plpgsql security definer as $$
begin
  return (select jsonb_build_object(
    'ok', true,
    'logins', coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'username', username, 'password', password, 'days', days,
      'created_at', created_at, 'expires_at', expires_at
    ) order by created_at desc), '[]'::jsonb)
  ) from bds_reseller_logins where lower(reseller_username) = lower(p_reseller));
end; $$;

-- Admin: sincronização completa (retorna todos os dados de uma vez)
create or replace function bds_admin_full_sync(p_hash text)
returns jsonb language plpgsql security definer as $$
declare v_hash text := '9dc3eba65b8905b9ea4fb08b06c800de0b35256d0ecfdd80bc59d9713b0bed8c';
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
declare v_hash text := '9dc3eba65b8905b9ea4fb08b06c800de0b35256d0ecfdd80bc59d9713b0bed8c';
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
declare v_hash text := '9dc3eba65b8905b9ea4fb08b06c800de0b35256d0ecfdd80bc59d9713b0bed8c';
begin
  if p_hash != v_hash then return jsonb_build_object('ok', false, 'msg', 'Unauthorized'); end if;
  delete from bds_plans where lower(username) = lower(p_username);
  return jsonb_build_object('ok', true);
end; $$;

-- Admin: configurar acesso de revendedor
create or replace function bds_admin_set_reseller(p_hash text, p_username text, p_enabled boolean)
returns jsonb language plpgsql security definer as $$
declare v_hash text := '9dc3eba65b8905b9ea4fb08b06c800de0b35256d0ecfdd80bc59d9713b0bed8c';
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
  v_hash text := '9dc3eba65b8905b9ea4fb08b06c800de0b35256d0ecfdd80bc59d9713b0bed8c';
  v_total integer;
begin
  if p_hash != v_hash then return jsonb_build_object('ok', false, 'msg', 'Unauthorized'); end if;
  insert into bds_reseller_credits(username, credits) values(p_username, p_amount)
  on conflict (username) do update set credits = bds_reseller_credits.credits + p_amount;
  select credits into v_total from bds_reseller_credits where lower(username) = lower(p_username);
  return jsonb_build_object('ok', true, 'credits', v_total);
end; $$;

-- Revendedor: criar login de cliente
create or replace function bds_create_reseller_login(p_reseller text, p_username text, p_password text, p_days integer)
returns jsonb language plpgsql security definer as $$
declare
  v_credits integer := 0;
  v_expires  bigint;
  v_id       text;
begin
  select credits into v_credits from bds_reseller_credits where lower(username) = lower(p_reseller);
  if coalesce(v_credits, 0) < 1 then
    return jsonb_build_object('ok', false, 'msg', 'Sem créditos de login.');
  end if;
  if exists(select 1 from bds_users where lower(username) = lower(p_username)) then
    return jsonb_build_object('ok', false, 'msg', 'Usuário já existe.');
  end if;
  v_expires := (extract(epoch from now()) * 1000)::bigint + (p_days::bigint * 86400000);
  v_id := 'rl_' || floor(extract(epoch from now()) * 1000)::text || '_' || substr(md5(random()::text), 1, 5);
  insert into bds_users(username, password, created_by_reseller) values(p_username, p_password, p_reseller);
  insert into bds_plans(username, plan_id, period, expires_at, granted_by)
  values(p_username, 'reseller', p_days::text || ' dias', v_expires, p_reseller);
  update bds_reseller_credits set credits = credits - 1 where lower(username) = lower(p_reseller);
  insert into bds_reseller_logins(id, reseller_username, username, password, days, expires_at)
  values(v_id, p_reseller, p_username, p_password, p_days, v_expires);
  return jsonb_build_object('ok', true, 'username', p_username, 'password', p_password, 'days', p_days);
end; $$;

-- Revendedor: desativar cliente
create or replace function bds_deactivate_reseller_login(p_reseller text, p_login_id text)
returns jsonb language plpgsql security definer as $$
declare
  v_expired bigint := (extract(epoch from now()) * 1000)::bigint - 1;
  v_username text;
begin
  select username into v_username from bds_reseller_logins
  where id = p_login_id and lower(reseller_username) = lower(p_reseller);
  if not found then return jsonb_build_object('ok', false, 'msg', 'Login não encontrado.'); end if;
  update bds_reseller_logins set expires_at = v_expired where id = p_login_id;
  update bds_plans set expires_at = v_expired where lower(username) = lower(v_username);
  return jsonb_build_object('ok', true, 'msg', 'Cliente desativado.');
end; $$;

-- Revendedor: deletar cliente
create or replace function bds_delete_reseller_login(p_reseller text, p_login_id text)
returns jsonb language plpgsql security definer as $$
declare v_username text;
begin
  select username into v_username from bds_reseller_logins
  where id = p_login_id and lower(reseller_username) = lower(p_reseller);
  if not found then return jsonb_build_object('ok', false, 'msg', 'Login não encontrado.'); end if;
  delete from bds_reseller_logins where id = p_login_id;
  delete from bds_plans where lower(username) = lower(v_username);
  delete from bds_users where lower(username) = lower(v_username);
  return jsonb_build_object('ok', true, 'msg', 'Cliente removido.');
end; $$;

-- ── Tabela de vendas ───────────────────────────────────────────────────────

create table if not exists bds_sales (
  id text primary key,
  tx_id text,
  ts bigint,
  category text,
  product_id text,
  label text,
  amount numeric(10,2),
  buyer text,
  created_at bigint default (extract(epoch from now()) * 1000)::bigint
);

alter table bds_sales enable row level security;

-- Registrar venda (chamado pelo browser do cliente após pagamento aprovado)
create or replace function bds_record_sale(p_id text, p_tx_id text, p_ts bigint, p_category text, p_product_id text, p_label text, p_amount numeric, p_buyer text)
returns jsonb language plpgsql security definer as $$
begin
  insert into bds_sales(id, tx_id, ts, category, product_id, label, amount, buyer)
  values(p_id, p_tx_id, p_ts, p_category, p_product_id, p_label, p_amount, p_buyer)
  on conflict (id) do nothing;
  return jsonb_build_object('ok', true);
end; $$;

-- ── Permissões de acesso (anon pode chamar as funções) ─────────────────────

grant execute on function bds_register(text, text, text) to anon;
grant execute on function bds_login(text, text) to anon;
grant execute on function bds_get_plan(text) to anon;
grant execute on function bds_get_reseller_access(text) to anon;
grant execute on function bds_get_reseller_credits(text) to anon;
grant execute on function bds_get_reseller_logins(text) to anon;
grant execute on function bds_admin_full_sync(text) to anon;
grant execute on function bds_admin_set_plan(text, text, text, text, bigint) to anon;
grant execute on function bds_admin_clear_plan(text, text) to anon;
grant execute on function bds_admin_set_reseller(text, text, boolean) to anon;
grant execute on function bds_admin_add_credits(text, text, integer) to anon;
grant execute on function bds_create_reseller_login(text, text, text, integer) to anon;
grant execute on function bds_record_sale(text, text, bigint, text, text, text, numeric, text) to anon;
grant execute on function bds_deactivate_reseller_login(text, text) to anon;
grant execute on function bds_delete_reseller_login(text, text) to anon;
