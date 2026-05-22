/**
 * Ensures dist/ mirrors src/ (v1 ships unminified source as dist).
 */
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');
const dist = join(root, 'dist');

if (!existsSync(src)) {
  console.error('src/ not found');
  process.exit(1);
}

mkdirSync(dist, { recursive: true });

for (const file of readdirSync(src)) {
  cpSync(join(src, file), join(dist, file), { force: true });
}

console.log('dist/ updated from src/');
