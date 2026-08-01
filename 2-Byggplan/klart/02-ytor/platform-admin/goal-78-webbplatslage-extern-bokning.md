# Goal 78 — Webbplatsläge med extern bokning

**Status:** Lokalt verifierad och låst 2026-07-23. Produktion är orörd.

## Mål

Corevo ska kunna leverera en riktig webbplats och kundadmin även när kunden inte
använder Corevos bokningsmotor. Kunden kan då ange en extern HTTPS-länk, exempelvis
Bokadirekt, och webbplatsens befintliga bokningsknappar öppnar den länken.

Lösningen ska vara generell för alla branscher och mallar. FreshCut är första
acceptansfallet men får inte hårdkodas i motorn.

## Kontrakt

- Webbplatsläge uttrycks av en explicit `tenant_modules`-rad:
  `module_key = booking`, `state = off`.
- Saknad bokningsrad behåller dagens säkra standard; den betyder inte webbplatsläge.
- Extern bokningslänk sparas i befintlig
  `tenant_settings.settings.booking.external_url`.
- Bara `https://` accepteras. Tomt värde betyder ingen extern länk.
- Corevo-bokning `live` vinner alltid. En sparad extern länk ignoreras då.
- Bara ett explicit `booking=off` får använda den externa länken i delade
  boknings-CTA:er.
- `draft`, okänt tillstånd och läsfel förblir inerta även om en extern länk
  redan är sparad. De får aldrig falla öppet till extern bokning.
- `paused` ligger kvar i Corevo och använder aldrig den externa länken.
- `booking=off` utan extern länk behåller dagens inaktiva knapp.
- Kundadmin, Sida-redigering och andra köpta moduler finns kvar när bokning är av.
- Ingen ny tabell eller produktionsdeploy ingår.
- Den publika tabellpolicyn visar avsiktligt bara `live/paused`. Därför används
  migration `0129_public_module_state_read.sql`: en smal
  `security definer`-funktion som endast returnerar `module_key` + `state` för
  aktiva tenants. Den är körd och verifierad på Supabase-previewbranchen
  `localhost-acceptance`, aldrig i produktion.

## Acceptans

- Skapa/ändra en previewkund till webbplatsläge med extern bokningslänk.
- Storefrontens boknings-CTA öppnar den externa länken i ny flik.
- `/boka` förblir stängd när Corevo-bokning är av.
- När bokning åter är `live` använder samma CTA Corevos bokningsflöde.
- Ogiltig eller icke-HTTPS-länk nekas server-side.
- Relevanta tester, typecheck, lint och en lokal browserkontroll är gröna.

## Verifieringsbevis

- 24/24 riktade tester gröna.
- Typecheck och riktad lint gröna.
- Ogiltig `http://`-länk nekades server-side i superadmin.
- Browsermatrisen verifierade att `paused` gav Corevo-länkar och noll externa
  länkar, medan `draft` gav noll länkar och åtta inaktiva CTA:er.
- Med `booking=off` gav storefronten 8 externa bokningslänkar i direkt
  browserprov, alla med `target="_blank"` och `rel="noopener noreferrer"`;
  inga inaktiva bokningsknappar återstod.
- Samma publika localhost-storefront gav HTTP 200, nio externa href i server-HTML
  och noll `href="/boka"`. `/boka` gav HTTP 404.
- Vid byte till `booking=live` försvann alla externa länkar och Corevos riktiga
  femstegsdialog öppnades. Acceptanstenanten återställdes därefter till
  webbplatsläge med extern länk.
