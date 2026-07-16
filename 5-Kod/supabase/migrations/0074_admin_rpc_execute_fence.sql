-- 0074 — Dölj ägar-RPC:er från den publika API-rollen.
--
-- Supabase-projektets default privileges ger nya funktioner ett uttryckligt
-- EXECUTE till anon. REVOKE ... FROM public i 0070/0073 tar därför inte bort den
-- separata anon-granten. Funktionernas interna owner-vakt stoppade mutationer,
-- men de ska inte ens vara anropbara från det publika API:t.

revoke execute on function public.create_admin_booking(
  uuid,uuid,timestamptz,uuid,uuid,text,text,text,text,uuid
) from anon;
revoke execute on function public.create_staff_with_defaults(text,uuid,uuid) from anon;
revoke execute on function public.set_staff_active(uuid,boolean) from anon;
revoke execute on function public.replace_staff_services(uuid,uuid[]) from anon;
revoke execute on function public.restore_schedule_backup() from anon;
