#!/usr/bin/env node

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const versionFile = join(__dirname, '..', 'src', 'lib', 'version.ts');
const content = readFileSync(versionFile, 'utf-8');

const match = content.match(/VERSION_WITH_DATE\s*=\s*'(.*?)'/);
if (!match) {
  console.error('❌ Could not parse VERSION_WITH_DATE from version.ts');
  process.exit(1);
}

console.log('');
console.log('══════════════════════════════════════════');
console.log(`  📦 Build finalizado - ${match[1]}`);
console.log('══════════════════════════════════════════');
console.log('');
