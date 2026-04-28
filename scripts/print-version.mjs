#!/usr/bin/env node

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const versionFile = join(__dirname, '..', 'src', 'lib', 'version.ts');
const content = readFileSync(versionFile, 'utf-8');

// Extrair versao
const matchVersion = content.match(/VERSION_STRING\s*=\s*'(\d+)\.(\d+)\.(\d+)\.(\d+)'/);
const matchDate = content.match(/LAST_DEPLOY\s*=\s*'(.*?)'/);
if (!matchVersion) {
  console.error('Could not parse VERSION_STRING from version.ts');
  process.exit(1);
}

const [, major, minor, patch, build] = matchVersion.map(Number);
const today = matchDate ? matchDate[1] : new Date().toISOString().slice(0, 10);
const versionDisplay = `v${major}.${minor}.${patch}.${build}`;

// Tentar obter o diff do ultimo commit (se houver git)
let lastCommit = '';
let changedFiles = '';
try {
  lastCommit = execSync('git log -1 --oneline --format="%s" 2>/dev/null', { encoding: 'utf-8' }).trim();
} catch { /* sem git */ }

try {
  changedFiles = execSync('git diff --name-only HEAD~1 HEAD 2>/dev/null', { encoding: 'utf-8' }).trim();
  if (changedFiles) {
    changedFiles = changedFiles
      .split('\n')
      .map(f => `  - ${f}`)
      .join('\n');
  }
} catch { /* sem git ou primeiro commit */ }

// Tentar obter commits recentes para changelog
let recentCommits = '';
try {
  recentCommits = execSync('git log -5 --oneline 2>/dev/null', { encoding: 'utf-8' }).trim();
  if (recentCommits) {
    recentCommits = '\n  ' + recentCommits.split('\n').join('\n  ');
  }
} catch { /* sem git */ }

console.log('');
console.log('══════════════════════════════════════════════════════════════');
console.log(`  BUILD CONCLUIDO - CaixaFacil ${versionDisplay}`);
console.log(`  Data: ${today}`);
console.log('══════════════════════════════════════════════════════════════');

if (lastCommit) {
  console.log('');
  console.log(`  Commit: ${lastCommit}`);
}

if (changedFiles) {
  console.log('');
  console.log('  Arquivos alterados:');
  console.log(changedFiles);
}

if (recentCommits) {
  console.log('');
  console.log('  Ultimos commits:');
  console.log(recentCommits);
}

console.log('');
console.log('══════════════════════════════════════════════════════════════');
console.log('');
