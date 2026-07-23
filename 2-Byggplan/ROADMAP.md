# ROADMAP — Corevo

Detta är projektets enda aktuella byggordning. Produktion lämnas orörd tills de
lokala byggdelarna har accepterats tillsammans.

## Låst lokalt

1. **Goal-74 — PIN och kanalval**
   Fyra siffror, tre försök samt SMS/mejl-policy är byggt. Driftcanary och
   produktionsmigration är parkerade.
2. **Goal-75 — kundportal, säkerhet och PWA**
   Portalflödena är lokalt låsta mot `localhost-acceptance`. Host/HTTPS/deploy är
   parkerat.
3. **Goal-76 — provisionering och publicering**
   Nya kunder stannar under konfiguration. Databasen äger readiness och atomisk
   publicering; kanonisk host är `<slug>.boka.corevo.se`. Previewruntime är grön.
   Den gemensamma skrivande localhostbrowserkedjan återstår.

## Nästa byggordning

4. **Goal-77 — bokningsmotorns fyra lägen**
   Lås verkligt beteende för de fyra lägena genom platsval, djuplänkar och
   publicerad/pausad modul. Testa minsta representativa matris, inte varje
   kosmetisk kombination.
5. **Personaladminacceptans**
   Lås roller, platsbehörighet och de viktigaste liveflödena utan ny redesign.
6. **Gemensam localhostacceptans**
   Starta samma kodmapp uttryckligen mot Supabase-previewbranchen och kör
   Goal-74–77:s korta användarkedjor.
7. **Samlad release**
   Produktionsmigrationer, host/HTTPS, deploy, domänsmoke och riktiga canaries
   görs först efter Zivars localhostgodkännande.

## Regler

- En goal i taget: beslut → test → kod → verifiering → lokal låsning.
- Goals flyttas till `klart/` först efter det livebevis som deras acceptans kräver.
- `corevo.se`-roten är POS-/plattformsyta; tenantstorefront använder
  `*.boka.corevo.se`.
- Ingen ny parallell motor, kö eller statusmodell när en befintlig ägare finns.
