-- Run once, as a trusted database administrator, after creating the first
-- Supabase Auth user. Replace the UUID with auth.users.id for the owner.
-- Do not expose service-role credentials in the application.
do $$
declare
  changed integer;
begin
  update public.user_roles
  set role = 'owner_admin', updated_at = now()
  where user_id = '00000000-0000-0000-0000-000000000000'::uuid;
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'Owner bootstrap did not update exactly one user; verify the UUID'; end if;
end;
$$;
