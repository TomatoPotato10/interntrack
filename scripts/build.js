// scripts/build.js
// Copies web assets to the www/ directory for Capacitor to bundle into native apps.

import { mkdirSync, copyFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const wwwDir = join(projectRoot, 'www');

// Web assets to copy
const assets = [
  'index.html',
  'index.css',
  'app.js',
  'firebase-config.js'
];

// Ensure www/ directory exists
if (!existsSync(wwwDir)) {
  mkdirSync(wwwDir, { recursive: true });
}

// Copy each asset
assets.forEach(file => {
  const src = join(projectRoot, file);
  const dest = join(wwwDir, file);
  
  if (existsSync(src)) {
    copyFileSync(src, dest);
    console.log(`  ✓ Copied ${file}`);
  } else {
    console.warn(`  ⚠ File not found: ${file}`);
  }
});

console.log(`\n✅ Build complete — ${assets.length} files copied to www/`);
