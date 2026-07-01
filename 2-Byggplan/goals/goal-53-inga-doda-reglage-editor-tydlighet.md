# GOAL-53 — Inga döda reglage + editor-tydlighet (Zivars UX-krav)

**Beställning (Zivar 2026-07-01):** "Alla knappar ska vara riktiga, testade, fullt fungerande. Jättebra editor-sidor där det är superlätt att veta vad jag ändrar. Inget låst. Tydliga UI för super-admin — sätta upp en sida utan bråk."

## Läget (oberoende knapp-audit 2026-07-01, hela back-office)

**Inga oärliga döda knappar finns.** Ärlighetspassen har redan städat: inga tomma onClick, inga "kommer snart"-toasts på fejkmutationer, inga länkar till saknade sidor, inga formulär utan action. Alla interaktiva kontroller i super-admin, kund-admin och personal landar i riktiga server-actions.

Det som återstår är **5 medvetet inaktiva reglage** (alla disablade/förklarade i UI:t — de ljuger inte, men de GÖR inget). Att göra dem riktiga = denna goals arbetslista:

| # | Var | Vad | Storlek |
|---|---|---|---|
| 1 | `app/(platform)/installningar/Settings.tsx:40` | "Audit-guard"-switch: hårdkodad ON (speglar kod-invariant). Antingen gör togglingsbar på riktigt eller rendera som statusrad, inte switch | S |
| 2 | `components/platform/DomainPanel.tsx:36` | Egen-domän-formulär bakom `DOMAIN_PROVISIONING_ENABLED` (off). Riktiga `DomainManager` finns wirad — aktivering är drift (CF-provisionering), inte kod | L (drift) |
| 3 | `components/admin/SettingsForm.tsx:202` | "Drop-in synligt"-toggle disabled "Kommer snart". Kräver: settings-nyckel + `saveSettings`-upptining + storefront-läsning | M |
| 4 | `components/kund/AccountPrivacy.tsx:79` | Namn-läge (Fullt/Förnamn/Initialer) renderas som spans. Kolumner finns (`display_name`/`name_hidden`); saknar kund-scoped action + RLS-write-väg | M |
| 5 | `components/kund/AccountPrivacy.tsx:140` | "Spara mina uppgifter"-switch statisk. Kräver consent-kolumn + action | M |

## Editor-tydlighet (andra halvan av beställningen)

Krav på sajtbyggaren + onboarding-studion, båda ytorna:
- **Alltid uppenbart VAD som redigeras:** varje fält märkt med var på sidan det syns (Hero/Om oss/Sidfot …) — manifesten bär redan svenska etiketter per region; verifiera att grupperingen läses som sidans ordning, inte fälttyp-ordning.
- **Bildbyte ska vara trivialt:** klicka bild → välj ur mediabiblioteket/ladda upp → se den i preview direkt. (MediaLibrary + preview finns; gapet är ev. klick-i-preview, se goal-48-resten "klicka-redigera-i-preview-overlay".)
- **Inget tema låst:** ✅ KLART 2026-07-01 — alla 5 teman har manifest, salvia-Callouten borta.
- **Ny mall = lägg till och den blir valbar:** riktningen är goal-52 (native sektions-kit + look-som-config). Denna goal bygger INTE det, men får inte bygga något som motverkar det.

## Klart när
- Reglage 1, 3, 4, 5 är riktiga (2 = driftbeslut, dokumenteras).
- Zivar kan i onboarding + editor peka på varje fält och säga vad det ändrar utan att gissa.
- Verifierat i UI av någon annan än byggaren (oberoende verify, 0 FAIL-princip).
