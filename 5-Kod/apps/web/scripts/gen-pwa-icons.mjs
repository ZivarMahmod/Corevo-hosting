// PWA-ikoner för kund-adminen (goal-66). Skriver PNG:erna som iOS kräver —
// hemskärmen läser INTE manifestets SVG, den vill ha apple-touch-icon som PNG.
//
// Varför en egen encoder i stället för sharp/canvas: det här körs EN gång när ikonen
// ändras. Att lägga till ett binärt bildbibliotek (och dess plattformsvarianter) i
// bygget för tre statiska filer är dyrare än 60 rader zlib. Node har allt som behövs.
//
//   node scripts/gen-pwa-icons.mjs
//
// Ritar samma glyf som public/pwa/admin-icon.svg: bläckfärgad platta, kalenderram,
// resurskolumner och ett guldblock (en bokad tid). Håll dem i synk om SVG:n ändras.

import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const OUT = new URL('../public/pwa/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

// Paletten är back-officeens egen (Topnav.module.css) — ikonen och produkten ska
// höra ihop även på hemskärmen.
const INK = [0x26, 0x26, 0x1f] // --c-forest
const PAPER = [0xf6, 0xf4, 0xee]
const GOLD = [0x8f, 0x6d, 0x28] // --c-gold

/** Ritytan är alltid 512×512 i "designkoordinater" och skalas till målstorleken, så
 *  samma geometri fungerar för 180, 192 och 512 utan att någon siffra dubbleras. */
const DESIGN = 512

const rgba = (c, a = 255) => [c[0], c[1], c[2], a]

/** Fyller en rundad rektangel. Hörnradien mäts i designkoordinater. */
function roundRect(px, size, x0, y0, w, h, r, color) {
  const s = size / DESIGN
  for (let y = Math.floor(y0 * s); y < Math.ceil((y0 + h) * s); y++) {
    for (let x = Math.floor(x0 * s); x < Math.ceil((x0 + w) * s); x++) {
      if (x < 0 || y < 0 || x >= size || y >= size) continue
      // Avstånd till närmaste hörncentrum — utanför radien = utanför formen.
      const dx = Math.max(x0 * s + r * s - x, 0, x - (x0 + w) * s + r * s + 1)
      const dy = Math.max(y0 * s + r * s - y, 0, y - (y0 + h) * s + r * s + 1)
      if (dx > 0 && dy > 0 && dx * dx + dy * dy > (r * s) * (r * s)) continue
      const i = (y * size + x) * 4
      const [rr, gg, bb, aa] = rgba(color)
      px[i] = rr
      px[i + 1] = gg
      px[i + 2] = bb
      px[i + 3] = aa
    }
  }
}

/** Ram (ofylld rektangel) med given linjebredd. */
function strokeRect(px, size, x, y, w, h, lw, color) {
  roundRect(px, size, x, y, w, lw, 0, color) // topp
  roundRect(px, size, x, y + h - lw, w, lw, 0, color) // botten
  roundRect(px, size, x, y, lw, h, 0, color) // vänster
  roundRect(px, size, x + w - lw, y, lw, h, 0, color) // höger
}

function drawIcon(size) {
  const px = new Uint8Array(size * size * 4)

  // Bakgrund: bläckplatta med rundade hörn (maskable-safe — allt viktigt i mitten).
  roundRect(px, size, 0, 0, 512, 512, 96, INK)

  // Kalenderram + huvudrad.
  strokeRect(px, size, 126, 150, 260, 230, 20, PAPER)
  roundRect(px, size, 126, 202, 260, 20, 0, PAPER)

  // Upphängning.
  roundRect(px, size, 176, 118, 20, 50, 10, PAPER)
  roundRect(px, size, 316, 118, 20, 50, 10, PAPER)

  // Resurskolumner (svagare — de är rutnätet, inte innehållet).
  const faint = [0x6e, 0x6e, 0x66]
  roundRect(px, size, 209, 222, 6, 148, 0, faint)
  roundRect(px, size, 297, 222, 6, 148, 0, faint)

  // En bokad tid: höjd = längd, precis som i gridet.
  roundRect(px, size, 228, 250, 56, 86, 12, GOLD)

  return px
}

// ── Minimal PNG-encoder (RGBA, ingen filtrering) ──
function crc32(buf) {
  let c
  const table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(px, size) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bitdjup
  ihdr[9] = 6 // färgtyp RGBA
  // Varje rad föregås av en filter-byte (0 = ingen filtrering).
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    Buffer.from(px.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

for (const size of [180, 192, 512]) {
  const file = join(OUT, `admin-icon-${size}.png`)
  writeFileSync(file, encodePng(drawIcon(size), size))
  console.log(`skrev ${file}`)
}
