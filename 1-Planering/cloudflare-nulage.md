# Cloudflare nuläge — read-only inventering

> **Status:** READ-ONLY inventering. Inget ändrat (ingen DNS, route eller deploy).
> **Datum:** 2026-05-31
> **Konto:** Zivar68@gmail.com's Account (`0be2655be66efbfa5d9b36721ddae008`)
> **Källa:** Cloudflare REST API (GET) via MCP.

---

## 1. Zoner (3)

| Zon | Zone ID | Status | Nameservers |
|-----|---------|--------|-------------|
| **corevo.se** | `72cfc6ef04d85d0b13572f94e35e479a` | active | elisa / jermaine.ns.cloudflare.com |
| kvikta.se | `0b3e3b7e84db1a5b4802549ad06fc0ea` | active | elisa / jermaine.ns.cloudflare.com |
| sadaqahsweden.se | `005333a6c4f5a3d47541c105baa25c57` | active | elisa / jermaine.ns.cloudflare.com |

Endast **corevo.se** är relevant för frisör-SaaS. kvikta.se + sadaqahsweden.se är separata projekt i samma konto.

---

## 2. DNS-poster under corevo.se (14 st)

| Typ | Namn | Pekar på | Proxy | Not |
|-----|------|----------|:-----:|-----|
| CNAME | **corevo.se** (apex) | `corevo-pos-system.pages.dev` | 🟠 ja | **POS / Pages** |
| CNAME | **www**.corevo.se | `corevo-pos-system.pages.dev` | 🟠 ja | **POS / Pages** |
| CNAME | admin.corevo.se | `corevo-pos-system.pages.dev` | 🟠 ja | POS admin |
| CNAME | superadmin.corevo.se | `corevo-pos-system.pages.dev` | 🟠 ja | POS superadmin |
| CNAME | kiosk.corevo.se | `corevo-pos-system.pages.dev` | 🟠 ja | POS kiosk |
| CNAME | dev.corevo.se | `dev.corevo-pos-system.pages.dev` | 🟠 ja | POS dev-env |
| CNAME | admin.dev.corevo.se | `dev.corevo-pos-system.pages.dev` | 🟠 ja | POS dev-env |
| CNAME | superadmin.dev.corevo.se | `dev.corevo-pos-system.pages.dev` | 🟠 ja | POS dev-env |
| CNAME | kiosk.dev.corevo.se | `dev.corevo-pos-system.pages.dev` | 🟠 ja | POS dev-env |
| CNAME | **odoo**.corevo.se | `32987b8f-55a6-400f-b701-5578fd4629a9.cfargotunnel.com` | 🟠 ja | **Cloudflare Tunnel → dev-server (Odoo)** |
| MX | corevo.se | `mx2 / mx3 / mx4.pub.mailpod12-cph3.one.com` (prio 10) | grå | E-post via one.com |
| TXT | corevo.se | `v=spf1 include:_spf.one.com ~all` | grå | SPF (one.com) |

**Apex + www:** båda → `corevo-pos-system.pages.dev` (POS-systemet, Cloudflare Pages). Bekräftat.

**Dev-server-subdomäner:** `odoo.corevo.se` går via en **Cloudflare Tunnel** (`*.cfargotunnel.com`) — alltså en self-hosted tjänst (Odoo) bakom tunnel, INTE Pages. Tunnel-ID: `32987b8f-55a6-400f-b701-5578fd4629a9`.

**Dev-mönster:** POS använder `dev.corevo.se` + `<roll>.dev.corevo.se` för sin dev-miljö (pekar på `dev.`-branchen av Pages-projektet).

---

## 3. Befintliga subdomäner under corevo.se

```
(apex)            → POS Pages
www               → POS Pages
admin             → POS Pages
superadmin        → POS Pages
kiosk             → POS Pages
dev               → POS Pages (dev)
admin.dev         → POS Pages (dev)
superadmin.dev    → POS Pages (dev)
kiosk.dev         → POS Pages (dev)
odoo              → Cloudflare Tunnel (dev-server, Odoo)
```

---

## 4. Pages-projekt (2)

| Projekt | *.pages.dev | Custom domäner | Prod-branch | Senaste deploy |
|---------|-------------|----------------|-------------|----------------|
| **corevo-pos-system** | corevo-pos-system.pages.dev | corevo.se, www, admin, superadmin, kiosk, dev, admin.dev, superadmin.dev, kiosk.dev (9 st + .pages.dev) | main | `ac2223e6` (production) |
| sportsmeet | sportsmeet.pages.dev | — (endast .pages.dev) | main | preview |

`corevo-pos-system` äger ALLA corevo.se-domäner som idag är kopplade. `sportsmeet` är ett orelaterat projekt utan custom-domän.

---

## 5. Workers (1)

| Worker | Skapad | Ändrad |
|--------|--------|--------|
| `sadaqahsweden` | 2026-05-23 | 2026-05-30 |

Hör till sadaqahsweden.se-projektet. **Inga Workers på corevo.se.**

---

## 6. Krock-analys — planerade subdomäner vs befintligt

Planerat: `booking`, `admin`, `app`, `www`, `api`, `frisorN`

| Planerad | Finns redan? | Status | Kommentar |
|----------|:------------:|--------|-----------|
| `booking.corevo.se` | nej | ✅ **fri** | — |
| `admin.corevo.se` | **JA** | ❌ **KROCK** | Används av POS-admin (Pages). |
| `app.corevo.se` | nej | ✅ **fri** | — |
| `www.corevo.se` | **JA** | ❌ **KROCK** | Apex+www servar POS idag. |
| `api.corevo.se` | nej | ✅ **fri** | — |
| `frisor1..N.corevo.se` | nej | ✅ **fria** | Inga `frisorN` finns. |

### Sammanfattning krockar
- **2 hårda krockar:** `admin` och `www` är redan kopplade till `corevo-pos-system` Pages-projektet (prod). Kan inte återanvändas utan att flytta/ta bort POS-poster — vilket är utanför denna read-only-inventering.
- **Fria:** `booking`, `app`, `api`, samt alla `frisorN`.
- **Apex (`corevo.se`) är upptaget** av POS — frisör-SaaS kan inte ta apex utan beslut om POS.

### Att tänka på inför domänstrategi
- `superadmin` + `kiosk` är också upptagna (POS) — undvik dessa namn för frisör-SaaS.
- POS har ett **dev-mönster** `<roll>.dev.corevo.se`. Om frisör-SaaS vill ha staging bör samma mönster följas (`booking.dev`, `app.dev`, `api.dev` — alla fria idag) för konsekvens.
- `odoo.corevo.se` → Cloudflare Tunnel till dev-server. Rör inte; orelaterat till SaaS-trafik men delar zon.
- E-post (MX/SPF via one.com) ligger på apex — får INTE påverkas vid framtida apex-ändringar.

---

## 7. Begränsningar i denna inventering
- SSL-läge (`/settings/ssl`) kunde inte läsas: API svarade `9109 Unauthorized` — API-token saknar `Zone Settings:Read`-scope. Övriga zone- och kontodata lästes utan problem.
- Inventering = endast GET-anrop. **Inget ändrat.**
