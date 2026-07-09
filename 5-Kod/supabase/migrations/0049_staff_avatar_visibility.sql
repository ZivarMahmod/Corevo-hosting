-- 0049 — Barberar-foto + synlighet på sajten (design-paketet "Frisörbokningsformulär
-- redesign" Assets-steget + Zivars order 2026-07-09: "när man lägger in en barberare
-- som ska kunna bokas ska den komma in på sidan; under Redigera sidan kunna ändra
-- bild och klicka av så en inte syns; utan bild → standard-silhuett").
--
--   avatar_url    — R2-bild via befintliga media-pipelinen; NULL = placeholder/initialer.
--   show_on_site  — styr ENDAST "Våra barberare"-sektionen på publika sajten;
--                   bokningsbarheten styrs som förut av staff.active.

alter table public.staff add column if not exists avatar_url text;
alter table public.staff add column if not exists show_on_site boolean not null default true;
