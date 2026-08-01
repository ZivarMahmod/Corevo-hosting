-- Goal 93: keep the preview catalog byte-aligned with the seven canonical
-- palette corrections that make the 12-theme runtime pass WCAG AA.

do $$
declare
  v_rows integer;
begin
  update public.templates as template
     set tokens = pg_catalog.jsonb_set(
           template.tokens,
           '{color}',
           (template.tokens -> 'color') || palette.new_colors,
           false
         ),
         updated_at = pg_catalog.now()
    from (
      values
        (
          'ateljevinter',
          '{"primary":"#6F7D6E","fg2":"#8B8B85"}'::jsonb,
          '{"primary":"#6A7869","fg2":"#73736D"}'::jsonb
        ),
        (
          'aurora',
          '{"primary":"#B85C48","fg2":"#7A6257"}'::jsonb,
          '{"primary":"#9B4D3C","fg2":"#765E54"}'::jsonb
        ),
        (
          'lunaria',
          '{"accentSoft":"#7C8AA0"}'::jsonb,
          '{"accentSoft":"#B8BFCB"}'::jsonb
        ),
        (
          'onyx',
          '{"accentSoft":"#6B655B"}'::jsonb,
          '{"accentSoft":"#89857D"}'::jsonb
        ),
        (
          'sivsav',
          '{"primary":"#7C8B6B","primaryD":"#647253"}'::jsonb,
          '{"primary":"#5D6A4E","primaryD":"#4F5A41"}'::jsonb
        ),
        (
          'snitt',
          '{"accentSoft":"#6E6B61"}'::jsonb,
          '{"accentSoft":"#88867D"}'::jsonb
        ),
        (
          'solsalt',
          '{"primaryD":"#C2512E"}'::jsonb,
          '{"primaryD":"#B74D2C"}'::jsonb
        )
    ) as palette(key, old_colors, new_colors)
   where template.key = palette.key
     and template.contract_version = 1
     and template.owner = 'corevo'
     and template.status = 'active'
     and template.selectable
     and (
       template.tokens -> 'color' @> palette.old_colors
       or template.tokens -> 'color' @> palette.new_colors
     );

  get diagnostics v_rows = row_count;
  if v_rows <> 7 then
    raise exception
      'goal93_catalog_a11y_palettes: expected seven compatible catalog rows, updated %',
      v_rows;
  end if;
end
$$;
