# WORKFLOW-01 (MASTER) — G13-stängning + helsvep: fix → moduler → design → e2e → polish

**Detta är HELA jobbet i ett dokument.** Klistra in i Code och kör uppifrån och ner. Innehåller G13-stängningen (login/storefront-fix), Zivars 2 manuella steg, och hela bygg-workflowen.

> Läs `CLAUDE.md` + `HANDOFF.md` först. Filplacering enligt CLAUDE.md. POS-guardrail gäller hela vägen.

---

## ⚠️ ANTI-LOOP — läs först
Två steg är **Zivars, out-of-band** (se nästa sektion). De är INTE byggblockerare. Code ska:
- Göra ALLT annat klart utan att vänta på dem.
- Markera dem som "pending-owner" i rapporten — inte loopa, inte re-rapportera samma state.
- Aldrig kringgå audit/compliance-guarden för frisor3 (den ska blockera dig — det är rätt).

## 👤 ZIVAR GÖR (2 steg, out-of-band — Code rör dem inte)
1. **frisor3-radering** — owner-SQL (audit-guarden blockerar Code med flit). Exakt SQL i `5-Kod/docs/ops/go-live-G13.md`.
2. **Hemligheten Code inte kan hämta** — sätts som Worker-/CI-secret enligt Codes instruktion i samma ops-doc. Klistras inte rått i chatt.

---

## FAS 0 — SOLO: stäng G13 + fundament (en sak i taget, inget parallellt)

**0.0 FÖRUTSÄTTNING (klar):** Custom domains attachade. **Rätt host = `booking.corevo.se`** (Zivar bytte från `bookning` → `booking`; gamla `bookning` är borttagen/Error 1016). `demo.corevo.se` attachad.

**0.1 LOGIN-FIX (verifiera via FORMULÄRET, inte API).**
Nörden har sett login NEKA `platform@corevo.se`/`Demo!1234` via formuläret på 3 hostar. Bekräfta och fixa:
- Sätt `NEXT_PUBLIC_PLATFORM_HOST=booking.corevo.se` (domänen bytte) + re-deploya. Annars känner host-spliten inte igen plattform-värden.
- Använder den deployade login-server-actionen rätt Supabase **runtime-config** (URL + anon-nyckel som Worker-secret, inte bara build-inlinat)? Saknas → auth failar tyst → "fel lösenord". Sätt secrets, re-deploya.
- Moln: `select email,(encrypted_password is not null) from auth.users where email='platform@corevo.se';` Finns? Lösen rätt? Re-seeda `crypt('Demo!1234',gen_salt('bf'))` vid behov. Kör GoTrue NULL-token-normaliseringen.

**0.2 STOREFRONT-FIX (host-resolution).**
- `demo.corevo.se` → "salongen inte tillgänglig". Host-vägen matchar ej tenant (`?tenant=demo` funkar). Fixa `lib/tenant*.ts` så host resolvar: `tenant_domains.domain='demo.corevo.se'` → demo-tenant. Verifiera raden finns på molnet, lägg/rätta i seed.

**0.3 DoD Fas 0 (Code verifierar):** alla 3 demo-konton loggar in via formuläret på `booking.corevo.se` → rätt vy; `demo.corevo.se` renderar storefront via host; ingen client-side exception; POS orörd.

**0.4 DESIGN-SYSTEM-KÄLLAN (kritisk — allt bygger på denna).**
- En agent studerar **befintliga corevo-pos-systemet live** (corevo.se + admin.corevo.se) + freshcut.se → extraherar designspråk (färg, typografi, spacing, radie, skuggor, knappar, kort, nav, form).
- Skriver `5-Kod/docs/design-system.md` + design-tokens (Tailwind/CSS-vars) som ALLA agenter följer. Boknings-appen ska kännas som Corevo-familjen.

> Fas 1 startar inte förrän 0.1–0.4 är gröna.

---

## ORKESTRERINGSREGLER (Fas 1+)
- **Agent-flotta:** spawna subagenter parallellt — bara på skilda revir (egna filer). En agent = en modul.
- **Frysta filer = SOLO:** `middleware.ts`, `lib/tenant*.ts`, `packages/db`, `packages/auth`, root-config, design-tokens. Endast i solo-faser.
- **Parallellt = git worktrees.** Aldrig 2 agenter i samma mapp.
- **Per modul:** bygg klart → rapportera KLAR + STANNA → verifiera → nästa.
- **Riktigt, inte stubbar.** Varje knapp gör något. Varje vy: laddar/tom/fel/lyckat-läge. Inga döda länkar.
- **Test live** mot deployen + demo-kontona. Inte localhost.
- **POS orörd:** aldrig corevo.se POS-DNS/records. Bara booking/demo/tenant-hostar.
- **⚠️ BYGG-FÄLLA:** `ö` i `firsör-sas` bryter OpenNext/esbuild. Bygg/deploya från rent ASCII-träd (`C:\tmp\kod` + `pnpm install`). Permanent fix: döp om mappen → `frisor-sas` (Zivar väljer om mappen i Cowork).
- **Hitta ologiska saker:** varje agent rapporterar UX-luckor/halvfärdiga ytor den ser, inte bara sitt revir.

---

## FAS 1 — PARALLELLT: modulbygge (ett revir per agent)
Bygg sidor + design (mot tokens) + knappar + logiska händelser (klick → vad händer) + states + datakoppling (RLS/tenant-säkert). Verifiera mot demo-data.

- **Agent A — Publik storefront (M2):** komplett salongssida (hero, om, tjänster m. riktiga priser, öppettider, personal, "Boka tid"). **Freshcut-hemsida** som flaggskepp + **3 separata temamallar** (config nivå 1 + layout nivå 2 + scoped CSS nivå 3) så nya kunder kan välja stil → sidor blir INTE kopior. Bevisa 2 tenants ser olika ut.
- **Agent B — Bokningsmotor (M3, kärnan):** hela flödet klick för klick (tjänst→personal→dag→ledig tid→uppgifter→bekräftelse). Alla states (laddar/inga tider/upptaget/lyckat/fel). Bekräftelse-vy med kvitto-känsla + kalender-krok.
- **Agent C — Kundportal (M4):** logga in, "Mina tider", profil, av-/omboka. States klara.
- **Agent D — Personalportal (M5):** schema, frånvaro, dagens bokningar. För `klippare@`.
- **Agent E — Salong-admin (M6):** tjänster, personal, scheman, **varumärkes-editor** (ändra logga/bild/färg/text → syns DIREKT på storefront, bevisa live). Stripe-koppling-UI lätt.
- **Agent F — Platform-admin (M7):** dashboard (alla salonger), skapa ny salong, **onboarding för ny kund** (välj mall/tema → unik sida), faktureringsunderlag (flöde 2).
- **Agent G — Notiser + Google-recension (M9-del):** bekräftelse + påminnelse. **Google-nudge fyrar EFTER besöket** (status=completed). **Planera notis-arkitekturen** nedskrivet + gör det lätt för ägaren att styra notiser.

---

## FAS 2 — SOLO: tvärgående (rör frysta filer)
- **2.1 Enkel iPad-inloggning:** ägaren loggar in EN gång på en iPad framme i salongen och ser bokningar — inte logga in på nytt varje gång. Lång/persistent session + "framme-vy" (dagens bokningar) som håller sig inloggad. Säkert men bekvämt.
- **2.2 Ny-kund-differentiering:** temamall-val + branding-steg i onboarding → varje tenant distinkt, ingen kopia.

---

## FAS 3 — E2E, benchmark & polish
- **3.1 End-to-end live (demo-konton):** kund bokar på `demo.corevo.se` → syns hos `klippare@` + `admin@` → completed → Google-nudge fyrar → ägaren ändrar branding → syns på storefront. Hela kedjan, inte i bitar. `platform@` ser allt tvärs.
- **3.2 Benchmark mot verkligheten:** titta på riktiga salongs-/boknings-sajter (hur hemsida + flöde ska byggas) + bra dashboards (hur admin/plattform ska kännas). Jämför, lista vad som skaver, fixa. Kontrollera att lagren kopplas: storefront→API→DB→admin, samma bokning korrekt i alla vyer.
- **3.3 Adversarial granskning:** review-agenter jagar ologiska flöden, döda knappar, halvfärdiga ytor, trasiga states, tenant-läckage. Fix-lista → åtgärda.
- **3.4 Polish:** putsa CSS, mikro-interaktioner, tomma tillstånd, mobil/iPad-känsla. Tills det känns klart.

---

## WORKFLOW-DoD
- [ ] Alla 3 demo-konton loggar in live på `booking.corevo.se`, rätt vy.
- [ ] Bokningssystemet funkar HELA vägen (boka → personal + admin → completed → Google-nudge).
- [ ] Storefront + Freshcut + 3 mallar live; 2 tenants ser olika ut.
- [ ] Admin: ändra bild/text/branding → syns på storefront live.
- [ ] CSS följer corevo-pos-systemet (design-system.md).
- [ ] iPad: en inloggning räcker, håller sig inloggad.
- [ ] Notis-plan nedskriven + grundnotiser funkar.
- [ ] Inga döda knappar / ologiska flöden kvar.
- [ ] POS-koll: corevo.se + admin.corevo.se oförändrade.
- [ ] Betalning: lämnad som den är (Zivar tar senare).
- [ ] Pending-owner (ej blockerande): frisor3-radering + hemligheten = Zivars 2 steg.

**KÖRLÄGE (Zivar 2026-06-01): kör FAS 1→3 i EN följd utan att stanna mellan faserna.** FAS 0 är redan verifierad + godkänd av Nörden. STANNA bara vid: (a) en verklig blockerare, (b) en frozen-file-konflikt som kräver beslut, eller (c) när hela FAS 3 är klar. Nörden verifierar HELA resultatet live på slutet + uppdaterar HANDOFF.

Inom faserna gäller fortfarande: frozen files = SOLO, parallella agenter i egna revir, varje agent verifierar sin egen modul innan merge, POS orörd, ASCII-bygg, loopa aldrig på Zivars 2 owner-steg. Internt: kör steg 0 (chrome-flip till Corevo-temat) SOLO och self-checka det INNAN de 7 agenterna bygger ovanpå.
