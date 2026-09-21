/**
 * 生成桌面客户端应用图标 build/icon.png（1024×1024，RGBA）。
 *
 * 纯 Node(zlib) 实现，无第三方依赖：抽象极光渐变风格，
 * 与访客端 AI 默认头像（ai-default.png）同一视觉语言。
 * 提交生成后的 PNG 到仓库，CI 直接使用；electron-builder 会据此生成
 * Windows 的 .ico 与 macOS 的 .icns。
 *
 * 重新生成：node scripts/generate-icon.cjs
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 1024;

// 极光光斑（坐标为比例 0~1，半径为图像边长比例，颜色 RGB）
const BLOBS = [
  { x: 0.30, y: 0.22, r: 0.62, c: [124, 58, 237] },   // violet-600
  { x: 0.78, y: 0.28, r: 0.50, c: [59, 130, 246] },   // blue-500
  { x: 0.72, y: 0.82, r: 0.55, c: [34, 211, 238] },   // cyan-400
  { x: 0.22, y: 0.80, r: 0.46, c: [52, 211, 153] },   // emerald-400
  { x: 0.50, y: 0.50, r: 0.40, c: [236, 72, 153] },   // pink-500 微光
];

// 背景：深夜蓝对角渐变
function bg(u, v) {
  const t = (u + v) / 2;
  return [
    Math.round(8 + t * 22),
    Math.round(12 + t * 16),
    Math.round(34 + t * 42),
  ];
}

function clamp8(n) {
  return n < 0 ? 0 : n > 255 ? 255 : n | 0;
}

function renderPixel(u, v) {
  let [r, g, b] = bg(u, v);
  for (const blob of BLOBS) {
    const dx = u - blob.x;
    const dy = v - blob.y;
    const d2 = dx * dx + dy * dy;
    // 类高斯衰减，权重压一点，避免整体过曝
    const w = Math.exp(-d2 / (blob.r * blob.r) * 2.4) * 0.72;
    r += (blob.c[0] - r) * w;
    g += (blob.c[1] - g) * w;
    b += (blob.c[2] - b) * w;
  }
  // 顶部柔光，增强"极光"通透感
  const sheen = Math.max(0, 1 - Math.hypot(u - 0.35, v - 0.1) * 2.2) * 26;
  r += sheen;
  g += sheen;
  b += sheen * 1.15;
  return [clamp8(r), clamp8(g), clamp8(b), 255];
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function buildPng() {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowLen = SIZE * 4;
  const raw = Buffer.alloc((rowLen + 1) * SIZE);
  for (let y = 0; y < SIZE; y++) {
    const rowStart = y * (rowLen + 1);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < SIZE; x++) {
      const [r, g, b, a] = renderPixel(x / (SIZE - 1), y / (SIZE - 1));
      const off = rowStart + 1 + x * 4;
      raw[off] = r;
      raw[off + 1] = g;
      raw[off + 2] = b;
      raw[off + 3] = a;
    }
  }

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = path.join(__dirname, '..', 'build');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'icon.png');
fs.writeFileSync(out, buildPng());
console.log('icon generated:', out, `${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
