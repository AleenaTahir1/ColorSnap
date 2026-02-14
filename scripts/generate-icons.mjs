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

const sizes = [
  { name: '32x32.png', size: 32 },
  { name: '48x48.png', size: 48 },
  { name: '64x64.png', size: 64 },
  { name: '128x128.png', size: 128 },
  { name: '128x128@2x.png', size: 256 },
  { name: 'icon.png', size: 512 },
];

async function generateIcons() {
  const svgBuffer = fs.readFileSync(svgPath);

  for (const { name, size } of sizes) {
    const outputPath = path.join(iconsDir, name);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`Generated ${name}`);
  }

  // Generate multi-resolution ICO file (Windows)
  const icoSources = [
    path.join(iconsDir, '32x32.png'),
    path.join(iconsDir, '48x48.png'),
    path.join(iconsDir, '64x64.png'),
    path.join(iconsDir, '128x128.png'),
    path.join(iconsDir, '128x128@2x.png'),
  ];
  const icoBuffer = await pngToIco(icoSources);
  fs.writeFileSync(path.join(iconsDir, 'icon.ico'), icoBuffer);
  console.log('Generated icon.ico (multi-resolution)');

  console.log('Icon generation complete!');
}

generateIcons().catch(console.error);
