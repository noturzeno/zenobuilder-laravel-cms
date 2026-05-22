/**
 * Copy package dist/ into a Laravel (or static) app's public assets folder.
 *
 * Usage (from packages/zenobuilder):
 *   node scripts/sync-to-app.js
 *   node scripts/sync-to-app.js /path/to/app/public/assets/zenobuilder
 */
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

const defaultTarget = join(root, '..', '..', 'public', 'assets', 'zenobuilder');
const target = process.argv[2] ? process.argv[2] : defaultTarget;

if (!existsSync(dist)) {
  console.error('dist/ not found. Run: npm run prepare');
  process.exit(1);
}

mkdirSync(target, { recursive: true });

for (const file of readdirSync(dist)) {
  cpSync(join(dist, file), join(target, file), { force: true });
}

console.log(`Synced zenobuilder assets to: ${target}`);
