# goal-63 — Zentum-kopian: fristående 1:1-replika (test: klarar Code en exakt kopia?)

**Beställning (Zivar, 2026-07-12, förtydligad):** Kopiera zentum.se:s startsida exakt — utseende, CSS, UX, laddningsbeteende, pixel för pixel — som en HELT FRISTÅENDE sida. **Noll koppling till Corevo-mallsystemet** (ingen bransch-copy, inga moduler, ingen registry). Detta är ett test av exakt-kopiering. Kategori: ekonomer.

**Riktningsbyte:** Första ansatsen (integrerad mall "balans" i ny ekonomi-kategori i mall-systemet) STOPPADES och återställdes på Zivars order 2026-07-12 — "den ska inte ha något med sånt vi byggt att göra".

**Leverans:** `5-Kod/apps/web/public/mallar/zentum/` — ren statisk HTML/CSS/JS:
- `index.html` — hela startsidan: overlay-header + dropdown + sök + outline-CTA, hero med lagerintro, intro-statement (Merriweather 26px), 6 tjänstekort (9:10, 60×60-pilknapp), navy full-bleed split med 2 ihbox, testimonial-slider, logo-carousel, footer, scroll-progress-knapp, off-canvas mobilmeny.
- `style.css` — alla värden lyfta exakta ur zentums CSS-kedja (egen CSS, inga temafiler kopierade).
- `app.js` — lagerintro, sticky header, split-line-reveals, sliders, progress-cirkel.

**Underlag (LAG):** `4-Dokument-Underlag/zentum-mall-spec.md` + `design-skarpa-zentum.md`. Rå-källa i scratchpad (zentum HTML + 31 CSS + SR7-hero-JSON + hero-foton).

**Innehålls-gräns (hård):** Design/mått/beteende = exakt. Zentums foton/varumärke/kundcitat/brödtext skeppas INTE — stock-foton i samma beskärning (9:10, ljus kontorskaraktär), fiktivt varumärke "Balans", fiktiva referenser, egen copy i samma struktur. Facktermer behållna.

**Klart =** 0 FAIL i fidelity-probe (alla specvärden HIT, inga förbjudna radier/skuggor/zentum-URLer) + adversariell review PASS + foton HEAD=200 ✅ + deploy.

**Status (2026-07-12):** KLAR som fristående sida — fidelity-probe 63/63 PASS, adversariell review-fynd åtgärdade (F5 avvisat med bevis: "slide 2" = SR7 Global Layers, ej innehålls-slide). Deployad via v1.28.1.
**Parkerat (Zivars val):** integration i mall-systemet (kategori Ekonomi + kund zentum) — två workflow-försök stoppade och återställda; återupptas bara på uttrycklig order. Kund-script förberett i scratchpad (skapa-zentum-kund.mjs).
