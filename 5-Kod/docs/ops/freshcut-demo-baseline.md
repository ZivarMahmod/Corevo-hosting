# FreshCut demo-baseline — inloggningar & domäner

> Snabbreferens för demon. Allt aktiveras när **goal-15 (FreshCut-baseline)** körts klart.
> **Alla lösenord: `Corevo2026!`**

## 🔑 Inloggningar

| Roll | E-post (login) | Loggar in på | Ser |
|---|---|---|---|
| Du (platform / super-admin) | *din befintliga* | `booking.corevo.se/login` | Allt — plattform, alla salonger |
| Salong-admin | `freshcut@corevo.se` | `booking.corevo.se/login` | FreshCuts admin (`/admin`) |
| Anställd | `anstalld@corevo.se` | `booking.corevo.se/login` | Personal-vy (`/personal`) — sina bokningar |
| Kund | `kund@corevo.se` | `freshcut.corevo.se/login` | Kundkonto (`/konto`) — sina bokningar |

> OBS: `anstalld` skrivs utan "ä" — ä strular i mejl-login.

## 🌐 Domäner

| Adress | Vad | Status |
|---|---|---|
| `booking.corevo.se` | Backoffice — alla **interna** roller loggar in här | Live |
| `freshcut.corevo.se` | FreshCuts **storefront** (hemsida + bokning + kundlogin) | Live |
| `corevo.se` | POS (separat produkt) | Rör ej |
| `freshcut.se` / kunddomän | Riktig egen domän → white-label | Kommer (goal-16) |

## Kort att minnas

- **Interna** (du / salong-admin / anställd) → `booking.corevo.se`
- **Kunder** → `freshcut.corevo.se`
- Alla med samma lösen: **`Corevo2026!`**

---
*Demo-credentials. Byt lösenord innan riktig produktion.*
