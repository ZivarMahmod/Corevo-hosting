# 100-TEMPLATES-TRACKER — sajtbyggare

> Durabel checklista för goal-36 (bygg + optimera alla byggbara katalog-mallar). Loopen läser denna FÖRST,
> tar nästa `TODO`/`KVAR`, kör per-mall-pipelinen (se `PILOT-UTFALL.md` → MÖNSTRET), uppdaterar raden. Idempotent.
>
> Radformat: `NN namn | bransch | status | ev. KVAR`
> status: `TODO` → `BYGGD` → `VERIFIERAD 0FAIL` → `COMMIT <sha>`
> Källa-worklist: `4-Dokument-Underlag/03-template-katalog/` (auto-katalogiserad i `KATALOG-RAPPORT.md`).

## M1 — KATALOG-MANIFEST (faktisk count, anta ALDRIG 100)
`KATALOG: 110 mallar inventerade · ~94 byggbara · ~16 skippade (skäl nedan) + ~6 icke-mall-mappar`

**Buildable-definition (denna run):** `type ∈ {storefront, landing}` + riktig `index.html` + duglig licens (`kräver-kredit`=behåll attribution, `fri`=ok) + **EJ** `admin`-dashboard + **EJ** dubblett.
Källa: `KATALOG-RAPPORT.md` (auto, 110 mallar). Count förfinas per-beröring (loopen rättar raden när den faktiskt rör mallen).

**Booking-passning (urvalskriterium, ej buildable-grind):** idag är **endast `booking`** live-vävd i `render-bridge.tsx`
(`booking-mount.tsx` = enda mount; `shop/offert/lojalitet/presentkort/blogg` finns i KNOWN_MODULES men saknar mount).
`booking-mount` = service+staff+tid (appointment/wizard, EJ bransch-medveten ännu → goal-37). Ren väv = mall med en
**native inline boknings-/appointment-`<form>`** att BYTA mot markören (aldrig uppfinna en sektion).

**Skippade (redovisade):**
- `SKIPPAD: admin-dashboard` (8): 16 star-admin2, 19 sneat, 39 materio, 76 dashmin, 77 darkpan, 85 celestialAdmin, 90 Breeze, + onumrerad `materio` (även dubblett).
- `SKIPPAD: licens kräver-köp` (2): 51 hotelier, `brber-master`.
- `FLAGGAD: okänd licens — granska` (1): `razor-master`.
- `SKIPPAD: dubblett` (2): onumrerad `carserv` (= 87 carserv), onumrerad `materio` (= 39 materio).
- `SKIPPAD: landing utan modul-passning` (löpande): t.ex. 09 training-studio (1-sida gym-landing, INGEN native boknings-form),
  rena e-handels-mallar (vill ha `shop`, ej live) — flaggas per-beröring i 116-körningen.
- **Icke-mall-mappar** (räknas ej): `00-inbox`, `01-kandidater`, `02-valda`, `screenshots`, `__pycache__`, scripts/SQL/JSON.

> Förfining: den exakta `<B>` byggbara fastställs slutgiltigt under 116-körningen (varje rad markeras VERIFIERAD/BLOCKERAD/SKIPPAD).
> Stoppvillkoret (§6) refererar `<B>`, inte 100.

## PROVA-LÄGE (Zivar 2026-06-17): kör 3 FÖRSTA byggbara, stanna + rapportera
**Urval = de 3 första byggbara mallarna i katalog-ordning med en native, ren service+tid boknings-`<form>`, skilda branscher:**
- `42 klinik` — vård (klinik) · htmlcodex
- `72 drivin` — körskola/utbildnings-tjänst (KATALOG-RAPPORT-etikett "hotell/resa" = felklassad; rättad här) · htmlcodex
- `87 carserv` — fordon/bil (bilservice) · htmlcodex

**Antagande (surfas):** "de 3 FÖRSTA byggbara" lästes genom buildable+ren-booking-fit-grinden → tidiga katalog-mallar utan
service+tid-form (farm/resa/e-handel/bygg/tech) faller bort, och de 3 första kvarvarande skilda branscherna blir 42/72/87.
**Känd begränsning:** alla 3 = htmlcodex (samma vendor-familj som restoran-piloten) → provar vertikal/booking-transfer + bygg/verify/harness-loopen,
men INTE cross-familj (colorlib/themewagon/untree skiljer strukturellt). Rekommendation: 116-körningen front-laddar colorlib+themewagon+untree-sampel tidigt.
Vill du bevisa cross-familj redan nu → byt en slot mot `haircare` (colorlib, frisör/salong, har native appointment-form).

## Klara (pilot)
| NN | namn | bransch | status | KVAR |
|---|---|---|---|---|
| 23 | restoran | restaurang | **VERIFIERAD 0FAIL (fidelity 4.13–4.63), COMMIT `c9ff7d7`** | CSS-scoping (mönster-pkt 4); resolver-wiring för 6 copy-fält (goal-37/F2) |

## PROVA-LÄGE — 3 mallar
| NN | namn | bransch | status | KVAR |
|---|---|---|---|---|
| 42 | klinik | vård/klinik | **VERIFIERAD 0FAIL (proof 20/20: 22 regioner + booking@appointment + kanon-tokens + 9/9 sektioner + render-bron round-trip), oberoende fidelity-verify PASS** | CSS-scoping (mönster-pkt 4); resolver-wiring för copy-fält (goal-37/F2) |
| 72 | drivin | körskola | **VERIFIERAD 0FAIL (proof 23/23: 21 regioner + booking@appointment + kanon-tokens + 11/11 sektioner + render-bron round-trip), oberoende fidelity-verify PASS** | CSS-scoping; resolver-wiring (goal-37/F2) |
| 87 | carserv | fordon/bil | **VERIFIERAD 0FAIL (proof 24/24: 19 regioner + booking@booking + kanon-tokens + 11/11 sektioner inkl. 2 service-block + render-bron round-trip), oberoende fidelity-verify PASS** | CSS-scoping; resolver-wiring (goal-37/F2) |

> **Hus-mönster-normaliseringar** (bekräftade inerta, matchar restoran-piloten — INTE fidelity-brott): döda/tomma länkar
> `href=""` → `href="#"`; trailing-space i `class`-attribut trimmas. Visuellt/beteendemässigt identiska; flaggas här
> så de inte "begravs" (oberoende verify noterade dem mot en strikt enumererad transform-lista).

## Att göra (resten) — TODO (släpps först på "kör 116")
Loopen enumererar från katalogen, applicerar buildable-definitionen + booking-passning, lägger en rad per mall vid första beröring.
Prioritera mallar med en LIVE Corevo-modul-vertikal (restaurang/salong/klinik) + native boknings-form först.

_Mönster, harness och fällor: se `PILOT-UTFALL.md`. Keep-tröskel ≥0.5 (domar-varians ~±0.5). Allt bakom `SAJTBYGGARE_ENABLED`; deploy = separat Zivar-OK._

---
**2026-06-18:** Oförändrad — fortsatt PROVA-LÄGE (4 mallar VERIFIERAD 0FAIL). Full ~90-grind väntar fortfarande på Zivars "kör 116". Sajtbyggare-fokus denna session låg på **goal-37 (S2-editor)**: spar-vägen (`saveSiteContent`) + edge-saneraren + overlay-modellen byggda+verifierade (se `5-Kod/docs/sajtbyggare-editor.md`). När 116-grinden släpps: editorn (goal-37) kommer redigera regionerna dessa mallar producerar — håll region-markup till det delade kontraktet.
