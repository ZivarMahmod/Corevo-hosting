# Booking Variants — 4 ways to present the flow (mobile-first)

**99% of bookings happen on mobile** — so mobile is the priority and the star.
Same flow every time (tjänst → personal → dag/tid → uppgifter → bekräftelse),
shown four ways so you can *feel* which is smoothest. **Always embedded** in the
salon's own page (same brand) — never an external portal.

Open `index.html`: a pan/zoom canvas with a **Mobil** section (4 interactive
phone frames — the priority) and a **Desktop** section (each variant embedded in
the salon page). Click through any phone: pick a service, stylist, day, time.

| # | Variant | What it is | Best for |
|---|---|---|---|
| 1 | **Inline-sektion** | Booking scrolls into the page; every step stacked; one sweep. Sticky summary/CTA at the bottom. | Feels native to the page; few surprises. |
| 2 | **Drawer / overlay** | Bottom sheet slides up (side panel on desktop); salon page stays visible behind. | Strongest "I'm still on the salon's site" feeling. |
| 3 | **Steg-för-steg wizard** | One decision per screen, biggest touch targets, clear progress + back/next. | Max hand-holding; hardest to get wrong. |
| 4 | **Kompakt en-sida** | All choices visible at once (chips + slot grid). | Fast for repeat customers who know what they want. |

### Mobile rules honoured by all four
- Large, thumb-friendly touch targets; the **primary action sits at the bottom**.
- Minimal scroll; few taps to a booked time; **big, easily-tapped time chips**.
- Fast and obvious — nothing to think about.

### Recommendation (mobile)
**Variant 3 (steg-för-steg)** for the default: with 99% mobile, biggest touch
targets + one-thing-per-screen means the least to think about and the hardest to
mis-tap, and the summary/CTA always sits in thumb reach. Offer **Variant 4
(kompakt)** as a "snabbboka" shortcut for regulars. **Variant 2 (drawer)** is the
nicest on desktop when the booking should feel "inside the page".

## Files
- `index.html` — the comparison canvas.
- `core.js` — shared data + the single calm theme (so the comparison is about UX, not color).
- `frames.jsx` — phone frame + shared step pieces (service list, staff row, day row, slot grid, confirmation, bottom action bar).
- `variants.jsx` — the 4 mobile variants (`VInline`, `VDrawer`, `VWizard`, `VCompact`).
- `desktop.jsx` — desktop renderings embedded in the salon page.
