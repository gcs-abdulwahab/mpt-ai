/**
 * Generates the PWA icon set (plain PNG, no image deps).
 * Run with: npm run icons
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public')

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // truecolour with alpha
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0 // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t))

/** Distance from a point to a line segment. */
function segmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const lengthSq = dx * dx + dy * dy
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

/** Draws the MPT-AI tick mark on a gradient tile. `padding` shrinks it for maskable icons. */
function drawIcon(size, { rounded = true, padding = 1 } = {}) {
  const rgba = Buffer.alloc(size * size * 4)
  const radius = rounded ? size * 0.22 : 0
  const from = [88, 204, 2] // duolingo-ish green
  const to = [28, 176, 246] // sky blue
  const stroke = size * 0.105 * padding
  const S = 3 // supersampling factor

  // Tick, in normalised canvas coordinates, scaled about the centre by `padding`.
  const pts = [
    [0.26, 0.53],
    [0.435, 0.705],
    [0.75, 0.32],
  ].map(([x, y]) => [(0.5 + (x - 0.5) * padding) * size, (0.5 + (y - 0.5) * padding) * size])

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let bg = 0
      let fg = 0
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const x = px + (sx + 0.5) / S
          const y = py + (sy + 0.5) / S
          // rounded-rect coverage
          const dx = Math.max(radius - x, x - (size - radius), 0)
          const dy = Math.max(radius - y, y - (size - radius), 0)
          if (Math.hypot(dx, dy) <= radius || radius === 0) bg++
          // tick coverage
          const onTick =
            segmentDistance(x, y, pts[0][0], pts[0][1], pts[1][0], pts[1][1]) <= stroke / 2 ||
            segmentDistance(x, y, pts[1][0], pts[1][1], pts[2][0], pts[2][1]) <= stroke / 2
          if (onTick) fg++
        }
      }
      const total = S * S
      const bgA = bg / total
      const fgA = fg / total
      const [r, g, bl] = mix(from, to, (px + py) / (2 * size))
      const i = (py * size + px) * 4
      rgba[i] = Math.round(r + (255 - r) * fgA)
      rgba[i + 1] = Math.round(g + (255 - g) * fgA)
      rgba[i + 2] = Math.round(bl + (255 - bl) * fgA)
      rgba[i + 3] = Math.round(255 * bgA)
    }
  }
  return encodePng(size, rgba)
}

mkdirSync(publicDir, { recursive: true })
const targets = [
  ['pwa-192x192.png', 192, {}],
  ['pwa-512x512.png', 512, {}],
  ['pwa-maskable-512x512.png', 512, { rounded: false, padding: 0.72 }],
  ['apple-touch-icon.png', 180, { rounded: false }],
]
for (const [name, size, opts] of targets) {
  writeFileSync(resolve(publicDir, name), drawIcon(size, opts))
  console.log(`generated public/${name}`)
}
