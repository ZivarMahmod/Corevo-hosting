-- ============================================================================
-- 0040 ROLLBACK — återställ salvias slot-läge före reconcile (option 4)
--
-- Reverserar 0040_salvia_slots_canonical.sql: tar bort de 10 kanoniska slottarna och
-- remappar tenant-innehållet tillbaka (hero.image → hero.bg). Den GENERISKA modellen
-- (19 slots) återställs INTE rad-för-rad här — dess kanoniska källa är den out-of-band
-- importen 4-Dokument-Underlag/03-template-katalog/templates-import.sql (salvia-
-- sektionen). Vill man fullt återgå: kör den importens salvia-del efter denna fil.
-- (Nödåtgärd — den generiska modellen retireras med avsikt; build-once-undantaget är
--  auktoriserat: det var out-of-band-data, inte byggd historik.)
-- ============================================================================

begin;

-- 1. Remappa tenant-innehåll tillbaka till den generiska nyckeln.
update public.content_slots
   set slot_key = 'hero.bg', updated_at = now()
 where template_key = 'salvia' and slot_key = 'hero.image';

-- 2. Ta bort de kanoniska deklarationerna (salvia har då 0 slots tills importen körs).
delete from public.template_slots where template_key = 'salvia';

commit;
