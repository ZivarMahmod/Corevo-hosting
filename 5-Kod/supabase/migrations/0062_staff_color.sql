-- ▸ FIL: 0062_staff_color.sql
-- ▸ (döp SQL-Editor-fliken till detta — Supabase kallar den annars "Untitled query")

-- 0062 — goal-67: färg per anställd.
--
-- Kalendern är systemets hjärta och den viktigaste frågan i en full dag är "vems
-- bokning är det?". Wavy svarar med färg. Vi gör samma sak — men färgen är ALDRIG
-- ensam bärare av information (status har fortfarande ikon + text), så en färgblind
-- användare tappar ingenting.
--
-- NULL = ingen vald färg. Appen härleder då en deterministisk färg ur staff.id
-- (lib/admin/staff-colors.ts) så kalendern har färg från dag ett, utan backfill och
-- utan att någon måste välja. Väljer ägaren en färg vinner den.
--
-- Idempotent — dubbelkörning är ofarlig (repot för ingen migrationshistorik, schemat
-- är sanningen; se kommentaren i 0047).

alter table public.staff
  add column if not exists color text;

-- Vakt: bara en hex-färg får in. Utan detta hamnar 'rgb(…)', 'red' och
-- 'javascript:…' i en style-attribut-position i klienten.
-- conname ensamt räcker INTE: constraint-namn är unika per tabell, inte globalt. En
-- constraint med samma namn på en ANNAN tabell hade fått den här att tro att jobbet
-- var gjort — och staff hade stått utan vakt. (Codex-granskning.)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'staff_color_hex'
      and conrelid = 'public.staff'::regclass
  ) then
    alter table public.staff
      add constraint staff_color_hex
      check (color is null or color ~ '^#[0-9a-fA-F]{6}$');
  end if;
end $$;

comment on column public.staff.color is
  'goal-67: kalenderfärg (#rrggbb). NULL → appen härleder deterministisk färg ur id.';
