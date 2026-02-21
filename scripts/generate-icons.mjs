import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const svgPath = path.join(__dirname, '..', 'public', 'logo.svg');
const iconsDir = path.join(__dirname, '..', 'src-tauri', 'icons');

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// All sizes needed for Windows + Tauri
const sizes = [
  { name: '16x16.png', size: 16 },   // Window titlebar icon
  { name: '24x24.png', size: 24 },   // Small taskbar icon
  { name: '32x32.png', size: 32 },   // Standard icon
  { name: '48x48.png', size: 48 },   // Large taskbar icon
  { name: '64x64.png', size: 64 },   // Custom cursor
  { name: '128x128.png', size: 128 },
  { name: '128x128@2x.png', size: 256 }, // High-DPI / Alt-Tab
  { name: 'icon.png', size: 512 },   // Store / large display
];

// Sizes to embed in the .ico file (Windows uses these at different contexts)
const icoSizes = [16, 24, 32, 48, 64, 128, 256];

async function generateIcons() {
  const svgBuffer = fs.readFileSync(svgPath);

  // Generate all PNG sizes
  for (const { name, size } of sizes) {
    const outputPath = path.join(iconsDir, name);
    await sharp(svgBuffer, { density: Math.max(300, size * 4) })
      .resize(size, size, {
        kernel: sharp.kernel.lanczos3,
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png({ compressionLevel: 9 })
      .toFile(outputPath);
    console.log(`Generated ${name} (${size}x${size})`);
  }

  // Generate multi-resolution ICO from all ico sizes
  const icoPngs = [];
  for (const size of icoSizes) {
    const pngPath = path.join(iconsDir, `${size}x${size}.png`);
    // Some sizes may not have a dedicated file, generate them as temp
    if (!fs.existsSync(pngPath)) {
      await sharp(svgBuffer, { density: Math.max(300, size * 4) })
        .resize(size, size, {
          kernel: sharp.kernel.lanczos3,
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png({ compressionLevel: 9 })
        .toFile(pngPath);
      console.log(`Generated ${size}x${size}.png (for ICO)`);
    }
    icoPngs.push(pngPath);
  }

  const icoBuffer = await pngToIco(icoPngs);
  fs.writeFileSync(path.join(iconsDir, 'icon.ico'), icoBuffer);
  console.log('Generated icon.ico (multi-resolution: ' + icoSizes.join(', ') + ')');

  // Also copy the SVG for reference
  fs.copyFileSync(svgPath, path.join(iconsDir, 'icon.svg'));
  console.log('Copied icon.svg');

  console.log('\nIcon generation complete!');
}

generateIcons().catch(console.error);
