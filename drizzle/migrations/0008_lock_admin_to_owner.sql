-- Alleen de eigenaar mag een beheerdersrij hebben.
delete from public.admin_users where user_id <> 'e11454f4-8b82-4b7a-81a4-4c161b3b222d'::uuid;

create or replace function public.admin_users_only_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'DELETE') then
    if old.user_id = 'e11454f4-8b82-4b7a-81a4-4c161b3b222d'::uuid then
      raise exception 'De eigenaar kan niet verwijderd worden.';
    end if;
    return old;
  end if;
  if new.user_id <> 'e11454f4-8b82-4b7a-81a4-4c161b3b222d'::uuid then
    raise exception 'Alleen de eigenaar kan beheerder zijn.';
  end if;
  return new;
end;
$$;

drop trigger if exists admin_users_only_owner_trg on public.admin_users;
create trigger admin_users_only_owner_trg
before insert or update or delete on public.admin_users
for each row execute function public.admin_users_only_owner();

revoke all on function public.admin_users_only_owner() from anon, authenticated;