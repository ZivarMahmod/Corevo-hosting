# 04 — Inloggning, kontaktuppgifter och notiser

## Beslut

Corevo ska undvika SMS som standardkostnad. Kund-admin använder e-post och lösenord, behåller användaren inloggad genom en beständig session och kan senare erbjuda TOTP-baserad tvåfaktor. E-post är primär notifieringskanal. SMS blir ett senare betalt tillval.

## Inloggningsupplevelse

### Normal resa

1. Användaren anger e-post och lösenord.
2. Corevo skapar en säker session.
3. Användaren kan stänga och senare öppna appen utan att logga in igen så länge sessionen fortfarande är giltig.
4. Navigation mellan admin-sidor kräver aldrig ny inloggning.
5. Utgången session leder tillbaka till login och bevarar en säker intern returväg.

### Tvåfaktor

- TOTP/autentiseringsapp är förstahandsvalet.
- SMS används inte som standard-2FA.
- Ägare kan uppmanas aktivera 2FA.
- Återställningskoder visas en gång och ska kunna ersättas.
- Högriskändringar kan kräva ny autentisering.

### Sessionskontroll

Under Konto och säkerhet ska användaren senare kunna:

- se aktiva sessioner/enheter;
- se ungefärlig senaste aktivitet;
- logga ut en annan enhet;
- logga ut alla andra enheter;
- få tydlig information efter lösenordsbyte eller misstänkt aktivitet.

## Kontaktuppgifter per bokningskälla

### Publik självbokning

Minst en kontaktväg krävs:

- giltig e-post, eller
- giltigt telefonnummer.

Båda får anges. Kunden ska se vilken kanal som används för bekräftelse och eventuell påminnelse.

Om verksamheten inte har SMS aktiverat och kunden endast anger telefonnummer ska UI uttryckligen säga att ingen automatisk SMS-bekräftelse skickas. Bokningen får inte antyda motsatsen.

### Bokning skapad av personal

- Kundnamn är obligatoriskt.
- E-post och telefon är frivilliga.
- En kund som står på plats ska kunna bokas utan att tvingas lämna kontaktuppgifter.
- Notisvalet visas före spara och endast möjliga kanaler är valbara.

### Drop-in

Drop-in kan skapas utan kontaktuppgifter. Om kunden vill ha digital historik eller kvitto ska kontakt/kund kunna kopplas utan att göra grundflödet långsamt.

## Kanalpolicy

### Första fasen

| Kontaktdata | Bekräftelse | Påminnelse |
|---|---|---|
| endast e-post | e-post | e-post om aktiv |
| e-post + telefon | e-post | e-post om aktiv |
| endast telefon | ingen automatisk kanal | ingen automatisk kanal |
| ingen kontakt, personalbokning | ingen | ingen |

### Senare när SMS-tillvalet är aktivt

| Kontaktdata | Rekommenderad standard | Möjligt val |
|---|---|---|
| endast e-post | e-postbekräftelse | e-postpåminnelse |
| endast telefon | SMS enligt verksamhetens policy | SMS-bekräftelse och/eller påminnelse |
| båda | e-postbekräftelse | SMS-påminnelse om verksamheten valt det |
| ingen kontakt, personalbokning | inget | inget |

Detta är standarder, inte dolda tvång. Personalen kan välja kanal per bokning inom verksamhetens policy.

## Notisval i bokningsdrawern

Före spara visas exempelvis:

```text
Meddelande till kunden

○ Skicka inget
○ E-post till anna@example.se
○ SMS till 070… · debiteras
○ E-post + SMS · debiteras
```

Val som saknar kontaktuppgift eller aktiv transport är avstängda med förklaring.

Systemet kan föreslå:

- **bokning på plats:** Skicka inget;
- **bokning senare samma dag:** fråga om en bekräftelse ska skickas;
- **bokning längre fram:** e-postbekräftelse och verksamhetens påminnelseregel;
- **ombokning:** visa ny tid och vald kanal;
- **avbokning:** visa om kunden meddelas innan avbokningen bekräftas.

## Notifieringens status är separat från bokningens status

En giltig bokning får inte falla bort för att ett meddelande misslyckas. Efter spara ska UI kunna visa exempelvis:

- Bokning skapad · E-post skickad
- Bokning skapad · E-post kunde inte skickas
- Bokning skapad · Inget meddelande valt
- Bokning skapad · SMS väntar på leverans

Manuell omsändning ska vara idempotent eller tydligt varna för dubblett.

## Senare SMS-tillval

SMS ska införas först när följande finns:

- riktig leverantörstransport;
- leveranswebhook och statuslogg;
- idempotensskydd;
- E.164-normalisering;
- beräkning per SMS-del;
- kostnadsbokföring per tenant;
- budget/tak;
- fakturaunderlag;
- tydlig hantering av långa meddelanden;
- test utan riktiga mottagare;
- dokumenterad fallback när saldo/transport saknas.

### Val per verksamhet

- av;
- endast kundpåminnelse;
- bekräftelse + påminnelse;
- ombokning/avbokning;
- personalnotis vid ny bokning;
- personalnotis endast för sin egen resurs;
- kostnadstak per månad.

### Kostnadsprincip

- Grundabonnemanget innehåller inte obegränsade SMS.
- Kunden bär den rörliga kostnaden.
- Fakturering baseras på SMS-delar, inte bara logiska meddelanden.
- UI visar uppskattning och faktisk användning.
- Exakt påslag/pris beslutas i faktureringsspåret, inte här.

## Integritet och copy

- Notistext ska innehålla minsta nödvändiga information.
- Interna anteckningar får aldrig hamna i kundmeddelanden.
- UI ska märka kundsynligt respektive internt innehåll.
- Loggar ska undvika att exponera fullständiga kontaktuppgifter i onödan.
- Användaren ska förstå vad som skickas, till vem och varför.
