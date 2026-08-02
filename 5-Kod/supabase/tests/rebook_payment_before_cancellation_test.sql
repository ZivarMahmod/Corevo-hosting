do $$
declare
  v_definition text;
  v_payment_move integer;
  v_old_cancellation integer;
begin
  select lower(pg_get_functiondef(
    'public.finalize_customer_booking_rebook(uuid,uuid,uuid,uuid,uuid)'::regprocedure
  )) into v_definition;

  v_payment_move := position('set booking_id = p_new_booking' in v_definition);
  v_old_cancellation := position('set status = ''cancelled''' in v_definition);

  if v_payment_move = 0 or v_old_cancellation = 0 or v_payment_move >= v_old_cancellation then
    raise exception 'rebook must move payment before cancelling old booking';
  end if;
end;
$$;
