-- Goal 90 preflight: make legacy gallery/media rows safe for the hard contract.
begin;

-- The following migration normalizes the complete order. This only prevents a
-- legacy negative value from blocking its non-negative constraint first.
update public.gallery_items
   set sort_order = 0
 where sort_order < 0;

do $$
declare
  v_count integer;
begin
  select count(*) into v_count
    from public.blog_posts b
    left join public.media_assets m
      on m.id = b.cover_asset_id and m.tenant_id = b.tenant_id
   where b.cover_asset_id is not null and m.id is null;
  if v_count > 0 then
    raise exception 'goal90_media_preflight: blog_posts has % invalid asset reference(s)', v_count;
  end if;

  select count(*) into v_count
    from public.content_slots s
    left join public.media_assets m
      on m.id = s.asset_id and m.tenant_id = s.tenant_id
   where s.asset_id is not null and m.id is null;
  if v_count > 0 then
    raise exception 'goal90_media_preflight: content_slots has % invalid asset reference(s)', v_count;
  end if;

  select count(*) into v_count
    from public.gallery_items g
    left join public.media_assets m
      on m.id = g.asset_id and m.tenant_id = g.tenant_id
   where g.asset_id is not null and m.id is null;
  if v_count > 0 then
    raise exception 'goal90_media_preflight: gallery_items has % invalid asset reference(s)', v_count;
  end if;

  select count(*) into v_count
    from public.shop_products p
    left join public.media_assets m
      on m.id = p.image_asset_id and m.tenant_id = p.tenant_id
   where p.image_asset_id is not null and m.id is null;
  if v_count > 0 then
    raise exception 'goal90_media_preflight: shop_products has % invalid asset reference(s)', v_count;
  end if;

  select count(*) into v_count
    from public.shop_product_variants v
    left join public.media_assets m
      on m.id = v.image_asset_id and m.tenant_id = v.tenant_id
   where v.image_asset_id is not null and m.id is null;
  if v_count > 0 then
    raise exception
      'goal90_media_preflight: shop_product_variants has % invalid asset reference(s)',
      v_count;
  end if;
end
$$;

commit;
