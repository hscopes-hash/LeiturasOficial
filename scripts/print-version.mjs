#!/usr/bin/env node

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const versionFile = join(__dirname, '..', 'src', 'lib', 'version.ts');
const content = readFileSync(versionFile, 'utf-8');

const displayMatch = content.match(/VERSION_DISPLAY\s*=\s*'(.*?)'/);
const dateMatch = content.match(/LAST_DEPLOY\s*=\s*'(.*?)'/);

const version = displayMatch ? displayMatch[1] : 'unknown';
const date = dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10);

console.log('');
console.log('=============================');
console.log(`  BUILD OK | ${version} (${date})`);
console.log('=============================');
console.log('');
