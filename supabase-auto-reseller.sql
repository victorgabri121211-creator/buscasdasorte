-- BuscasDaSorte — Revenda automática para quem compra plano direto na loja
-- Cole este SQL no SQL Editor do Supabase e clique em RUN.
--
-- Regra: todo cliente que compra um PLANO diretamente (loja) passa a ter a
-- área de revendedor liberada (menu Revendedor + Ranking). Contas criadas
-- por revendedor (created_by_reseller) continuam SEM acesso.
--
-- O que este arquivo faz:
--  1. Atualiza bds_fulfill_order: ao confirmar pagamento de plano, também
--     marca bds_reseller_access.enabled = true (exceto contas de revendedor).
--     Isso faz a comissão de afiliado desses clientes contar no bds_record_sale.
--  2. Backfill: libera revenda para quem JÁ tem plano ativo comprado direto.

-- 1) bds_fulfill_order (substitui a versão do supabase-payment-webhook.sql)
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

    -- Compra direta de plano libera a área de revenda (menos conta de revendedor).
    insert into bds_reseller_access(username, enabled)
    select o.username, true
    where not exists (
      select 1 from bds_users u
      where lower(u.username) = lower(o.username)
        and coalesce(u.created_by_reseller, '') <> ''
    )
    on conflict (username) do update set enabled = true;

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

revoke all on function bds_fulfill_order(text) from public, anon, authenticated;
grant execute on function bds_fulfill_order(text) to service_role;

-- 2) Backfill: libera revenda p/ quem já tem plano ativo comprado direto
insert into bds_reseller_access(username, enabled)
select p.username, true
from bds_plans p
join bds_users u on lower(u.username) = lower(p.username)
where p.plan_id <> 'reseller'
  and coalesce(u.created_by_reseller, '') = ''
  and (p.expires_at is null or p.expires_at > (extract(epoch from now()) * 1000)::bigint)
on conflict (username) do update set enabled = true;
