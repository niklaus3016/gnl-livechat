/**
 * Windows 图标内容占比校正
 *
 * 背景：Windows 桌面/任务栏的图标槽位尺寸固定，系统不补留白。
 * 设计师原图 logo 内容只占 512 画布的 75%（每边 64px 透明边距），
 * 与 Chrome/豆包等图标（内容占 88-92%）并排时显小一圈。
 *
 * 本脚本自动裁出不透明内容包围盒，等比放大到画布的 90% 后居中重绘。
 * macOS 图标另有 Apple 网格留白规范（80%），切勿用本脚本处理。
 *
 * 运行：node scripts/process-win-icon.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'build', 'icon-win.png');

/** 目标内容占画布比例（Chrome 等主流圆形图标约 88-92%） */
const FILL_RATIO = 0.9;
/** 包围盒外扩像素，保留抗锯齿边缘 */
const BLEED = 2;
const ALPHA_THRESHOLD = 16;

const img = await loadImage(fs.readFileSync(SRC));
const W = img.width;
const H = img.height;

const srcCanvas = createCanvas(W, H);
const sctx = srcCanvas.getContext('2d');
sctx.drawImage(img, 0, 0);
const src = sctx.getImageData(0, 0, W, H).data;

// 1. 找不透明内容包围盒
let minX = W, minY = H, maxX = -1, maxY = -1;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (src[(y * W + x) * 4 + 3] > ALPHA_THRESHOLD) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}
if (maxX < 0) throw new Error('图标完全透明，无法处理');

minX = Math.max(0, minX - BLEED);
minY = Math.max(0, minY - BLEED);
maxX = Math.min(W - 1, maxX + BLEED);
maxY = Math.min(H - 1, maxY + BLEED);
const bw = maxX - minX + 1;
const bh = maxY - minY + 1;
const before = (bw / W) * 100;

// 2. 放大到目标占比并居中
const target = Math.round(W * FILL_RATIO);
const margin = (W - target) / 2;

const out = createCanvas(W, H);
const octx = out.getContext('2d');
octx.imageSmoothingEnabled = true;
octx.imageSmoothingQuality = 'high';
octx.drawImage(img, minX, minY, bw, bh, margin, margin, target, target);

fs.writeFileSync(SRC, out.toBuffer('image/png'));

// 3. 验证结果包围盒
const vd = octx.getImageData(0, 0, W, H).data;
let vx0 = W, vy0 = H, vx1 = -1, vy1 = -1;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (vd[(y * W + x) * 4 + 3] > ALPHA_THRESHOLD) {
      if (x < vx0) vx0 = x;
      if (x > vx1) vx1 = x;
      if (y < vy0) vy0 = y;
      if (y > vy1) vy1 = y;
    }
  }
}
const after = ((vx1 - vx0 + 1) / W) * 100;
console.log(`OK: build/icon-win.png 内容占比 ${before.toFixed(1)}% -> ${after.toFixed(1)}%（目标 ${FILL_RATIO * 100}%），画布 ${W}x${H}`);
