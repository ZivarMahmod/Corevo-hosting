# 13 — Prestanda

Varför plattformen kraschar med `exceededResources` på Cloudflare, och vad vi gör åt det.

| Fil | Vad |
|---|---|
| [`00-PRESTANDA-AUDIT.md`](00-PRESTANDA-AUDIT.md) | **Ingången.** Hela auditen: mätdata, vad som renderas när, 52 fynd (45 bekräftade), handlingsplan i 6 steg. |

## Kortversionen

**Det är inte CPU.** De requests som kraschade brände 10–60 ms CPU; de som *lyckades* brände mer
(P99 549 ms). `exceededResources` = minne (128 MB/isolat), inte processorkraft.

**En rad bär det mesta av kostnaden:** `app/layout.tsx:37-39`. Rot-layouten — som kör på varenda
request i hela plattformen, även `/login` och 404 — importerar tema-registryn för att få ut tre
färgpalett-strängar. Registryn drar i sin tur in tema-filerna, som drar in sina levande
React-komponenter: nav, footer, kundvagn, kassa, bokningswizard.

Uppmätt transitiv stängning: **154 filer, 1 451 kB källkod i varje requests modulgraf.**
Live på `/login`: 11 stylesheets, 513 kB CSS, varav ~400 kB mall-CSS som en inloggningssida
aldrig rör.

**Ett vattenfall bär det mesta av väntetiden:** `app/(public)/layout.tsx:78-188` — sju seriella
I/O-hopp på varje storefront-sidvisning. Alla behöver bara tenant-id:t.

## Vad vi INTE ska göra

Fler Workers hjälper inte (samma 128 MB per isolat). Queues, Durable Objects och Containers löser
inga problem vi har. Uppgradera inte Workers-planen igen — taket är inte CPU.

## Status

Auditen är **klar och verifierad**. Ingen kod ändrad än. Steg 1 = dela tema-filerna i data och
komponenter, sedan mäta `/login` (13 stylesheets → 4). Se planens avsnitt 5 för ordningen.
