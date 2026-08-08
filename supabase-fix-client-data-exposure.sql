-- BuscasDaSorte — Fecha vazamento de dados de clientes (IDOR)
-- Cole este SQL no SQL Editor do Supabase e clique em RUN.
--
-- PROBLEMA: bds_get_reseller_logins e bds_get_affiliate_report aceitavam
-- so o username do revendedor (p_reseller), sem checar senha nenhuma.
-- Como sao "grant ... to anon", QUALQUER pessoa na internet podia chamar
-- essas funcoes direto (fora do site) so adivinhando/sabendo o username
-- de um revendedor e receber:
--   - bds_get_reseller_logins: username + SENHA EM TEXTO CLARO de todos
--     os clientes daquele revendedor;
--   - bds_get_affiliate_report: nome dos compradores, valores e comissao.
--
-- Isso segue o mesmo padrao ja corrigido nas funcoes de escrita do
-- revendedor (criar/renovar/desativar/excluir login) no commit
-- "fix: RPCs de revendedor exigem senha, nao so a anon key (IDOR)" — essas
-- duas funcoes de LEITURA ficaram de fora daquela correcao.
--
-- CORRECAO: agora exigem p_reseller_password (a senha do proprio
-- revendedor, ou o hash de admin) igual as demais funcoes protegidas.

-- ── Revendedor: logins de clientes (agora com senha) ────────────────────────

drop function if exists bds_get_reseller_logins(text);

create or replace function bds_get_reseller_logins(p_reseller text, p_reseller_password text default null)
returns jsonb language plpgsql security definer as $$
declare v_admin_hash text := bds_admin_hash();
begin
  if p_reseller_password is null or (
     p_reseller_password != v_admin_hash
     and not exists(select 1 from bds_users where lower(username) = lower(p_reseller) and password = p_reseller_password)
  ) then
    return jsonb_build_object('ok', false, 'msg', 'Não autorizado.');
  end if;
  return (select jsonb_build_object(
    'ok', true,
    'logins', coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'username', username, 'password', password, 'days', days,
      'created_at', created_at, 'expires_at', expires_at
    ) order by created_at desc), '[]'::jsonb)
  ) from bds_reseller_logins where lower(reseller_username) = lower(p_reseller));
end; $$;

grant execute on function bds_get_reseller_logins(text, text) to anon;

-- ── Revendedor: relatório de afiliado (agora com senha) ─────────────────────

drop function if exists bds_get_affiliate_report(text);

create or replace function bds_get_affiliate_report(p_reseller text, p_reseller_password text default null)
returns jsonb language plpgsql security definer as $$
declare
  v_admin_hash text := bds_admin_hash();
  v_key text := lower(trim(coalesce(p_reseller, '')));
begin
  if v_key = '' then
    return jsonb_build_object('ok', false, 'msg', 'Revendedor inválido.');
  end if;
  if p_reseller_password is null or (
     p_reseller_password != v_admin_hash
     and not exists(select 1 from bds_users where lower(username) = v_key and password = p_reseller_password)
  ) then
    return jsonb_build_object('ok', false, 'msg', 'Não autorizado.');
  end if;
  return (
    select jsonb_build_object(
      'ok', true,
      'referrals', coalesce(count(*), 0),
      'revenue', coalesce(sum(amount), 0),
      'commission', coalesce(sum(commission), 0),
      'recent', coalesce((
        select jsonb_agg(jsonb_build_object(
          'ts', s2.ts, 'label', s2.label, 'amount', s2.amount, 'commission', s2.commission, 'buyer', s2.buyer
        ) order by s2.ts desc)
        from (select * from bds_sales where lower(ref) = v_key order by ts desc limit 20) s2
      ), '[]'::jsonb)
    )
    from bds_sales where lower(ref) = v_key
  );
end; $$;

grant execute on function bds_get_affiliate_report(text, text) to anon;
