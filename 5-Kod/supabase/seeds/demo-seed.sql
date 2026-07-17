-- DEMO — provisionerar en isolerad testtenant (Claudes lekyta + Zivars visningskund).
-- Speglar freshcut-seed.sql exakt men under slug 'demo' → demo.corevo.se. Multi-tenant
-- + RLS gör DEMO helt isolerad från freshcut/florist/zentum: mutationer mot DEMO rör
-- ALDRIG en riktig kunds data. Idempotent (guard mot dubbelkörning). Ett transaktionellt
-- do-block → vid fel rullas ALLT tillbaka, ingen halv-tenant.
-- Innehåll = FreshCuts kundbild (tjänster/bilder/adress) som "bra start" per Zivar.
-- Login provisioneras separat (auth-user), inte här.
do $$
declare tid uuid;
begin
  if exists (select 1 from tenants where slug = 'demo') then
    raise notice 'DEMO finns redan — hoppar över seed.';
    return;
  end if;

  insert into tenants (slug, name, status, plan, city)
  values ('demo', 'Demo', 'active', 'standard', 'Linköping')
  returning id into tid;

  insert into tenant_settings (tenant_id, payment_mode, billing_model, branding, settings)
  values (
    tid,
    'on_site',
    'per_booking',
    $j${
      "hero_images": [
        "https://basekit-product.s3-eu-west-1.amazonaws.com/Image+Sets/localBusiness/barber/default/barber_image-4.jpg"
      ],
      "gallery_images": [
        "https://files.builder.misssite.com/34/48/34485c07-5c42-4885-a16b-1af9cb0642c0.png",
        "https://files.builder.misssite.com/70/62/70620da8-4855-4366-b606-b6dd0af61070.png",
        "https://files.builder.misssite.com/21/5b/215bb75f-000e-49a0-bd9c-39bb82810440.png",
        "https://files.builder.misssite.com/e0/a6/e0a602fa-ac66-4d84-9bb8-bbd4f478b263.png"
      ]
    }$j$::jsonb,
    $j${
      "theme": "freshcut",
      "booking": { "variant": "wizard" },
      "contact": { "email": "demo@corevo.se", "phone": "073 876 71 44" }
    }$j$::jsonb
  );

  insert into locations (tenant_id, name, address, timezone, is_primary)
  values (tid, 'Demo', 'Bokhållaregatan 2, 582 24 Linköping', 'Europe/Stockholm', true);

  insert into roles (tenant_id, name, level)
  values (tid, 'salon_admin', 6);

  insert into services (tenant_id, name, duration_min, price_cents) values
    (tid, 'Herrklippning', 30, 36900),
    (tid, 'Herrklippning Student', 30, 32900),
    (tid, 'Herrklippning, långt skägg, varm handduk', 30, 45900),
    (tid, 'Herrklippning kort skägg, varm handduk', 30, 41900),
    (tid, 'Pensionärsklippning', 30, 32900),
    (tid, 'Barnklippning (upp till 8 år)', 30, 29900),
    (tid, 'Skäggtrimning', 30, 22900);

  raise notice 'DEMO seedad: tenant %', tid;
end $$;
