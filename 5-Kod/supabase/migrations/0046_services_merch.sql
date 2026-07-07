-- 0046 — Services merchandising: rabatt/kampanj-badge, bild, manuell ordning.
-- description + category finns redan sedan 0001; detta lägger bara till säljytan.
-- Additivt + idempotent (add column if not exists) — bryter ingen befintlig rad,
-- ärver services RLS (0002) + public-read (0004) automatiskt (kolumner följer med
-- select('*')). staff_services (0001) styr redan vilka i personalen som kan utföra
-- en tjänst — ingen ny tabell behövs för det.

alter table services
  add column if not exists sale_price_cents int
    check (sale_price_cents is null or sale_price_cents >= 0);
alter table services add column if not exists badge text;
alter table services add column if not exists image_url text;
alter table services
  add column if not exists sort_order int not null default 0;

comment on column services.sale_price_cents is
  'Rabattpris i öre; null = ordinarie pris (price_cents). Storefront visar ord.pris överstruket + reapris.';
comment on column services.badge is
  'Fri promo-etikett (t.ex. Populär, Nyhet, Kampanj); null = ingen badge.';
comment on column services.image_url is
  'Tjänstebild (R2 public url); null = ingen bild.';
comment on column services.sort_order is
  'Manuell sorteringsordning (lägre först); 0 = default, faller tillbaka på pris.';
