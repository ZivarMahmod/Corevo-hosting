# TESTA DETTA — WORKFLOW-03 baseline (för Zivar)

Hela WORKFLOW-03 (VÅG 1–5) är byggt, verifierat live och pushat. Den här filen är
**din** check-lista: logga in på riktiga nätet och bekräfta att baslinjen beter sig
rätt. Allt nedan är redan grön-verifierat av mig automatiskt — det här är din andra
uppsättning ögon.

## Inloggningar (live, FreshCut-baslinje)
| Roll | E-post | Lösen | Värd |
|---|---|---|---|
| super_admin (plattform) | `platform@corevo.se` | `Demo!1234` | booking.corevo.se |
| salongsadmin | `freshcut@corevo.se` | `Corevo2026!` | booking.corevo.se |
| personal (staff) | `anstalld@corevo.se` | `Corevo2026!` | booking.corevo.se |
| kund | `kund@corevo.se` | `Corevo2026!` | freshcut.corevo.se |

> Logga ut HELT mellan rollerna (eller inkognito per roll) — annars bär en gammal
> cookie över och du testar fel session.

## 1. Rollmatris — ingen roll når fel yta (VÅG 1)
Testa varje cell. Förväntat resultat i högerkolumnen.

| Som | Gå till | Förväntat |
|---|---|---|
| super_admin | `booking.corevo.se/` | Plattforms-dashboard |
| super_admin | `booking.corevo.se/admin` | **Bouncas till `/`** (inte FreshCut-admin) |
| super_admin | `booking.corevo.se/personal` | **Bouncas till `/`** |
| super_admin | `/salonger`, `/fakturering` | Når dem (rätt) |
| salongsadmin | `/admin` | Salongsadmin (egen salong) |
| salongsadmin | `/salonger`, `/fakturering` | **`/ingen-atkomst`** |
| personal | `/personal` | Personal — idag |
| personal | `/admin`, `/salonger` | **`/ingen-atkomst`** |
| kund | `freshcut.corevo.se/konto` | Mina tider |
| kund | back-office-väg | **Bouncas / nekas** |
| utloggad | skyddad väg | `/login?next=…` |

✅ **Grön = ingen roll renderar en yta den inte ska.** Hittar du en cell som släpper
igenom fel → notera vilken, det är ett hål.

## 2. Försök TAPPA en bokning (VÅG 2 — aldrig tyst borta)
Kärn-invarianten: en bokning hård-raderas ALDRIG av någon väg; varje statusändring
hamnar i historik + audit.

1. Som **kund** på `freshcut.corevo.se`: boka en tid (välj tjänst → frisör → tid → bekräfta).
2. Som **salongsadmin/personal**: ändra bokningens status (bekräfta → klar, eller avboka).
3. Bekräfta att bokningen **fortfarande finns** (bara statusen ändras) — den försvinner aldrig.
4. Försök få den att försvinna: avboka, ändra fram och tillbaka, ladda om. Den ska
   ALLTID finnas kvar med rätt status.

✅ **Grön = du kan inte få en bokning att försvinna spårlöst.** (Status kan ändras;
raden består. Avbokad ≠ raderad.)

## 3. Boka → få poäng (VÅG 2 lojalitet, earn-only)
1. Som inloggad **kund**: boka en tid.
2. Som **personal/admin**: markera bokningen **`completed`** (klar).
3. Som **kund** på `/konto`: poängsaldot ska ha ökat med earn-raten (exakt en gång —
   markera klar igen och saldot dubblas INTE).

> Spendera poäng (redeem) är medvetet **inte** byggt ännu (ditt val: earn-only nu).

## 4. Realtime (VÅG 4)
1. Öppna admin/personal i ett fönster, storefront i ett annat.
2. Boka/avboka i storefront → admin-vyn uppdateras **utan omladdning** inom någon sekund.

## 5. Multi-salong (VÅG 4 — full)
FreshCut har **1 plats** → ingen plats-väljare visas (rätt). För att se multi-läget:
1. Som **salongsadmin**: `/admin/platser` → lägg till en andra plats.
2. Sätt schema/personal på den nya platsen (`/admin/scheman`, välj plats).
3. Som **kund**: boka → nu dyker en **plats-väljare** upp i wizarden; personal som inte
   jobbar på vald plats visas inte.
4. (Härdning, VÅG 5) Även via direkt API går det inte att boka en frisör på en plats
   hen inte jobbar på — `invalid_staff_location`.

> Sätt tillbaka FreshCut till 1 plats efteråt om du vill ha ren baslinje (inaktivera
> den extra platsen — den primära går inte att inaktivera, det är meningen).

## 6. POS orörd (guardrail)
`corevo.se` och `corevo.se/admin` → **200**, oförändrad. POS är en annan produkt och
rörs aldrig av bokningsplattformen.

---

## Känt + medvetet uppskjutet (inte buggar)
- **Onlinebetalning (Stripe):** kräver dina test-/live-nycklar → tills dess "betala på
  plats". Refund-paritet (gäst = kund) är inbyggd och aktiveras med betalning.
- **Kunddomän (egen domän → salong):** RPC + middleware klart; kräver att du pekar
  DNS + lägger Custom Domain i Cloudflare (ops-steg). Tills dess kör `*.corevo.se`.
- **Auth-hook (roll-claim i JWT):** middleware-grinden täcker rollmatrisen nu; den
  fullständiga hooken kräver en Dashboard-toggle (väg B) — väntar på dig.
- **Leaked-password-skydd:** Supabase Dashboard-toggle, OPS-pending.
- **Hero-titel-kontrast (a11y):** klarar AA-large i normalfallet; dippar bara över de
  ljusaste foto-pixlarna. Medvetet ej rört (risk att rubba ditt tema). Se
  `5-Kod/docs/ops/vag5-rollback.md`.
- **Anon-läsbar pris-/avgiftskonfig på `tenant_settings`:** noll för FreshCut, ingen
  läcka; flaggat att stänga bakom en kolumn-begränsad vy före riktig multi-tenant-launch.
