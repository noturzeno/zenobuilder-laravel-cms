/**
 * Copy package dist/ into an app's public assets folder.
 *
 * Usage:
 *   node scripts/sync-to-app.js /path/to/app/public/assets/zenobuilder
 */
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const target = process.argv[2];

if (!target) {
  console.error('Usage: node scripts/sync-to-app.js <target-directory>');
  process.exit(1);
}

if (!existsSync(dist)) {
  console.error('dist/ not found. Run: npm run prepare');
  process.exit(1);
}

mkdirSync(target, { recursive: true });

for (const file of readdirSync(dist)) {
  cpSync(join(dist, file), join(target, file), { force: true });
}

console.log(`Synced zenobuilder assets to: ${target}`);
