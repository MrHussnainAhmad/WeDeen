/**
 * Generates `assets/images/logo-mark.png`: the Muslim Deen: Quran & Prayer logo artwork with its
 * white background removed and cropped tight to the artwork, preserving the
 * true aspect ratio. This lets the logo render undistorted on any background
 * (ivory boot screen, dark-green block screen, square native overlay) instead
 * of the old `scaleX` stretch hack on the square white-background master.
 *
 * Source: assets/images/logo.png (512x512, palette PNG, white background).
 * Run: node scripts/make-logo-mark.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const projectRoot = path.join(__dirname, '..');
const SRC = path.join(projectRoot, 'assets', 'images', 'logo.png');
const OUT = path.join(projectRoot, 'assets', 'images', 'logo-mark.png');
const OUT_SPLASH = path.join(projectRoot, 'assets', 'images', 'logo-splash.png');

// White-knockout thresholds (chosen from the source palette):
//  - artwork's lightest color is cream at min(rgb)=219 -> keep opaque
//  - background/anti-alias pixels sit at min(rgb)>=236 -> fade to transparent
const OPAQUE_MAX = 219; // min(rgb) <= this => fully opaque
const CLEAR_MIN = 242; // min(rgb) >= this => fully transparent

function decode(buf) {
  let p = 8;
  let width, height, colorType, bitDepth;
  const idat = [];
  let plte = null;
  let trns = null;
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.slice(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'PLTE') plte = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (bitDepth !== 8) throw new Error('Only 8-bit PNG supported, got ' + bitDepth);
  const raw = zlib.inflateSync(Buffer.concat(idat));

  // Expand to RGBA, undoing PNG per-scanline filters.
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : 1;
  const indexed = colorType === 3;
  const srcCh = indexed ? 1 : channels;
  const stride = width * srcCh;
  const out = Buffer.alloc(width * height * 4);
  const line = Buffer.alloc(stride);
  const prev = Buffer.alloc(stride);
  let rp = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[rp++];
    for (let i = 0; i < stride; i++) {
      const x = raw[rp++];
      const a = i >= srcCh ? line[i - srcCh] : 0;
      const b = prev[i];
      const c = i >= srcCh ? prev[i - srcCh] : 0;
      let v;
      switch (filter) {
        case 0: v = x; break;
        case 1: v = x + a; break;
        case 2: v = x + b; break;
        case 3: v = x + ((a + b) >> 1); break;
        case 4: {
          const pp = a + b - c;
          const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
          v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default: throw new Error('Bad filter ' + filter);
      }
      line[i] = v & 0xff;
    }
    for (let x = 0; x < width; x++) {
      let r, g, b, al;
      if (indexed) {
        const idx = line[x];
        r = plte[idx * 3]; g = plte[idx * 3 + 1]; b = plte[idx * 3 + 2];
        al = trns && idx < trns.length ? trns[idx] : 255;
      } else if (channels === 4) {
        r = line[x * 4]; g = line[x * 4 + 1]; b = line[x * 4 + 2]; al = line[x * 4 + 3];
      } else if (channels === 3) {
        r = line[x * 3]; g = line[x * 3 + 1]; b = line[x * 3 + 2]; al = 255;
      } else {
        r = g = b = line[x]; al = 255;
      }
      const o = (y * width + x) * 4;
      out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = al;
    }
    line.copy(prev);
  }
  return { width, height, rgba: out };
}

function knockoutWhite({ width, height, rgba }) {
  const out = Buffer.from(rgba);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    const r = rgba[o], g = rgba[o + 1], b = rgba[o + 2];
    const m = Math.min(r, g, b);
    let t; // opacity 0..1
    if (m <= OPAQUE_MAX) t = 1;
    else if (m >= CLEAR_MIN) t = 0;
    else t = (CLEAR_MIN - m) / (CLEAR_MIN - OPAQUE_MAX);
    if (t >= 1) {
      out[o + 3] = 255;
    } else if (t <= 0) {
      out[o + 3] = 0;
    } else {
      // Unpremultiply the art color off the white background to avoid a halo.
      const un = (c) => Math.max(0, Math.min(255, Math.round((c - 255 * (1 - t)) / t)));
      out[o] = un(r); out[o + 1] = un(g); out[o + 2] = un(b);
      out[o + 3] = Math.round(t * 255);
    }
  }
  return { width, height, rgba: out };
}

function cropToContent({ width, height, rgba }, pad) {
  let minx = width, miny = height, maxx = -1, maxy = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rgba[(y * width + x) * 4 + 3] > 8) {
        if (x < minx) minx = x;
        if (x > maxx) maxx = x;
        if (y < miny) miny = y;
        if (y > maxy) maxy = y;
      }
    }
  }
  minx = Math.max(0, minx - pad);
  miny = Math.max(0, miny - pad);
  maxx = Math.min(width - 1, maxx + pad);
  maxy = Math.min(height - 1, maxy + pad);
  const cw = maxx - minx + 1;
  const ch = maxy - miny + 1;
  const out = Buffer.alloc(cw * ch * 4);
  for (let y = 0; y < ch; y++) {
    rgba.copy(out, y * cw * 4, ((miny + y) * width + minx) * 4, ((miny + y) * width + minx) * 4 + cw * 4);
  }
  return { width: cw, height: ch, rgba: out };
}

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encode({ width, height, rgba }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = width * 4;
  const rawWithFilter = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    rawWithFilter[y * (stride + 1)] = 0;
    rgba.copy(rawWithFilter, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(rawWithFilter, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Bilinear scale with premultiplied alpha so the transparent surround never
// bleeds dark fringes into the artwork edges when upscaling.
function scaleBilinear(src, dw, dh) {
  const { width: sw, height: sh, rgba } = src;
  const out = Buffer.alloc(dw * dh * 4);
  const sx = sw / dw;
  const sy = sh / dh;
  for (let y = 0; y < dh; y++) {
    const fy = Math.min(sh - 1, (y + 0.5) * sy - 0.5);
    const y0 = Math.max(0, Math.floor(fy));
    const y1 = Math.min(sh - 1, y0 + 1);
    const wy = fy - y0;
    for (let x = 0; x < dw; x++) {
      const fx = Math.min(sw - 1, (x + 0.5) * sx - 0.5);
      const x0 = Math.max(0, Math.floor(fx));
      const x1 = Math.min(sw - 1, x0 + 1);
      const wx = fx - x0;
      let r = 0, g = 0, b = 0, a = 0;
      for (const [px, py, wgt] of [
        [x0, y0, (1 - wx) * (1 - wy)],
        [x1, y0, wx * (1 - wy)],
        [x0, y1, (1 - wx) * wy],
        [x1, y1, wx * wy],
      ]) {
        const o = (py * sw + px) * 4;
        const pa = rgba[o + 3] / 255;
        r += rgba[o] * pa * wgt;
        g += rgba[o + 1] * pa * wgt;
        b += rgba[o + 2] * pa * wgt;
        a += rgba[o + 3] * wgt;
      }
      const o = (y * dw + x) * 4;
      const af = a / 255;
      out[o] = af > 0 ? Math.round(r / af) : 0;
      out[o + 1] = af > 0 ? Math.round(g / af) : 0;
      out[o + 2] = af > 0 ? Math.round(b / af) : 0;
      out[o + 3] = Math.round(a);
    }
  }
  return { width: dw, height: dh, rgba: out };
}

function blit(dst, src, ox, oy) {
  for (let y = 0; y < src.height; y++) {
    src.rgba.copy(
      dst.rgba,
      ((oy + y) * dst.width + ox) * 4,
      y * src.width * 4,
      y * src.width * 4 + src.width * 4
    );
  }
}

const decoded = decode(fs.readFileSync(SRC));
const knocked = knockoutWhite(decoded);
const contentPad = Math.round(282 * 0.05);
const cropped = cropToContent(knocked, contentPad);
fs.writeFileSync(OUT, encode(cropped));
console.log(
  `[make-logo-mark] Wrote ${path.relative(projectRoot, OUT)} ${cropped.width}x${cropped.height} ` +
    `(aspect ${(cropped.width / cropped.height).toFixed(3)})`
);

// Square, padded splash asset: the same undistorted mark centered on a
// transparent canvas so the native splash matches the in-app logo exactly.
const S = 1024;
const targetH = Math.round(S * 0.72);
const targetW = Math.round((targetH * cropped.width) / cropped.height);
const scaled = scaleBilinear(cropped, targetW, targetH);
const canvas = { width: S, height: S, rgba: Buffer.alloc(S * S * 4) };
blit(canvas, scaled, Math.round((S - targetW) / 2), Math.round((S - targetH) / 2));
fs.writeFileSync(OUT_SPLASH, encode(canvas));
console.log(
  `[make-logo-mark] Wrote ${path.relative(projectRoot, OUT_SPLASH)} ${S}x${S} ` +
    `(logo ${targetW}x${targetH} centered)`
);
