create or replace function public.set_admin_permission_groups(p_user_id uuid, p_group_ids uuid[], p_actor_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_profile public.profiles%rowtype; v_count integer;
begin
  if not public.actor_is_root(p_actor_user_id) then raise exception 'FORBIDDEN'; end if;
  select * into v_profile from public.profiles where user_id = p_user_id for update;
  if not found or v_profile.role <> 'ADMIN' then raise exception 'ADMIN_ACCOUNT_NOT_FOUND'; end if;
  delete from public.admin_permission_groups where user_id = p_user_id;
  insert into public.admin_permission_groups(user_id, permission_group_id, assigned_by)
  select p_user_id, group_id, p_actor_user_id from unnest(coalesce(p_group_ids, '{}'::uuid[])) group_id on conflict do nothing;
  select count(*) into v_count from public.admin_permission_groups where user_id = p_user_id;
  perform public.write_audit(p_actor_user_id, 'PERMISSIONS_CHANGE', 'profiles', v_profile.id, null, jsonb_build_object('permission_groups', v_count));
  return jsonb_build_object('user_id', p_user_id, 'permission_groups', v_count);
end;
$$;

grant execute on function public.set_admin_permission_groups(uuid, uuid[], uuid) to authenticated, service_role;
