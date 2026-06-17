# Fakturering & intäktsmodell — Corevo

> Fångat 2026-06-16 ur Zivars kravbild (tänkte högt).

## Modellen (Zivars plan)
- **Nu:** manuell fakturering tills systemet är byggt.
- **Sen, inne i plattformen:** faktura skickas från **super-admin → salongens admin**.
- Salongen kan **skriva ut / exportera** fakturan (eget format Zivar gör).
- **Swish-QR** på fakturan, **för-ifylld** med fakturanummer + uppgifter → salongen swishar direkt; referensen (fakturanr) följer med i Swish-meddelandet **oavsett vilket nummer** betalningen kommer från.
- Salongen klickar **"jag har betalat"** → skickar en förfrågan till Zivar.
- Zivar jämför mot sin egen Swish → klickar **Godkänn** → blir **grönt hos båda** = betalt. (Semi-manuell matchning — ok för få kunder.)
- Fakturan visar **tydligt vad de betalar för** + **användning**: trafik, requests, antal besökare (räknare på deras admin).

## Pris
- **399 kr/mån, platt** — oavsett bransch/användning. Enkelt att sälja.
- Oro: att en högtrafik-kund (t.ex. florist) äter upp den fasta avgiften vs en lågtrafik-frisör.
- Lösning (Zivars): tunga grejer (bilder) ligger **utanför DB:n** så databasen inte växer → kostnaden följer inte användningen.

## Reko (Nörden)
- ✅ **Bilderna ligger REDAN i R2** (`corevo-media`), inte i Postgres. Din margin-oro är till stor del **redan löst arkitektoniskt** — DB:n växer inte av deras bilder.
- ✅ **Infra-kostnad per kund = försvinnande liten.** Din egen research: ~40 kunder ≈ 48 kr/mån på Cloudflare (≈ **1 kr/kund**), Supabase Pro räcker länge. → **399 platt = enorm marginal.** Trafik äter den inte vid den här skalan.
- 💡 **Räknaren** (besökare/requests) = Cloudflare Analytics → visa på deras admin. Dubbel nytta: kunden **ser värdet** + det motiverar fakturan.
- ⚠️ **Swish Företag** (inte privat Swish) — krävs för företagsbetalningar + bokföring. Deras API/callback kan **auto-bekräfta** betalning senare → slipper manuell matchning när volymen kommer. Behåll manuell "Godkänn"-knapp i v1, byt till auto sen.
- ⚠️ **Fakturan = bokföringsunderlag:** löpande fakturanummer + moms + org.nr. Bygg formatet rätt från start. (Stäm av detaljerna med din bokförare — jag är inte revisor.)

## Öppna frågor
- Auto-bekräfta Swish via API, eller behålla manuell Godkänn-knapp i v1? (Reko: manuell v1, auto sen.)
- Vad ingår i 399 (alla moduler? något tak?) + ev. framtida nivåer.
- Moms på SaaS (sannolikt 25% — stäm av) ska synas på fakturan.
