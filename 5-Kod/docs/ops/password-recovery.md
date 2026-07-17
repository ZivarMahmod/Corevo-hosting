# Lösenordsåterställning — driftkrav

Kodflödet finns på alla inloggningsdörrar:

- `/glomt-losenord` begär ett Supabase recovery-mejl och ger alltid samma svar
  för att inte avslöja om ett konto finns.
- `/aterstall-losenord` accepterar endast en recovery-session, låter användaren
  välja ett nytt lösenord och loggar sedan ut sessionen.
- Redirecten byggs från webbläsarens verkliga origin, inte en vidarebefordrad
  Host-header.

## Supabase-konfiguration före produktionstest

Lägg recovery-rutten i **Auth → URL Configuration → Redirect URLs** för
varje aktiv inloggningsorigin:

- `https://booking.corevo.se/aterstall-losenord`
- `https://superbooking.corevo.se/aterstall-losenord`
- `https://minbooking.corevo.se/aterstall-losenord` så länge legacy-dörren finns
- varje tenant-/egen domän där kundkonton tillåts
- motsvarande preview-URL endast i separat stagingprojekt

Använd inte en obegränsad produktions-wildcard om en explicit origin kan
registreras. Kontrollera även Supabases rate-limit för recovery-mejl och att
mejlmallen pekar på den genererade `ConfirmationURL`.

## Smoke-test

1. Begär reset för ett riktigt admin-, personal- och kundkonto.
2. Begär reset för en okänd adress; UI-svaret ska vara identiskt.
3. Öppna länken på samma dörr, byt lösenord och verifiera att sessionen loggas ut.
4. Verifiera att gamla lösenordet nekas och det nya fungerar på rätt dörr.
5. Återanvänd och låt länken gå ut; båda ska ge ett kontrollerat ogiltigt läge.
6. Kontrollera att recovery-token inte ligger kvar i adressfält eller historik.

Mejlleverans, SPF/DKIM/bounce och redirect-listan är driftgrindar; kodens tester
kan inte ensamma bevisa dem.
