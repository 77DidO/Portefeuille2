import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);

let prettier;
try {
  prettier = require('prettier');
} catch (error) {
  console.error('Prettier n\'est pas installé. Ajoutez-le si vous souhaitez utiliser le formatage automatique.');
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const config = await prettier.resolveConfig(process.cwd());

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: npm run format -- <fichiers>');
  process.exit(1);
}

for (const pattern of files) {
  const filePath = resolve(process.cwd(), pattern);
  const source = readFileSync(filePath, 'utf8');
  const formatted = await prettier.format(source, { ...config, filepath: filePath });
  writeFileSync(filePath, formatted);
  console.log(`Formaté : ${filePath}`);
}
