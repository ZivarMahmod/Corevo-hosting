-- 0050 — PURGE av vendor-mallraderna (JOURNAL: kördes ad-hoc via db query 2026-07-11,
-- Zivars order: "det ska inte finnas skräp"). De 16 icke-renderbara vendor-raderna
-- från mall-importen (alotan-bb, baker, restaurantly, foody, sneat, …) raderades ur
-- templates (+ ev. template_slots). Kvar = de 5 riktiga byggda temana
-- (salvia/leander/zigge/linnea/edit) taggade per bransch. Nya teman (FAS 4,
-- tema-fabriken) registreras med riktiga rader när de faktiskt är byggda.
begin;
delete from public.template_slots
  where template_key not in ('salvia','leander','zigge','linnea','edit','freshcut');
delete from public.templates
  where key not in ('salvia','leander','zigge','linnea','edit','freshcut');
commit;
