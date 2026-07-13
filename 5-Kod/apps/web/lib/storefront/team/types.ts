// Team — SHARED types (goal-64).
//
// PURA typer, INGEN I/O, INGEN 'server-only' (samma kontrakt som blogg/galleri):
// mall-vyerna (ThemeTeamViewProps) importerar TeamMember härifrån och kan hamna i en
// klient-bundle.
//
// TEAMET ÄR INGEN MODUL. Det är kundens FOLK. De tre salong-mallarna har `team` som
// egen nav-punkt, men det finns ingen "team-modul" att slå av och på — personalen
// finns redan i `staff`, och 0057 gav raden sina presentationsfält (short_name,
// specialties, bio). Därför: ingen modul-gate på /team. Sanningen är i stället
// staff.active && staff.show_on_site — kundens egen av/på per person.

/** En medarbetare som visas publikt — client-safe vy av en staff-rad (0001 + 0049 +
 *  0057). Alla presentationsfält är NULLBARA: render-on-present. Ett tomt bio-fält
 *  renderas INTE — vi hittar aldrig på en biografi åt kundens personal. */
export type TeamMember = {
  id: string
  /** Fullständigt visningsnamn (staff.title). Utan namn finns ingen medarbetare att visa. */
  name: string
  /** "Vera" — kortnamnet mallarnas teamkort visar, och det bokningens förifyllnad använder. */
  shortName: string | null
  /**
   * Rollen som mallen sätter under namnet.
   *
   * AVVIKELSE, medvetet: `staff` har idag EN textkolumn för person-identiteten
   * (`staff.title`), och den bär NAMNET (så visas den i PersonalCard och i bokningens
   * barberarkort). Det finns alltså ingen separat roll-kolumn, och 0057 lade inte till
   * någon. Vi hittar därför INTE på en roll: `title` speglar staff.title, och den delade
   * sektionen renderar den bara när den skiljer sig från `name` (dvs. aldrig idag).
   * Fältet står kvar i kontraktet så en mall som vill särskilja namn och roll kan göra
   * det den dag kolumnen finns — utan att kontraktet måste ändras igen.
   */
  title: string | null
  /** "Korta klipp · Siluetter · Konsultation" — fri text, mallen bryter den. */
  specialties: string | null
  bio: string | null
  /** staff.avatar_url (R2). null = mallen ritar sin egen initial-/silhuett-fallback. */
  imageUrl: string | null
}
