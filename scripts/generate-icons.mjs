import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function rgbaToPng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(
      raw,
      y * (width * 4 + 1) + 1,
      y * width * 4,
      (y + 1) * width * 4,
    );
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function setPixel(rgba, width, x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= width || y >= rgba.length / 4 / width) return;
  const i = (y * width + x) * 4;
  rgba[i] = r;
  rgba[i + 1] = g;
  rgba[i + 2] = b;
  rgba[i + 3] = a;
}

function fillRoundedRect(rgba, width, size, radius, color) {
  const r2 = radius * radius;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const inCorner = (cx, cy) => {
        const dx = x - cx;
        const dy = y - cy;
        return dx * dx + dy * dy <= r2;
      };
      const inside =
        (x >= radius && x < size - radius) ||
        (y >= radius && y < size - radius) ||
        inCorner(radius, radius) ||
        inCorner(size - 1 - radius, radius) ||
        inCorner(radius, size - 1 - radius) ||
        inCorner(size - 1 - radius, size - 1 - radius);
      if (inside) setPixel(rgba, width, x, y, ...color);
    }
  }
}

function drawThickLine(rgba, width, x0, y0, x1, y1, thickness, color) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2;
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    const r = thickness / 2;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r) {
          setPixel(rgba, width, Math.round(x + dx), Math.round(y + dy), ...color);
        }
      }
    }
  }
}

function drawCircle(rgba, width, cx, cy, radius, color) {
  const r2 = radius * radius;
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) setPixel(rgba, width, x, y, ...color);
    }
  }
}

function makeIcon(size) {
  const rgba = Buffer.alloc(size * size * 4, 0);
  const paper = [247, 244, 239];
  const coral = [255, 90, 54];
  fillRoundedRect(rgba, size, size, Math.round(size * 0.22), coral);
  const s = size / 32;
  drawThickLine(rgba, size, 10 * s, 21 * s, 22 * s, 10 * s, size * 0.07, paper);
  drawThickLine(rgba, size, 9.5 * s, 16.5 * s, 21 * s, 17.1 * s, size * 0.07, paper);
  drawCircle(rgba, size, 21.5 * s, 10.2 * s, size * 0.05, paper);
  return rgbaToPng(size, size, rgba);
}

const outDir = path.join(process.cwd(), "public/icons");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "icon-192.png"), makeIcon(192));
fs.writeFileSync(path.join(outDir, "icon-512.png"), makeIcon(512));
fs.writeFileSync(path.join(outDir, "apple-touch-icon.png"), makeIcon(180));
fs.writeFileSync(path.join(process.cwd(), "src/app/icon.png"), makeIcon(64));
console.log("wrote icons");
