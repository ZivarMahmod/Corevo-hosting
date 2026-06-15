# ROADMAP — Bryt loopen: gör multi-bransch verkligt
Skapad 2026-06-15 (Cowork, Zivar + Nörden). Detta är ingångs-roadmapen tills Fas A–C är klara. Ersätter "kör schema och bygg vidare"-läget.

## Varför vi loopade (lärt — får ej upprepas)
- Massa autonoma körningar byggde **kod** + applicerade **DB-skelett**, men **0 deployat + 0 aktiva kunder** → allt blev osynligt.
- Schemat fyrade i tomgång var 30:e min *efter* att det flaggat "KLAR" → byggde djupare (audit/test/terminologi) på en grund ingen använde = diminishing returns.
- Git-indexet korrupt → "pusha till main" hände aldrig → ännu mer osynligt.
- Nettoeffekt: enormt bygge, nära noll live-yta. Det känns som en loop för att det *var* en — bygge bakom ostängda dörrar.

## Regeln som bryter loopen (lag — gäller alla framtida pass)
1. **Deploya + bevisa innan vi bygger mer.** Inget nytt bygg-spår startar förrän det förra är LIVE och sett på en riktig yta/kund.
2. **En fas i taget. KLART = deployat + verifierat live** — aldrig "kod committad".
3. **Schema bara för avgränsat jobb med kill-villkor.** Klart-rad högst i loggen, Zivar stänger schemat när jobbet är live. Aldrig evig loop.
4. **Branch = config (5 fält i `verticals`). Arketyp = bygge.** Vi bygger mönster, inte 10 brancher.

## Faser (ordning LÅST av Zivar 2026-06-15: A → B → C → D)

### Fas A — Gör det byggda verkligt  ·  `goal-30`
Fixa korrupt git → commit + push `main` → bygg + deploy.
**KLART =** worker live · FreshCut/POS orörda · admin-ytor + onboarding-wizard syns bakom modul-grind.

### Fas B — Bevisa multi-bransch (1 riktig icke-frisör-kund)
Onboarda en riktig kund i annan bransch via wizarden (bransch + tema + moduler), aktivera moduler off→draft→live, klicka igenom boka-flödet.
**KLART =** en icke-frisör-storefront live + admin som talar kundens språk. Då är "multi-bransch" bevisat, inte teoretiskt.
- Öppen fråga (Zivar): vilken bransch bevisar vi med? Reko = **restaurang** (mest olik frisör → starkast bevis; bord-objekt).

### Fas C — Stabilisera
2 kända buggar (savePlatformBranding-clobber · personal-"Idag"-krasch) · R2-toggle-koll (bild-URL:er) · städa testdata på prod.
**KLART =** 0 kända blockerare före bredd.

### Fas D — Bredd (först EFTER A–C)
- **D1 Mall-konvertering:** de fria mallarna → tokens + sektioner → valbara teman (idag bara 5). Se licens nedan.
- **D2 Modul-djup:** shop/offert/blogg/lojalitet/presentkort får samma djup som booking (idag är bara booking djup).
- **D3 Arketyp-utbyggnad:** B (bord/resurs) → C (handel) → D (förening).

## Arketyp-modell (10+ brancher = 4 mönster)
| Arketyp | Bokar | Brancher | Kostnad |
|---|---|---|---|
| A · tidsbokning hos person | tid + person | frisör, barber, nagel, klinik, mekaniker | config — funkar på dagens motor |
| B · resurs/objekt | objekt, ej person | restaurang (bord), verkstad (plats), uthyrning | objekt-bevis (datamodell finns) |
| C · handel/shop-först | produkter | florist, små butiker, presentbutik | modul-djup (shop grund idag) |
| D · förening/medlem | medlem/möte/avgift | samfällighet, BRF | ny modul-familj — eget beslut |
Ny branch i ett färdigt mönster = 5 fält i `verticals`, noll kod. Ny arketyp = riktigt bygge.

## Mallar — licens-sanning (rättad 2026-06-15)
Av 110 katalogiserade i `4-Dokument-Underlag/03-template-katalog/`:
- **107 fria att använda:** 102 `kräver-kredit` (gratis, behåll footer-/attributionsrad — CC BY / colorlib / themewagon / htmlcodex) + 5 `fri` (MIT/Apache, inget krav).
- **2 kräver köp** (51 hotelier, brber-master) → skippa.
- **1 okänd** (razor-master) → granska manuellt.
→ Konvertering är **inte** licens-blockerad. Vid D1: börja med de 5 MIT (0 footer-krav), behåll attributionsrad för resten. Inget till `02-valda/` utan att licensraden stämmer.

## Nuläge (verifierat mot prod 2026-06-15)
- **5 brancher** live i DB: frisör, barbershop, nagelstudio, restaurang, generell (var sin default-mall + terminologi + default-moduler).
- **7 moduler** registrerade: booking, shop, offert, blogg, lojalitet, presentkort, media_library. Livscykel per kund i `tenant_modules`: off→draft→live→paused.
- **27 mall-rader** i DB (5 har riktiga skins: salvia/leander/zigge/linnea/edit; bara salvia komplett med slots).
- **0 aktiva kunder** (1 raderad anchor). Migrationer 0026–0037 applicerade. Väntande SQL = 0.

## Schema-policy (loop-skydd)
Ett schema = ett avgränsat autonomt jobb med (a) tydligt klart-villkor, (b) kill-rad högst i loggen, (c) Zivar stänger det när jobbet är live. **Inget schema startas denna session — först när Zivar säger kör, och bara mot en låst fas-plan.**

## Låsta beslut (denna session)
- Ordning A→B→C→D.
- Deploy via `C:\tmp\kod` (ö-path kraschar opennext).
- Build-once / branch = config, aldrig hårdkodat per kund.
- Schema rörs ej förrän en fas-plan är låst + Zivar säger kör.
