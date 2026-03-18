const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpColor(c1, c2, t) {
  return [
    Math.round(lerp(c1[0], c2[0], t)),
    Math.round(lerp(c1[1], c2[1], t)),
    Math.round(lerp(c1[2], c2[2], t)),
    Math.round(lerp(c1[3], c2[3], t)),
  ];
}

function createPNG(w, h, fill) {
  const png = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (w * y + x) * 4;
      png.data[idx] = fill[0];
      png.data[idx + 1] = fill[1];
      png.data[idx + 2] = fill[2];
      png.data[idx + 3] = fill[3];
    }
  }
  return png;
}

function setPixel(png, x, y, color) {
  if (x < 0) return;
  if (y < 0) return;
  if (x >= png.width) return;
  if (y >= png.height) return;
  const idx = (png.width * y + x) * 4;
  png.data[idx] = color[0];
  png.data[idx + 1] = color[1];
  png.data[idx + 2] = color[2];
  png.data[idx + 3] = color[3];
}

function blendPixel(png, x, y, color) {
  if (x < 0) return;
  if (y < 0) return;
  if (x >= png.width) return;
  if (y >= png.height) return;
  const idx = (png.width * y + x) * 4;
  const a = color[3] / 255;
  const inv = 1 - a;
  png.data[idx] = Math.round(color[0] * a + png.data[idx] * inv);
  png.data[idx + 1] = Math.round(color[1] * a + png.data[idx + 1] * inv);
  png.data[idx + 2] = Math.round(color[2] * a + png.data[idx + 2] * inv);
  png.data[idx + 3] = Math.round(255 * (a + (png.data[idx + 3] / 255) * inv));
}

function fillGradient(png, topColor, bottomColor) {
  for (let y = 0; y < png.height; y++) {
    const t = y / (png.height - 1);
    const c = lerpColor(topColor, bottomColor, t);
    for (let x = 0; x < png.width; x++) {
      setPixel(png, x, y, c);
    }
  }
}

function fillRoundedRect(png, x, y, w, h, r, color) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.ceil(x + w);
  const y1 = Math.ceil(y + h);
  const r2 = r * r;
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      let insideCore = false;
      if (xx >= x + r) {
        if (xx < x + w - r) insideCore = true;
      }
      if (yy >= y + r) {
        if (yy < y + h - r) insideCore = true;
      }
      if (insideCore) {
        setPixel(png, xx, yy, color);
        continue;
      }
      const cx = xx < x + r ? x + r : x + w - r;
      const cy = yy < y + r ? y + r : y + h - r;
      const dx = xx - cx;
      const dy = yy - cy;
      if (dx * dx + dy * dy <= r2) {
        setPixel(png, xx, yy, color);
      }
    }
  }
}

function fillCircle(png, cx, cy, r, color) {
  const r2 = r * r;
  const x0 = Math.floor(cx - r);
  const x1 = Math.ceil(cx + r);
  const y0 = Math.floor(cy - r);
  const y1 = Math.ceil(cy + r);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) {
        blendPixel(png, x, y, color);
      }
    }
  }
}

function drawWallet(png, opts) {
  const w = png.width;
  const h = png.height;
  const scale = opts.scale != null ? opts.scale : 1;
  const cx = w / 2;
  const cy = h / 2;
  const walletW = w * 0.58 * scale;
  const walletH = h * 0.38 * scale;
  const x = cx - walletW / 2;
  const y = cy - walletH / 2 + h * 0.02 * scale;
  const radius = walletH * 0.18;

  const base = opts.baseColor != null ? opts.baseColor : [214, 169, 77, 255];
  const shadow = opts.shadowColor != null ? opts.shadowColor : [184, 127, 45, 255];
  const flap = opts.flapColor != null ? opts.flapColor : [237, 199, 111, 255];
  const card = opts.cardColor != null ? opts.cardColor : [248, 237, 210, 255];

  fillRoundedRect(png, x, y, walletW, walletH, radius, base);
  fillRoundedRect(png, x, y + walletH * 0.58, walletW, walletH * 0.42, radius, shadow);

  const cardW = walletW * 0.62;
  const cardH = walletH * 0.32;
  fillRoundedRect(png, x + walletW * 0.12, y - walletH * 0.12, cardW, cardH, cardH * 0.35, card);

  const flapH = walletH * 0.48;
  fillRoundedRect(png, x + walletW * 0.03, y + walletH * 0.08, walletW * 0.82, flapH, flapH * 0.45, flap);

  fillCircle(png, x + walletW * 0.72, y + walletH * 0.33, walletH * 0.055, [84, 60, 24, 255]);
  fillCircle(png, x + walletW * 0.72, y + walletH * 0.33, walletH * 0.03, [238, 227, 203, 255]);
}

function addSoftGlow(png) {
  const w = png.width;
  const h = png.height;
  fillCircle(png, w * 0.25, h * 0.2, w * 0.55, [255, 255, 255, 35]);
  fillCircle(png, w * 0.85, h * 0.85, w * 0.5, [20, 30, 50, 40]);
}

function writePNG(png, outPath) {
  return new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(outPath);
    png.pack().pipe(stream);
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

async function generate() {
  const imagesDir = path.join(__dirname, '..', 'assets', 'images');
  const bgTop = [9, 22, 40, 255];
  const bgBottom = [18, 52, 78, 255];

  const icon = createPNG(1024, 1024, [0, 0, 0, 0]);
  fillGradient(icon, bgTop, bgBottom);
  addSoftGlow(icon);
  drawWallet(icon, { scale: 1 });
  await writePNG(icon, path.join(imagesDir, 'icon.png'));

  const splash = createPNG(1024, 1024, [0, 0, 0, 0]);
  drawWallet(splash, { scale: 0.95 });
  await writePNG(splash, path.join(imagesDir, 'splash-icon.png'));

  const fg = createPNG(1024, 1024, [0, 0, 0, 0]);
  drawWallet(fg, { scale: 0.9 });
  await writePNG(fg, path.join(imagesDir, 'android-icon-foreground.png'));

  const bg = createPNG(1024, 1024, [0, 0, 0, 0]);
  fillGradient(bg, bgTop, bgBottom);
  addSoftGlow(bg);
  await writePNG(bg, path.join(imagesDir, 'android-icon-background.png'));

  const mono = createPNG(1024, 1024, [0, 0, 0, 0]);
  drawWallet(mono, {
    scale: 0.95,
    baseColor: [0, 0, 0, 255],
    shadowColor: [0, 0, 0, 255],
    flapColor: [0, 0, 0, 255],
    cardColor: [0, 0, 0, 255],
  });
  await writePNG(mono, path.join(imagesDir, 'android-icon-monochrome.png'));

  const fav = createPNG(48, 48, [0, 0, 0, 0]);
  fillGradient(fav, bgTop, bgBottom);
  addSoftGlow(fav);
  drawWallet(fav, { scale: 1 });
  await writePNG(fav, path.join(imagesDir, 'favicon.png'));
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
