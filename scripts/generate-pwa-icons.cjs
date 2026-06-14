// Generate the 8 PWA icon PNGs referenced by apps/frontend/src/manifest.webmanifest.
// Run with: `node scripts/generate-pwa-icons.cjs`
//
// We don't have ImageMagick / PIL in this environment, so we hand-roll
// minimal valid PNGs with the built-in `zlib` module. The design is a
// centered white circle (the "civic emblem") on the theme-color
// background, with a smaller dark inner circle for a "lens" effect.
// The full square is filled in the background color so the icon reads
// correctly when masked into a circle by the OS launcher.
//
// The fill is intentional — the real icons are design-team territory.
// The goal here is just to make the manifest resolvable so the PWA
// is installable AND so the install-prompt banner shows something
// more meaningful than a solid-color square. Replace these files
// with real artwork before going to production.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 table for PNG chunk CRCs.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Build a PNG chunk: 4-byte length + 4-byte type + data + 4-byte CRC.
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

// Smoothstep — used for the anti-aliased edge bands.
function smoothstep(e0, e1, x) {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

// "Civic emblem" PNG: theme-color background with a centered white
// circle and a smaller dark inner circle. Anti-aliased edges (no
// hard 1-bit boundaries) so the 72/96 px sizes don't stair-step.
// Solid color (no alpha) for smallest possible file size — the OS
// launcher masks the corners regardless.
function makeEmblemPng(size, bg, ring, core) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR: width, height, bit-depth=8, color-type=2 (RGB), compression=0,
  // filter=0, interlace=0.
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // Concentric circles — radii scale with the icon size. `outerR`
  // is the OUTER radius of the white circle (30% of size); `coreR`
  // is the radius of the inner dark "lens" (12% of size). Both
  // are well within the inner 40% maskable safe area, so the OS
  // launcher's circular/squircle crop won't clip the design.
  const center = (size - 1) / 2;
  const outerR = size * 0.30;
  const coreR = size * 0.12;
  // AA band width scales with icon size: ~0.3% of edge — ~0.3 px
  // at 72 px, ~1.5 px at 512 px. Wide enough to soften the
  // boundary on small sizes, narrow enough to stay invisible on
  // large ones.
  const edgeWidth = Math.max(0.75, size / 256);

  // IDAT: one filter byte (0 = None) per row + 3 bytes per pixel.
  const rowBytes = 1 + size * 3;
  const raw = Buffer.alloc(rowBytes * size);
  for (let y = 0; y < size; y++) {
    raw[y * rowBytes] = 0;
    for (let x = 0; x < size; x++) {
      const dx = x - center;
      const dy = y - center;
      const d = Math.sqrt(dx * dx + dy * dy);

      // Per-layer alpha (0 = transparent at this pixel, 1 = opaque).
      // Both layers fade smoothly over the same edge band so the
      // final composite has no visible seams.
      const coreA = 1 - smoothstep(coreR - edgeWidth, coreR + edgeWidth, d);
      const ringA = 1 - smoothstep(outerR - edgeWidth, outerR + edgeWidth, d);

      // Composite bg → ring → core (back-to-front).
      const r1 = Math.round(bg[0] * (1 - ringA) + ring[0] * ringA);
      const g1 = Math.round(bg[1] * (1 - ringA) + ring[1] * ringA);
      const b1 = Math.round(bg[2] * (1 - ringA) + ring[2] * ringA);
      const r2 = Math.round(r1 * (1 - coreA) + core[0] * coreA);
      const g2 = Math.round(g1 * (1 - coreA) + core[1] * coreA);
      const b2 = Math.round(b1 * (1 - coreA) + core[2] * coreA);

      const off = y * rowBytes + 1 + x * 3;
      raw[off] = r2; raw[off + 1] = g2; raw[off + 2] = b2;
    }
  }
  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
// #2563eb theme (matches manifest.theme_color), #ffffff ring, #0f172a core
// (matches the `background_color` in the manifest for visual continuity).
const BG = [0x25, 0x6b, 0xeb];
const RING = [0xff, 0xff, 0xff];
const CORE = [0x0f, 0x17, 0x2a];
const OUT_DIR = path.join(__dirname, '..', 'apps', 'frontend', 'src', 'assets', 'icons');

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) {
  const buf = makeEmblemPng(size, BG, RING, CORE);
  const file = path.join(OUT_DIR, `icon-${size}x${size}.png`);
  fs.writeFileSync(file, buf);
  console.log(`wrote ${file} (${buf.length} bytes, ${size}x${size})`);
}
