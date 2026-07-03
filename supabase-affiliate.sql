-- BuscasDaSorte — Atribuição de vendas por afiliado (link ?ref=)
-- Cole este SQL no SQL Editor do Supabase e clique em RUN.
-- É incremental e seguro: pode ser executado sobre o banco já existente.
--
-- O que faz:
--   • adiciona colunas de afiliado à tabela de vendas (ref + comissão)
--   • ao registrar uma venda, credita comissão ao revendedor que indicou
--     (somente se o ref for um revendedor real e não o próprio comprador)
--   • expõe um relatório de indicações por revendedor
--
-- COMISSÃO: por padrão 20% sobre vendas de PLANO. Para mudar, altere
-- o valor de v_rate na função bds_record_sale abaixo (0.20 = 20%).

-- ── 1. Colunas de afiliado na tabela de vendas ──────────────────────────────
alter table bds_sales add column if not exists ref        text;
alter table bds_sales add column if not exists commission numeric(10,2) default 0;

create index if not exists bds_sales_ref_idx on bds_sales (lower(ref));

-- ── 2. Registrar venda (agora com atribuição de afiliado) ───────────────────
-- Remove a versão antiga (8 args) para evitar ambiguidade de sobrecarga.
drop function if exists bds_record_sale(text, text, bigint, text, text, text, numeric, text);

create or replace function bds_record_sale(
  p_id text, p_tx_id text, p_ts bigint, p_category text,
  p_product_id text, p_label text, p_amount numeric, p_buyer text,
  p_ref text default null
) returns jsonb language plpgsql security definer as $$
declare
  v_rate       numeric := 0.20;   -- % de comissão sobre vendas de plano
  v_ref        text;
  v_commission numeric(10,2) := 0;
  v_is_reseller boolean := false;
begin
  -- Normaliza o ref e valida a atribuição.
  v_ref := nullif(trim(coalesce(p_ref, '')), '');

  if v_ref is not null then
    -- Só credita se o ref for um revendedor habilitado…
    select coalesce(ra.enabled, false) into v_is_reseller
    from bds_reseller_access ra
    where lower(ra.username) = lower(v_ref);

    -- …e não pode indicar a si mesmo.
    if coalesce(v_is_reseller, false) = false
       or lower(v_ref) = lower(coalesce(p_buyer, '')) then
      v_ref := null;
    end if;
  end if;

  -- Comissão apenas sobre vendas de plano (não sobre compra de créditos).
  if v_ref is not null and p_category = 'plan' then
    v_commission := round(coalesce(p_amount, 0) * v_rate, 2);
  end if;

  insert into bds_sales(id, tx_id, ts, category, product_id, label, amount, buyer, ref, commission)
  values(p_id, p_tx_id, p_ts, p_category, p_product_id, p_label, p_amount, p_buyer, v_ref, v_commission)
  on conflict (id) do nothing;

  return jsonb_build_object('ok', true, 'ref', v_ref, 'commission', v_commission);
end; $$;

-- ── 3. Relatório de indicações por revendedor ───────────────────────────────
create or replace function bds_get_affiliate_report(p_reseller text)
returns jsonb language plpgsql security definer as $$
declare v_key text := lower(trim(coalesce(p_reseller, '')));
begin
  if v_key = '' then
    return jsonb_build_object('ok', false, 'msg', 'Revendedor inválido.');
  end if;
  return (
    select jsonb_build_object(
      'ok', true,
      'referrals', coalesce(count(*), 0),
      'revenue',    coalesce(sum(amount), 0),
      'commission', coalesce(sum(commission), 0),
      'recent', coalesce((
        select jsonb_agg(jsonb_build_object(
          'ts', s2.ts, 'label', s2.label, 'amount', s2.amount,
          'commission', s2.commission, 'buyer', s2.buyer
        ) order by s2.ts desc)
        from (
          select * from bds_sales
          where lower(ref) = v_key
          order by ts desc limit 20
        ) s2
      ), '[]'::jsonb)
    )
    from bds_sales where lower(ref) = v_key
  );
end; $$;

-- ── 4. Permissões ───────────────────────────────────────────────────────────
grant execute on function bds_record_sale(text, text, bigint, text, text, text, numeric, text, text) to anon;
grant execute on function bds_get_affiliate_report(text) to anon;
