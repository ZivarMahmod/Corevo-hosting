-- 0053: widen media_assets.source check — goal-54 A9.
-- Branding-/sajtbyggar-uploads (logo, hero, galleri, team, staff, about/closing)
-- ska numera även registreras i media_assets så de syns i kundens Bildbibliotek.
-- De taggas source='branding' resp. 'sajtbyggare'; 0026-checken tillät bara
-- upload|library|stock och skulle annars tyst blockera varje sådan insert.

alter table public.media_assets drop constraint if exists media_assets_source_check;
alter table public.media_assets add constraint media_assets_source_check
  check (source in ('upload', 'library', 'stock', 'branding', 'sajtbyggare'));
