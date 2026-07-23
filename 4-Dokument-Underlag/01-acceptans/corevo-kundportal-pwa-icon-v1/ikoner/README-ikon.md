# Handoff: Corevo App-ikon — "Kopparfolie" (fastställd)

Den fastställda hemskärms-/PWA-ikonen för Corevo Kundportal.

> Implementationsnot 2026-07-23: GitHub-uppladdningen innehöll PNG-filerna men
> inte de två `.dc.html`-källor som nämns längst ned. De levererade PNG-filerna
> är därför operativ källa tills originalfilerna eventuellt läggs till.

## Konceptet
Serif-**C** i kopparfolie-gradient på en varm grafitmörk squircle med en diskret ljus-glow
uppe till höger. Läsbar från 40 px till 1024 px, premiumkänsla, men mysig — inte skrikig.

## Design tokens
```
Bakgrund (tile):  radial-gradient(120% 120% at 72% 16%, #2c2a1e 0%, #191a17 46%, #0e0e07 100%)
Glow:             radial-gradient(circle, rgba(240,212,176,.22) 0%, transparent 62%)  (uppe höger, ~78% storlek)
C-gradient:       linear-gradient(150deg, #f0d4b0 0%, #deb68d 42%, #a97141 100%)
C-typsnitt:       Spectral, vikt 600 (serif)  — drop-shadow 0 3px 2px rgba(0,0,0,.4)
Hörnradie:        ~22.4% av sidan (iOS-squircle), t.ex. 512 → 115px
Safe-zone:        C hålls inom centrerad ~80% (maskable)
theme_color:      #191a17
background_color: #191a17
```

## Filer i `ikoner/`
Alla är **hi-res masters** (renderade i 4×/3×/2×) — låt utvecklaren skala ner till exakt målstorlek
och exportera som optimerad PNG. C:et ligger i safe-zone så maskning till cirkel/squircle kapar inget.

| Fil | Innehåll | Master-px | Målstorlek(er) |
|---|---|---|---|
| `corevo-icon-512.png` | any / squircle | 640² | 512² (även 384, 256) |
| `corevo-icon-192.png` | any / squircle | 192² | 192² |
| `corevo-apple-touch-icon-180.png` | iOS apple-touch-icon | 228² | 180² |
| `corevo-icon-512-maskable.png` | maskable (cirkel-safe) | 640² | 512² maskable |
| `corevo-icon-monochrome.png` | benvit på grafit, för notis-badge/mono | 640² | valfri |

> För en riktig pixel-perfekt master: öppna `Corevo Ikon Kopparfolie.dc.html`, sätt en tile till
> exakt 512×512 px och exportera — eller återskapa gradienten i vektor (Figma/SVG) för skarpast resultat.

## manifest.webmanifest (kundportal)
```json
{
  "name": "Corevo — Mina sidor",
  "short_name": "Corevo",
  "start_url": "/mina",
  "scope": "/mina",
  "display": "standalone",
  "theme_color": "#191a17",
  "background_color": "#191a17",
  "icons": [
    { "src": "/pwa/corevo-icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/pwa/corevo-icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/pwa/corevo-icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" },
    { "src": "/pwa/corevo-icon-monochrome.png", "sizes": "512x512", "type": "image/png", "purpose": "monochrome" }
  ]
}
```
iOS (i `<head>`, då iOS ignorerar manifest-ikoner):
```html
<link rel="apple-touch-icon" href="/pwa/corevo-apple-touch-icon-180.png">
<meta name="theme-color" content="#191a17">
```

> Corevo:s kundportalmanifest genereras i
> `5-Kod/apps/web/app/api/customer-portal/manifest/route.ts`.
> Byt ut kundportalens ikoner mot dessa och behåll befintlig manifest-logik.

## Källa
- De fem levererade PNG-filerna ovan är nuvarande källa i repot.
- `Corevo Ikon Kopparfolie.dc.html` och `Corevo App-ikon.dc.html` anges i
  ursprungshandoffens källförteckning men följde inte med GitHub-uppladdningen.
