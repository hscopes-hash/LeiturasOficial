#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const versionFile = join(__dirname, '..', 'src', 'lib', 'version.ts');

const content = readFileSync(versionFile, 'utf-8');

// Match current version: MAJOR.MINOR.PATCH.BUILD
const match = content.match(/VERSION_STRING\s*=\s*'(\d+)\.(\d+)\.(\d+)\.(\d+)'/);
if (!match) {
  console.error('❌ Could not parse VERSION_STRING from version.ts');
  process.exit(1);
}

const [, major, minor, patch, build] = match.map(Number);
const newBuild = build + 1;
const today = new Date().toISOString().slice(0, 10);

const versionStr = `${major}.${minor}.${patch}.${newBuild}`;
const versionDisplay = `v${versionStr}`;

const newContent = content
  .replace(/VERSION_STRING\s*=\s*'\d+\.\d+\.\d+\.\d+'/, `VERSION_STRING = '${versionStr}'`)
  .replace(/VERSION_DISPLAY\s*=\s*'v[\d.]+'/, `VERSION_DISPLAY = '${versionDisplay}'`)
  .replace(/LAST_DEPLOY\s*=\s*'\d{4}-\d{2}-\d{2}'/, `LAST_DEPLOY = '${today}'`)
  .replace(/VERSION_WITH_DATE\s*=\s*'v[\d.]+ \(\d{4}-\d{2}-\d{2}\)'/, `VERSION_WITH_DATE = '${versionDisplay} (${today})'`);

writeFileSync(versionFile, newContent, 'utf-8');

console.log(`⚡ Version bumped: ${versionDisplay} (${today})`);
