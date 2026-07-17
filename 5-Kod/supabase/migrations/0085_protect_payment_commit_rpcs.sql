-- 0085_protect_payment_commit_rpcs.sql
--
-- Live-verifiering 2026-07-17 visade explicita anon-EXECUTE-grants på de två
-- SECURITY DEFINER-funktioner som committar en webshop-order som betald. Båda
-- får bara anropas av betalda webhook-/callbackflöden genom service_role.

revoke all on function public.mark_shop_order_paid(uuid) from public;
revoke all on function public.mark_shop_order_paid(uuid) from anon;
revoke all on function public.mark_shop_order_paid(uuid) from authenticated;
grant execute on function public.mark_shop_order_paid(uuid) to service_role;

revoke all on function public._commit_shop_order_stock(uuid) from public;
revoke all on function public._commit_shop_order_stock(uuid) from anon;
revoke all on function public._commit_shop_order_stock(uuid) from authenticated;
grant execute on function public._commit_shop_order_stock(uuid) to service_role;

revoke all on function public._generate_gift_code(uuid,text) from public;
revoke all on function public._generate_gift_code(uuid,text) from anon;
revoke all on function public._generate_gift_code(uuid,text) from authenticated;
grant execute on function public._generate_gift_code(uuid,text) to service_role;

revoke all on function public.prune_expired_shop_reserves() from public;
revoke all on function public.prune_expired_shop_reserves() from anon;
revoke all on function public.prune_expired_shop_reserves() from authenticated;
grant execute on function public.prune_expired_shop_reserves() to service_role;

-- Rate-limitern anropas bara från server actions. Direkt anon-EXECUTE gjorde
-- förutsägbara login-/formulär-buckets möjliga att förgifta utanför appen.
revoke all on function public.check_rate_limit(text,int,int) from public;
revoke all on function public.check_rate_limit(text,int,int) from anon;
revoke all on function public.check_rate_limit(text,int,int) from authenticated;
grant execute on function public.check_rate_limit(text,int,int) to service_role;

-- Gästintagen passerar appens tenant-resolution, rate-limit och validering innan
-- dessa skriv-RPC:er anropas med service_role. Direkt anon-EXECUTE skulle annars
-- göra hela app-rälsen valfri. Inloggad kund behåller create_public_booking för
-- ombokningsflödet, vars DB-funktion kräver p_customer = auth.uid().
revoke all on function public.reserve_shop_order(text,jsonb,text,text,integer) from public;
revoke all on function public.reserve_shop_order(text,jsonb,text,text,integer) from anon;
revoke all on function public.reserve_shop_order(text,jsonb,text,text,integer) from authenticated;
grant execute on function public.reserve_shop_order(text,jsonb,text,text,integer) to service_role;

revoke all on function public.join_loyalty_club(text,text,text,uuid) from public;
revoke all on function public.join_loyalty_club(text,text,text,uuid) from anon;
revoke all on function public.join_loyalty_club(text,text,text,uuid) from authenticated;
grant execute on function public.join_loyalty_club(text,text,text,uuid) to service_role;

revoke all on function public.create_public_booking(text,uuid,uuid,timestamptz,text,uuid,text,text,text,uuid,uuid) from public;
revoke all on function public.create_public_booking(text,uuid,uuid,timestamptz,text,uuid,text,text,text,uuid,uuid) from anon;
revoke all on function public.create_public_booking(text,uuid,uuid,timestamptz,text,uuid,text,text,text,uuid,uuid) from authenticated;
grant execute on function public.create_public_booking(text,uuid,uuid,timestamptz,text,uuid,text,text,text,uuid,uuid) to authenticated;
grant execute on function public.create_public_booking(text,uuid,uuid,timestamptz,text,uuid,text,text,text,uuid,uuid) to service_role;
