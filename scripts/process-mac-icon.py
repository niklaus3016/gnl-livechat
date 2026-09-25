#!/usr/bin/env python3
"""
将设计师提供的 mac 图标处理为 macOS 规范样式：
- 输入：满画布白底板 PNG（build/icon-mac.png）
- 输出：内容缩放到 80% 居中 + 四周透明边距 + 标准圆角（约 18%）+ 白底板 alpha 拉满
用法：python3 scripts/process-mac-icon.py
"""
import struct, zlib, math, sys

SRC = 'build/icon-mac.png'
DST = 'build/icon-mac.png'

def load_png(path):
    with open(path, 'rb') as f:
        data = f.read()
    w, h = struct.unpack('>II', data[16:24])
    ch = 4 if data[25] == 6 else 3
    pos, idat = 8, b''
    while pos < len(data):
        ln = struct.unpack('>I', data[pos:pos+4])[0]
        if data[pos+4:pos+8] == b'IDAT':
            idat += data[pos+8:pos+8+ln]
        pos += 12 + ln
    raw = zlib.decompress(idat)
    stride = w * ch
    prev = bytearray(stride)
    rows, off = [], 0
    def paeth(a, b, c):
        p = a + b - c
        pa, pb, pc = abs(p-a), abs(p-b), abs(p-c)
        return a if pa <= pb and pa <= pc else (b if pb <= pc else c)
    for y in range(h):
        ft = raw[off]; off += 1
        line = bytearray(raw[off:off+stride]); off += stride
        for x in range(stride):
            a = line[x-ch] if x >= ch else 0
            b = prev[x]
            c = prev[x-ch] if x >= ch else 0
            if ft == 1: line[x] = (line[x] + a) & 255
            elif ft == 2: line[x] = (line[x] + b) & 255
            elif ft == 3: line[x] = (line[x] + (a+b)//2) & 255
            elif ft == 4: line[x] = (line[x] + paeth(a, b, c)) & 255
        rows.append(bytes(line))
        prev = line
    return w, h, ch, rows

def save_png(path, w, h, rows):
    def chunk(tag, payload):
        c = struct.pack('>I', len(payload)) + tag + payload
        return c + struct.pack('>I', zlib.crc32(tag + payload) & 0xffffffff)
    raw = b''.join(b'\x00' + r for r in rows)  # filter type 0
    out = b'\x89PNG\r\n\x1a\n'
    out += chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
    out += chunk(b'IDAT', zlib.compress(raw, 9))
    out += chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(out)

w, h, ch, rows = load_png(SRC)
assert ch == 4, '需要 RGBA PNG'
assert w == h, '需要正方形'

# macOS 规范：内容区约 80.5%（1024 画布图形区 824），圆角约 18%（185/1024）
CONTENT = round(w * 0.805)   # 512 -> 412
MARGIN = (w - CONTENT) // 2  # 50
RADIUS = round(w * 0.18)     # 92

def sample(sx, sy):
    """双线性采样原图"""
    x0, y0 = int(sx), int(sy)
    x1, y1 = min(x0+1, w-1), min(y0+1, h-1)
    fx, fy = sx - x0, sy - y0
    def px(x, y):
        o = x * 4
        return rows[y][o], rows[y][o+1], rows[y][o+2], rows[y][o+3]
    p00, p10, p01, p11 = px(x0,y0), px(x1,y0), px(x0,y1), px(x1,y1)
    return tuple(
        round(p00[i]*(1-fx)*(1-fy) + p10[i]*fx*(1-fy) + p01[i]*(1-fx)*fy + p11[i]*fx*fy)
        for i in range(4)
    )

out = []
half = CONTENT / 2
cx = cy = w / 2
scale = w / CONTENT  # 原图 -> 内容区 的采样比例

for y in range(h):
    line = bytearray(w * 4)
    for x in range(w):
        # 目标像素映射到原图坐标
        sx = (x - MARGIN + 0.5) * scale - 0.5
        sy = (y - MARGIN + 0.5) * scale - 0.5
        if sx < -0.5 or sy < -0.5 or sx > w - 0.5 or sy > h - 0.5:
            continue  # 画布外 = 全透明
        r, g, b, a = sample(sx, sy)
        # 接近白色的底板像素 alpha 拉满（避免深色 Dock 下发灰透亮）
        if r > 240 and g > 240 and b > 240 and a >= 200:
            a = 255
        # 圆角矩形 SDF 蒙版（1px 抗锯齿）
        dx = abs(x + 0.5 - cx) - (half - RADIUS)
        dy = abs(y + 0.5 - cy) - (half - RADIUS)
        d = math.hypot(max(dx, 0), max(dy, 0)) + min(max(dx, dy), 0) - RADIUS
        cover = max(0.0, min(1.0, 0.5 - d))
        a = round(a * cover)
        o = x * 4
        line[o], line[o+1], line[o+2], line[o+3] = r, g, b, a
    out.append(bytes(line))

save_png(DST, w, h, out)
print(f'OK: {DST} 内容区 {CONTENT}px 边距 {MARGIN}px 圆角 {RADIUS}px')
