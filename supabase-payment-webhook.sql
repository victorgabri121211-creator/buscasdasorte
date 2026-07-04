-- Fase 1.5 (parte "sumiços") — confirmação de pagamento no servidor.
-- O Cloudflare Worker guarda o "pedido" na criação da cobrança e, quando o
-- pagamento é confirmado (via webhook da MisticPay ou no polling /pix/status),
-- concede plano/créditos e registra a venda AQUI no servidor — sem depender do
-- navegador do cliente ficar aberto. Idempotente.
--
-- Estas funções são chamadas SÓ pelo worker (service role); NÃO são liberadas
-- para o anon. Rode no SQL Editor do Supabase.

-- Pedidos pendentes (1 por transação).
create table if not exists bds_orders (
  tx_id        text primary key,
  username     text not null,
  category     text not null,          -- 'plan' | 'reseller'
  product_id   text not null,          -- diaria/semana/mes/vitalicio | '10'/'unlimited'
  amount       numeric(10,2),
  label        text,
  ref          text,                   -- afiliado (opcional)
  status       text not null default 'pending',  -- pending | fulfilled
  created_at   bigint default (extract(epoch from now()) * 1000)::bigint,
  fulfilled_at bigint
);
alter table bds_orders enable row level security;

-- Cria o pedido pendente (na hora que a cobrança é gerada).
create or replace function bds_order_create(
  p_tx_id text, p_username text, p_category text, p_product_id text,
  p_amount numeric, p_label text, p_ref text default null
) returns jsonb language plpgsql security definer as $$
begin
  if coalesce(trim(p_tx_id), '') = '' or coalesce(trim(p_username), '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  insert into bds_orders(tx_id, username, category, product_id, amount, label, ref)
  values(p_tx_id, p_username, p_category, p_product_id, p_amount, p_label,
         nullif(trim(coalesce(p_ref, '')), ''))
  on conflict (tx_id) do nothing;
  return jsonb_build_object('ok', true);
end; $$;

-- Concede plano/créditos + registra a venda. Idempotente (só age 1x por pedido).
create or replace function bds_fulfill_order(p_tx_id text)
returns jsonb language plpgsql security definer as $$
declare
  o        bds_orders%rowtype;
  v_now    bigint := (extract(epoch from now()) * 1000)::bigint;
  v_dur    bigint;
  v_exp    bigint;
  v_credits integer;
begin
  select * into o from bds_orders where tx_id = p_tx_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_order'); end if;
  if o.status = 'fulfilled' then return jsonb_build_object('ok', true, 'already', true); end if;

  if o.category = 'plan' then
    v_dur := case o.product_id
      when 'diaria'    then 86400000
      when 'semana'    then 604800000
      when 'mes'       then 2592000000
      when 'vitalicio' then 3153600000000
      else 86400000 end;
    v_exp := v_now + v_dur;
    insert into bds_plans(username, plan_id, period, expires_at, granted_by_admin, updated_at)
    values(o.username, o.product_id, o.product_id, v_exp, false, v_now)
    on conflict (username) do update set
      plan_id = excluded.plan_id, period = excluded.period,
      expires_at = excluded.expires_at, granted_by_admin = false, updated_at = v_now;

  elsif o.category = 'reseller' then
    if o.product_id = 'unlimited' then
      v_credits := 1000000000;  -- "crédito infinito" (mesmo valor do front)
    else
      v_credits := coalesce(nullif(regexp_replace(o.product_id, '\D', '', 'g'), '')::int, 0);
    end if;
    if v_credits > 0 then
      insert into bds_reseller_credits(username, credits) values(o.username, v_credits)
      on conflict (username) do update set credits = bds_reseller_credits.credits + v_credits;
    end if;
  end if;

  -- Registra a venda só se o navegador ainda não registrou (dedup por tx_id).
  if not exists(select 1 from bds_sales where tx_id = o.tx_id) then
    perform bds_record_sale('ord_' || o.tx_id, o.tx_id, v_now, o.category,
                            o.product_id, coalesce(o.label, ''), o.amount, o.username, o.ref);
  end if;

  update bds_orders set status = 'fulfilled', fulfilled_at = v_now where tx_id = p_tx_id;
  return jsonb_build_object('ok', true, 'category', o.category, 'product_id', o.product_id);
end; $$;

-- Permissões: só o worker (service role). Nunca o anon.
revoke all on function bds_order_create(text, text, text, text, numeric, text, text) from public, anon, authenticated;
revoke all on function bds_fulfill_order(text) from public, anon, authenticated;
grant execute on function bds_order_create(text, text, text, text, numeric, text, text) to service_role;
grant execute on function bds_fulfill_order(text) to service_role;
