-- Goal 93 catalog projection, references, deprecation and read-only catalog grants.
-- Every fixture is transactional and rolled back.
begin;

select pg_catalog.set_config('request.jwt.claim.sub', '', true);
select pg_catalog.set_config('request.jwt.claim.role', '', true);
select pg_catalog.set_config('request.jwt.claims', '{}', true);

do $$
begin
  if not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'templates'
       and column_name = 'contract_version'
  )
  or not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'templates'
       and column_name = 'owner'
  )
  or not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'templates'
       and column_name = 'selectable'
  )
  or not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'templates'
       and column_name = 'replacement_key'
  )
  or pg_catalog.to_regclass('public.template_verticals') is null
  or pg_catalog.to_regclass('public.template_required_modules') is null then
    raise exception 'goal93_catalog_projection_missing';
  end if;
end
$$;

do $$
declare
  v_keys text[];
  v_expected constant text[] := array[
    'ateljevinter',
    'aurora',
    'blomstertorget',
    'calytrix',
    'eloria',
    'kalla',
    'lunaria',
    'onyx',
    'siluett',
    'sivsav',
    'snitt',
    'solsalt'
  ];
begin
  select pg_catalog.array_agg(t.key order by t.key)
    into v_keys
    from public.templates t
   where t.selectable;

  if v_keys is distinct from v_expected then
    raise exception 'goal93_selectable_set_invalid: %', v_keys;
  end if;

  if exists (
    select 1
      from public.templates t
     where t.key = any(v_expected)
       and (
         t.contract_version <> 1
         or t.owner <> 'corevo'
         or t.status <> 'active'
         or not t.selectable
         or t.replacement_key is not null
       )
  ) then
    raise exception 'goal93_template_metadata_invalid';
  end if;

  if exists (
    select 1
      from public.templates t
     where t.key = any(v_expected)
       and (
         pg_catalog.jsonb_typeof(t.tokens -> 'color') <> 'object'
         or nullif(t.tokens #>> '{font,heading}', '') is null
         or nullif(t.tokens #>> '{font,body}', '') is null
         or nullif(t.tokens #>> '{layout,radius}', '') is null
         or nullif(t.tokens #>> '{layout,navHeight,desktop}', '') is null
         or nullif(t.tokens #>> '{layout,navHeight,mobile}', '') is null
         or pg_catalog.jsonb_typeof(t.tokens -> 'caps') <> 'object'
         or pg_catalog.jsonb_typeof(t.sections) <> 'array'
         or pg_catalog.jsonb_array_length(t.sections) = 0
         or t.tags ->> 'scope' <> 'corevo-12'
       )
  ) then
    raise exception 'goal93_template_projection_placeholder_or_incomplete';
  end if;

  if exists (
    select 1
      from pg_catalog.unnest(
        array['salvia','leander','zigge','linnea','edit','flora','freshcut','zentum']
      ) key
      left join public.templates t using (key)
     where t.key is null
        or t.contract_version <> 0
        or t.owner <> 'legacy'
        or t.status <> 'active'
        or t.selectable
        or t.replacement_key is not null
  ) then
    raise exception 'goal93_legacy_template_invalid';
  end if;

  if exists (
    select 1
      from (
        values
          ('flora', 'Flora'),
          ('freshcut', 'FreshCut'),
          ('zentum', 'Zentum')
      ) expected(key, name)
      join public.templates t using (key)
     where t.name <> expected.name
  ) then
    raise exception 'goal93_legacy_template_name_invalid';
  end if;
end
$$;

do $$
declare
  v_corevo text[] := array[
    'ateljevinter','aurora','blomstertorget','calytrix','eloria','lunaria',
    'onyx','sivsav','solsalt','kalla','siluett','snitt'
  ];
begin
  if (select count(*) from public.template_verticals where template_key = any(v_corevo)) <> 12
     or (select count(*) from public.template_verticals where vertical_key = 'florist' and template_key = any(v_corevo)) <> 9
     or (select count(*) from public.template_verticals where vertical_key = 'frisör' and template_key = any(v_corevo)) <> 3 then
    raise exception 'goal93_vertical_projection_invalid';
  end if;

  if exists (
    select tv.template_key
      from public.template_verticals tv
     where tv.template_key = any(v_corevo)
     group by tv.template_key
    having count(*) <> 1
  ) then
    raise exception 'goal93_template_vertical_cardinality_invalid';
  end if;

  if (select count(*) from public.template_required_modules where template_key = any(v_corevo)) <> 93
     or exists (
       select 1
         from public.template_required_modules trm
         join public.template_verticals tv using (template_key)
        where trm.template_key = any(v_corevo)
        group by trm.template_key, tv.vertical_key
       having count(*) <> case when tv.vertical_key = 'florist' then 8 else 7 end
     ) then
    raise exception 'goal93_required_module_projection_invalid';
  end if;

  if exists (
    select 1
      from public.template_verticals tv
      left join public.templates t on t.key = tv.template_key
      left join public.verticals v on v.key = tv.vertical_key
     where t.key is null or v.key is null
  )
  or exists (
    select 1
      from public.template_required_modules trm
      left join public.templates t on t.key = trm.template_key
      left join public.modules m on m.key = trm.module_key
     where t.key is null or m.key is null
  )
  or exists (
    select 1
      from public.template_slots s
      left join public.templates t on t.key = s.template_key
      left join public.modules m on m.key = s.module_key
     where t.key is null or (s.module_key is not null and m.key is null)
  ) then
    raise exception 'goal93_orphan_reference';
  end if;

  if exists (
    select key
      from pg_catalog.unnest(v_corevo) key
     where not exists (
       select 1
         from public.template_slots s
        where s.template_key = key
          and s.kind = 'text'
          and s.slot_key like 'copy.%'
     )
  ) then
    raise exception 'goal93_editable_slots_missing';
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
      from pg_catalog.pg_constraint
     where conname = 'templates_replacement_key_fkey'
       and convalidated
  )
  or not exists (
    select 1
      from pg_catalog.pg_constraint
     where conname = 'verticals_default_template_fkey'
       and convalidated
  )
  or not exists (
    select 1
      from pg_catalog.pg_constraint
     where conname = 'template_slots_module_key_fkey'
       and convalidated
  ) then
    raise exception 'goal93_validated_fk_missing';
  end if;

  if not pg_catalog.has_table_privilege('anon', 'public.template_verticals', 'select')
     or not pg_catalog.has_table_privilege('authenticated', 'public.template_verticals', 'select')
     or pg_catalog.has_table_privilege('anon', 'public.template_verticals', 'insert')
     or pg_catalog.has_table_privilege('authenticated', 'public.template_verticals', 'insert')
     or not pg_catalog.has_table_privilege('anon', 'public.template_required_modules', 'select')
     or not pg_catalog.has_table_privilege('authenticated', 'public.template_required_modules', 'select')
     or pg_catalog.has_table_privilege('anon', 'public.template_required_modules', 'insert')
     or pg_catalog.has_table_privilege('authenticated', 'public.template_required_modules', 'insert') then
    raise exception 'goal93_catalog_grants_invalid';
  end if;

  if not (
    select c.relrowsecurity
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'template_verticals'
  )
  or not (
    select c.relrowsecurity
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'template_required_modules'
  ) then
    raise exception 'goal93_catalog_rls_missing';
  end if;
end
$$;

-- Native FK failures.
do $$
begin
  begin
    insert into public.template_verticals (template_key, vertical_key)
    values ('ateljevinter', 'goal93-unknown');
    raise exception 'unknown_vertical_succeeded';
  exception when foreign_key_violation then null;
  end;

  begin
    insert into public.template_required_modules (template_key, module_key)
    values ('ateljevinter', 'goal93-unknown');
    raise exception 'unknown_module_succeeded';
  exception when foreign_key_violation then null;
  end;

  begin
    update public.templates
       set replacement_key = 'goal93-unknown'
     where key = 'ateljevinter';
    raise exception 'unknown_replacement_succeeded';
  exception when foreign_key_violation or check_violation then null;
  end;
end
$$;

-- Status/selectability and cross-row replacement invariants.
insert into public.templates (
  key, name, tags, tokens, sections, status, contract_version, owner, selectable
) values (
  'goal93-active-target',
  'Goal 93 active target',
  '{"scope":"test"}',
  '{"color":{},"font":{"heading":"Test","body":"Test"},"layout":{"radius":"0px","navHeight":{"desktop":"1px","mobile":"1px"}},"caps":{}}',
  '["home"]',
  'active',
  1,
  'corevo',
  false
);

do $$
begin
  begin
    insert into public.templates (
      key, name, status, contract_version, owner, selectable
    ) values (
      'goal93-selectable-draft', 'Invalid selectable draft', 'draft', 1, 'corevo', true
    );
    raise exception 'selectable_draft_succeeded';
  exception when check_violation then null;
  end;

  begin
    insert into public.templates (
      key, name, status, contract_version, owner, selectable
    ) values (
      'goal93-deprecated-without-target', 'Invalid deprecated', 'deprecated', 1, 'corevo', false
    );
    raise exception 'deprecated_without_replacement_succeeded';
  exception when check_violation then null;
  end;

  begin
    update public.templates
       set status = 'deprecated',
           replacement_key = 'goal93-active-target'
     where key = 'goal93-active-target';
    raise exception 'self_replacement_succeeded';
  exception when check_violation then null;
  end;
end
$$;

insert into public.templates (
  key, name, status, contract_version, owner, selectable
) values (
  'goal93-archived-target', 'Goal 93 archived target', 'archived', 1, 'corevo', false
);

do $$
begin
  begin
    insert into public.templates (
      key, name, status, contract_version, owner, selectable, replacement_key
    ) values (
      'goal93-invalid-deprecated',
      'Goal 93 invalid deprecated',
      'deprecated',
      1,
      'corevo',
      false,
      'goal93-archived-target'
    );
    raise exception 'deprecated_to_inactive_succeeded';
  exception when check_violation then null;
  end;
end
$$;

insert into public.templates (
  key, name, status, contract_version, owner, selectable, replacement_key
) values (
  'goal93-readable-deprecated',
  'Goal 93 readable deprecated',
  'deprecated',
  1,
  'corevo',
  false,
  'goal93-active-target'
);

do $$
begin
  begin
    update public.templates
       set status = 'archived'
     where key = 'goal93-active-target';
    raise exception 'referenced_target_archived';
  exception when check_violation then null;
  end;
end
$$;

-- Deprecated remains publicly readable, while catalog relations remain read-only.
set local role anon;

do $$
begin
  if not exists (
    select 1
      from public.templates
     where key = 'goal93-readable-deprecated'
  ) then
    raise exception 'deprecated_not_readable';
  end if;

  begin
    insert into public.template_verticals (template_key, vertical_key)
    values ('ateljevinter', 'florist');
    raise exception 'anon_catalog_write_succeeded';
  exception when insufficient_privilege then null;
  end;
end
$$;

reset role;

select 'goal93_catalog_projection_ok' as result;
rollback;
