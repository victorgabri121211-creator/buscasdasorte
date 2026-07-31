-- Corrige o "Reset senha" do painel admin: hoje o botao so grava a senha
-- nova no localStorage do navegador do admin, sem tocar o Supabase. Como o
-- login (bds_login) confere a senha contra a tabela bds_users no banco, o
-- cliente continuava logando com a senha antiga.
-- Rodar uma vez no SQL editor do Supabase (depois de supabase-admin-security.sql,
-- que ja cria bds_admin_hash()).

create or replace function bds_admin_reset_password(p_hash text, p_username text, p_new_password text)
returns jsonb language plpgsql security definer as $$
declare v_hash text := bds_admin_hash();
begin
  if p_hash != v_hash then
    return jsonb_build_object('ok', false, 'msg', 'Unauthorized');
  end if;
  if p_new_password is null or length(p_new_password) < 6 then
    return jsonb_build_object('ok', false, 'msg', 'Senha deve ter mínimo 6 caracteres');
  end if;
  update bds_users set password = p_new_password where lower(username) = lower(p_username);
  if not found then
    return jsonb_build_object('ok', false, 'msg', 'Usuário não encontrado');
  end if;
  return jsonb_build_object('ok', true);
end; $$;

grant execute on function bds_admin_reset_password(text, text, text) to anon;
