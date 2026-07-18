do $$
begin
  if not has_table_privilege('authenticated', 'public.user_location_access', 'SELECT')
     or not has_table_privilege('authenticated', 'public.user_location_access', 'INSERT')
     or not has_table_privilege('authenticated', 'public.user_location_access', 'DELETE')
     or has_table_privilege('authenticated', 'public.user_location_access', 'UPDATE') then
    raise exception 'authenticated_user_location_access_grants_wrong';
  end if;
end
$$;
