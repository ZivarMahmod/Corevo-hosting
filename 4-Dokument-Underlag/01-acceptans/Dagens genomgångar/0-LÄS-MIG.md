# Dagens genomgångar — designpaket (status + ordning)

Varje mock bor i egen mapp (html + NOTES ihop). **Klart+deployat → `klar/`.** Kvar = numrerade mappar i byggordning. Flytta ett paket till `klar/` när det är byggt, verifierat och deployat.

## ✅ Klart (i `klar/`)
- **Översikt v2** — LIVE (v1.32.0)
- **Kalender v2** — LIVE (v1.33.0); svep/dag-chips justerat (v1.34.1–v1.34.2)
- **Kunder v2** — LIVE (v1.34.0)
- **Ägaradmin mobil/PWA** — LIVE (v1.34.3); mobilkalender v2 finjusterad (v1.34.4)
- **Toppbanner universal v2** — LIVE (v1.34.4)
- **Redigera sidan v2** — integrerad på `main`; revisioner/utkast finns i migration 0080.

## ⏳ Kvar / väntar på livscykelgrind
| # | Paket | Status |
|---|---|---|
| 04 | `04-installningar-v2/` | Driftsatt; Zivars autentiserade acceptans återstår före flytt till `klar/`. |
| 05 | `05-kundportal/` | Ej byggt — kundportal (Desktop/Mobil/Mina Företag), egen yta. |
| 06 | `06-frisoradmin-mobil-pwa/` | Driftsatt; Zivars autentiserade acceptans återstår före flytt till `klar/`. |
| — | `Mobil pwa/` | Nytt inkommet chrome-/landskapspaket; läst, men goal-73 saknas. Byggs som egen del efter goal-72. |

`_referens/` = gammalt fullt admin-referensmaterial (`Frisör admin.html`), inte ett byggpaket.

## Regel
⛔ **Paritet (Zivar):** mobil = exakt desktop-funktioner, bara omplacerade — inget nytt, inget gömt. Design = exakt kopia av looks; döda ingen funktion.
