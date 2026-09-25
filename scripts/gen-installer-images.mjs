/**
 * 生成 NSIS 安装向导侧边栏品牌图（164×314，24bit BMP）
 *
 * electron-builder 读取：
 *   nsis.installerSidebar    -> build/installerSidebar.bmp
 *   nsis.uninstallerSidebar  -> build/uninstallerSidebar.bmp
 *
 * 设计：深蓝→蓝紫纵向渐变（企业深色风）+ 新 logo + 白色产品名 + slogan。
 * 同时输出 PNG 预览到系统临时目录，便于人工目检。
 *
 * 重跑：node scripts/gen-installer-images.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, GlobalFonts, Image } from '@napi-rs/canvas';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BUILD_DIR = path.join(ROOT, 'build');

const W = 164;
const H = 314;

const FONT_PATH = path.join(BUILD_DIR, 'fonts', 'NotoSansSC.ttf');
const LOGO_PATH = path.join(BUILD_DIR, 'icon-win.png');

const FONT_FAMILY = 'NotoSansSC';
GlobalFonts.registerFromPath(FONT_PATH, FONT_FAMILY);

const logo = new Image();
logo.src = fs.readFileSync(LOGO_PATH);
await logo.decode();
if (!logo.width) throw new Error('logo 解码失败');

/** 侧边栏配色（与坐席端深色风一致） */
const BG_TOP = '#0B1437';
const BG_MID = '#1E2A6B';
const BG_BOTTOM = '#312E81';

/** @napi-rs/canvas 无 bmp 编码器，手写 24bit BMP（NSIS 经典 UI 标准要求） */
function encodeBMP24(canvas) {
  const { width, height } = canvas;
  const rgba = canvas.data;
  const rowSize = Math.floor((24 * width + 31) / 32) * 4;
  const pixelBytes = rowSize * height;
  const fileSize = 14 + 40 + pixelBytes;
  const buf = Buffer.alloc(fileSize);

  // BITMAPFILEHEADER
  buf.write('BM', 0, 'ascii');
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt32LE(0, 6);
  buf.writeUInt32LE(14 + 40, 10);

  // BITMAPINFOHEADER
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(height, 22);
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);
  buf.writeUInt32LE(0, 30);
  buf.writeUInt32LE(pixelBytes, 34);
  buf.writeInt32LE(2835, 38);
  buf.writeInt32LE(2835, 42);
  buf.writeUInt32LE(0, 46);
  buf.writeUInt32LE(0, 50);

  // 像素自底向上、BGR、每行 4 字节对齐
  let offset = 54;
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      buf[offset++] = rgba[i + 2];
      buf[offset++] = rgba[i + 1];
      buf[offset++] = rgba[i];
    }
    offset += rowSize - width * 3;
  }
  return buf;
}

function drawSidebar(slogan) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // 1. 纵向渐变底
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, BG_TOP);
  bg.addColorStop(0.55, BG_MID);
  bg.addColorStop(1, BG_BOTTOM);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 2. 装饰：右上角同心圆环（部分溢出，增加纵深感）
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(147,197,253,0.22)';
  ctx.beginPath();
  ctx.arc(W + 18, -22, 96, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(147,197,253,0.14)';
  ctx.beginPath();
  ctx.arc(W + 18, -22, 68, 0, Math.PI * 2);
  ctx.stroke();

  // 左下角微光圆
  ctx.strokeStyle = 'rgba(165,180,252,0.12)';
  ctx.beginPath();
  ctx.arc(-24, H + 10, 72, 0, Math.PI * 2);
  ctx.stroke();

  // 3. Logo（圆形透明底，100×100，水平居中）
  const logoSize = 100;
  const logoX = (W - logoSize) / 2;
  const logoY = 46;
  ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);

  // 4. Logo 与标题间的渐变短线
  const lineGrad = ctx.createLinearGradient(0, 0, 28, 0);
  lineGrad.addColorStop(0, '#22D3EE');
  lineGrad.addColorStop(1, '#818CF8');
  ctx.fillStyle = lineGrad;
  ctx.beginPath();
  ctx.roundRect((W - 28) / 2, 166, 28, 2, 1);
  ctx.fill();

  // 5. 产品名
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 14px "${FONT_FAMILY}"`;
  ctx.fillText('在线客服工作台', W / 2, 192);

  // 6. slogan
  ctx.fillStyle = 'rgba(226,232,240,0.72)';
  ctx.font = `400 10px "${FONT_FAMILY}"`;
  ctx.fillText(slogan, W / 2, 214);

  // 7. 底部四色小点（呼应 logo 四色环）
  const dots = ['#F87171', '#FBBF24', '#60A5FA', '#34D399'];
  const gap = 6;
  const dotsW = dots.length * 5 + (dots.length - 1) * gap;
  let dx = (W - dotsW) / 2 + 2.5;
  for (const color of dots) {
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(dx, 276, 2.5, 0, Math.PI * 2);
    ctx.fill();
    dx += 5 + gap;
  }
  ctx.globalAlpha = 1;

  // 8. 底部英文品牌
  ctx.fillStyle = 'rgba(226,232,240,0.45)';
  ctx.font = `600 8px "${FONT_FAMILY}"`;
  ctx.fillText('G N L   L I V E C H A T', W / 2, 296);

  return canvas;
}

const variants = [
  { name: 'installerSidebar.bmp', slogan: '让每一次沟通更高效' },
  { name: 'uninstallerSidebar.bmp', slogan: '感谢使用 · 期待再会' },
];

for (const v of variants) {
  const canvas = drawSidebar(v.slogan);
  const bmp = encodeBMP24(canvas);
  fs.writeFileSync(path.join(BUILD_DIR, v.name), bmp);
  // PNG 预览
  fs.writeFileSync(path.join('/tmp', v.name.replace('.bmp', '.png')), canvas.toBuffer('image/png'));
  console.log('OK:', v.name, `${bmp.length} bytes`);
}
