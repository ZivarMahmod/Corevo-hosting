# Live-schema snapshot — `clylvowtowbtotrahuad` (prod)

> Hämtad 2026-06-17 via Supabase-connector (project `clylvowtowbtotrahuad` = "ZivarMahmod's Project", PG17, ACTIVE_HEALTHY).
> **DETTA är DB-sanningen för goal-46.** ALDRIG `ygieacwrpevytghdxecd` (annat projekt = fel-connector-fällan).
> Notation: `kolumn:typ` — `!` = NOT NULL. Radantal = live (många tomma = baseline-reset, ej bevis på lös nod).

## Tabeller (schema.tabell — rader — kolumner)

| Tabell | Rader | Kolumner |
|---|---|---|
| public.tenants | 2 | id:uuid!, slug:text!, name:text!, plan:text!, status:text!, stripe_account_id:text, created_at!, updated_at, stripe_charges_enabled:bool!, stripe_payouts_enabled:bool!, stripe_details_submitted:bool!, city:text, vertical_id:text |
| public.tenant_domains | 0 | id!, tenant_id!, domain!, is_primary:bool!, verified:bool!, created_at! |
| public.tenant_settings | 2 | id!, tenant_id!, payment_mode:text!, branding:jsonb!, settings:jsonb!, service_fee_type:text!, service_fee_value:int!, created_at!, updated_at, billing_model:text!, setup_fee_cents:int!, per_booking_fee_cents:int!, flat_monthly_fee_cents:int!, payments_enabled:bool! |
| public.roles | 5 | id!, tenant_id, name:text!, level:int!, created_at! |
| public.role_permissions | 35 | id!, role_name:text!, area:text!, perm:text!, updated_at! |
| public.users | 2 | id!, tenant_id!, email:text, phone:text, role_id, status:text!, created_at!, updated_at, full_name:text |
| public.staff | 1 | id!, tenant_id!, profile_id, title:text, active:bool!, created_at!, updated_at, location_id, slot_step_min:int, buffer_min:int |
| public.staff_services | 3 | tenant_id!, staff_id!, service_id! |
| public.services | 4 | id!, tenant_id!, name!, description, category:text, duration_min:int!, price_cents:int!, active:bool!, created_at!, updated_at, location_id, slot_step_min:int, buffer_min:int |
| public.working_hours | 5 | id!, tenant_id!, staff_id!, weekday:int!, start_time:time!, end_time:time!, location_id |
| public.working_hour_slots | 0 | id!, tenant_id!, staff_id!, location_id, weekday:int!, start_time:time!, active:bool!, created_at!, updated_at |
| public.time_off | 0 | id!, tenant_id!, staff_id!, start_ts!, end_ts!, reason:text, created_at!, location_id |
| public.locations | 1 | id!, tenant_id!, name!, address:text, timezone:text!, is_primary:bool!, created_at!, updated_at, active:bool! |
| public.bookings | 1 | id!, tenant_id!, staff_id!, service_id!, customer_profile_id:uuid, start_ts!, end_ts!, status:text!, price_cents:int, note:text, created_at!, updated_at, location_id!, reminded_at, customer_id:uuid |
| public.booking_status_history | 2 | id!, booking_id!, tenant_id!, from_status:text, to_status:text!, changed_by, source:text!, rebooked_from, rebooked_to, changed_at! |
| public.payments | 0 | id!, tenant_id!, booking_id!, stripe_payment_intent_id:text, amount_cents:int!, currency:text!, status:text!, created_at!, updated_at, stripe_checkout_session_id:text |
| public.customers | 1 | id!, tenant_id!, auth_user_id, contact_hash:text, display_name:text, name_hidden:bool!, full_name:text, email:text, phone:text, status:text!, first_seen_at!, last_seen_at!, created_at!, updated_at |
| public.customer_favorites | 0 | id!, tenant_id!, customer_id!, kind:text!, staff_id, service_id, created_at! |
| public.customer_notes | 0 | id!, tenant_id!, customer_id!, preferences:ARRAY!, allergies:ARRAY!, products:ARRAY!, hair_type:text, hair_length:text, sensitivity:text, internal_note:text, created_by, created_at!, updated_at |
| public.loyalty_ledger | 0 | id!, tenant_id!, customer_id!, booking_id, points_delta:int!, reason:text!, note:text, created_at! |
| public.audit_log | 10 | id!, tenant_id!, actor_profile_id, action:text!, entity:text!, entity_id, meta:jsonb!, created_at! |
| public.media_assets | 1 | id!, tenant_id!, r2_key:text!, url:text!, type:text!, alt:text, size_bytes:bigint!, width:int, height:int, content_hash:text, source:text!, library_item_id, created_at!, updated_at |
| public.verticals | 5 | key:text!, name!, default_modules:jsonb!, default_template:text, terminology:jsonb!, rules:jsonb!, created_at!, updated_at |
| public.modules | 7 | key:text!, name!, owns_tables:jsonb!, variant_schema:jsonb!, default_config:jsonb!, default_section_position:text, created_at!, updated_at |
| public.tenant_modules | 8 | id!, tenant_id!, module_key:text!, state:text!, config:jsonb!, activated_at, updated_at, created_at! |
| public.templates | 27 | key:text!, name!, tags:jsonb!, tokens:jsonb!, sections:jsonb!, status:text!, created_at!, updated_at |
| public.template_slots | 249 | id!, template_key!, section_key!, slot_key!, label!, kind:text!, asset_role:text, aspect_hint:text, module_key:text, module_view:text, repeatable:bool!, sort_order:int!, default_kind:text, default_text:text, default_asset_key:text |
| public.content_slots | 0 | id!, tenant_id!, template_key!, slot_key!, kind:text!, asset_id, text_value:jsonb, module_ref:jsonb, updated_by, created_at!, updated_at |
| public.site_content_vertical_defaults | 1 | id!, vertical_id!, template_key!, region_key!, value:text!, created_at!, updated_at |
| public.shop_products | 1 | id!, tenant_id!, name!, slug:text, description, price_cents:int!, currency:text!, stock:int, image_asset_id, active:bool!, sort_order:int!, created_at!, updated_at |
| public.shop_orders | 0 | id!, tenant_id!, customer_id, customer_name, customer_email, customer_phone, fulfilment:text!, ship_address:text, pickup_location_id, pickup_by:date, ready_at, total_cents:int!, currency:text!, status:text!, payment_status:text!, note, created_at!, updated_at |
| public.shop_order_items | 0 | id!, tenant_id!, order_id!, product_id, product_name!, unit_price_cents:int!, quantity:int!, created_at! |
| public.offert_requests | 0 | id!, tenant_id!, customer_id, customer_name, customer_email, customer_phone, mode:text!, subject, message, details:jsonb!, estimate_cents:int, currency:text!, status:text!, payment_status:text!, note, created_at!, updated_at |
| public.blog_posts | 0 | id!, tenant_id!, title!, slug:text, excerpt, body, cover_asset_id, status:text!, published_at, sort_order:int!, created_at!, updated_at |
| public.gift_cards | 1 | id!, tenant_id!, code:text!, initial_amount_cents:int!, balance_cents:int!, currency:text!, status:text!, recipient_name, recipient_email, message, expires_at, created_at!, updated_at |
| private.rate_limit_hits | 12 | bucket:text!, window_start:timestamptz!, hits:int! |

## FK-graf (alla `tenant_id → tenants` utelämnade för korthet)

- booking_status_history.booking_id → bookings
- bookings: customer_id→customers, location_id→locations, service_id→services, staff_id→staff
- blog_posts.cover_asset_id → media_assets
- content_slots: asset_id→media_assets, updated_by→users
- customer_favorites: customer_id→customers, service_id→services, staff_id→staff
- customer_notes: created_by→users, customer_id→customers
- customers.auth_user_id → users
- loyalty_ledger: booking_id→bookings, customer_id→customers
- offert_requests.customer_id → customers
- payments.booking_id → bookings
- services.location_id → locations
- shop_order_items: order_id→shop_orders, product_id→shop_products
- shop_orders: customer_id→customers, pickup_location_id→locations
- shop_products.image_asset_id → media_assets
- site_content_vertical_defaults.vertical_id → verticals
- staff: location_id→locations, profile_id→users
- staff_services: service_id→services, staff_id→staff
- template_slots.template_key → templates
- tenant_modules.module_key → modules
- tenants.vertical_id → verticals
- time_off: location_id→locations, staff_id→staff
- users: id→auth.users, role_id→roles
- working_hour(_slots): location_id→locations, staff_id→staff

## RLS
ALLA tabeller har `rls_enabled=true`. Tenant-isolering via `private.tenant_id()` (RÖR EJ). Ny migration som rör en tabell MÅSTE behålla/återskapa rätt RLS.
