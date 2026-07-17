# JWT Signing Keys + getClaims (plan 011)

Status 2026-07-17: **asymmetriska signeringsnycklar AKTIVA** i Supabase-projektet
(Dashboard → Project Settings → JWT Keys): CURRENT KEY = ECC (P-256), legacy
HS256 ligger kvar som "previously used" tills gamla tokens löpt ut.

## Vad koden gör

Auth-grinden och DAL:en verifierar sessionen med `supabase.auth.getClaims()` i
stället för `getUser()`:

- `lib/supabase/middleware.ts` — grinden (inloggad?) + husets ENDA refresh-punkt.
- `lib/auth/session.ts` — DAL:ens identitetsläsning (sub/email/app_metadata/
  user_metadata ur claims; rollnivån läses fortfarande ur DB via RLS).
- `lib/gdpr/data.ts` — exportens namnläsning.

Med asymmetriska nycklar verifierar `getClaims` JWT-signaturen **lokalt** mot en
cachad JWKS (`/auth/v1/.well-known/jwks.json`) — ingen GoTrue-nätverksrunda per
sidladdning. Tidigare betalade varje admin-sida 2–3 seriella `getUser()`-rundor
(~100–200 ms styck) innan render.

## Driftvillkor

- **Revokera INTE ECC-nyckeln** utan att först skapa standby + rotera enligt
  dashboardens flöde — utan giltig nyckel i JWKS faller getClaims tillbaka på
  nätverksverifiering (långsammare) eller nekar.
- Legacy HS256-nyckeln kan revokeras när alla tokens utfärdade före rotationen
  löpt ut (refresh-cykeln är kort; cookien är 400 dagar men tokens byts löpande).
- **Rök efter deploy** (planens STOP-villkor): logga in på alla tre dörrar,
  navigera adminen — sessionen ska hålla (ingen utloggningsloop) och
  nätverksfliken ska visa färre `/auth/v1/user`-anrop. Backa middleware-steget
  om utloggningsloop uppstår (behåll getUser DÄR, byt bara DAL-rundan).
