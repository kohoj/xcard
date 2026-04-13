#!/usr/bin/env node
// Generate icon PNGs using base64-encoded minimal PNG data

const fs = require('fs');
const path = require('path');

// Minimal PNG generator - creates a solid blue square
function createMinimalPNG(size) {
  // For simplicity, we'll use sips command on macOS or create base64 PNGs
  // This is a minimal valid 1x1 blue PNG, we'll scale it
  const bluePNG1x1 = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==',
    'base64'
  );
  return bluePNG1x1;
}

const iconsDir = path.join(__dirname, '..', 'icons');
const sizes = [16, 32, 48, 128];

console.log('Generating placeholder icons...');

sizes.forEach(size => {
  const iconPath = path.join(iconsDir, `icon${size}.png`);
  const pngData = createMinimalPNG(size);
  fs.writeFileSync(iconPath, pngData);
  console.log(`Created ${iconPath}`);
});

console.log('Icons generated successfully!');
