#!/usr/bin/env node

/**
 * Deploy Script - CaixaFácil
 *
 * Uso: node scripts/deploy.mjs [--message "msg"]
 *
 * Faz:
 * 1. Incrementa a versão no version.ts
 * 2. Faz commit e push para main e master
 * 3. Dispara deploy no Vercel
 * 4. Aguarda o build e mostra a versão final
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync } from 'child_process';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const args = process.argv.slice(2);
const msgIndex = args.indexOf('--message');
const customMsg = msgIndex !== -1 ? args[msgIndex + 1] : '';

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
if (!VERCEL_TOKEN) {
  console.error('❌ Defina VERCEL_TOKEN: export VERCEL_TOKEN=seu_token_aqui');
  process.exit(1);
}
const PROJECT_NAME = 'caixafacil';

// ==================== STEP 1: Bump Version ====================
console.log('\n📦 Step 1: Incrementando versão...');

const versionFile = join(__dirname, '..', 'src', 'lib', 'version.ts');
let content = readFileSync(versionFile, 'utf-8');

const match = content.match(/VERSION_STRING\s*=\s*'(\d+)\.(\d+)\.(\d+)\.(\d+)'/);
if (!match) {
  console.error('❌ Could not parse VERSION_STRING');
  process.exit(1);
}

const [, major, minor, patch, build] = match.map(Number);
const newBuild = build + 1;
const today = new Date().toISOString().slice(0, 10);
const versionStr = `${major}.${minor}.${patch}.${newBuild}`;
const versionDisplay = `v${versionStr}`;

content = content
  .replace(/VERSION_STRING\s*=\s*'\d+\.\d+\.\d+\.\d+'/, `VERSION_STRING = '${versionStr}'`)
  .replace(/VERSION_DISPLAY\s*=\s*'v[\d.]+'/, `VERSION_DISPLAY = '${versionDisplay}'`)
  .replace(/LAST_DEPLOY\s*=\s*'\d{4}-\d{2}-\d{2}'/, `LAST_DEPLOY = '${today}'`)
  .replace(/VERSION_WITH_DATE\s*=\s*'v[\d.]+ \(\d{4}-\d{2}-\d{2}\)'/, `VERSION_WITH_DATE = '${versionDisplay} (${today})'`);

writeFileSync(versionFile, content, 'utf-8');
console.log(`   ✅ Versão: ${versionDisplay} (${today})`);

// ==================== STEP 2: Git Commit & Push ====================
console.log('\n📦 Step 2: Commit e push...');

const commitMsg = customMsg || `chore: bump version to ${versionDisplay}`;
execSync('git add -A', { cwd: rootDir, stdio: 'pipe' });

try {
  execSync(`git commit -m "${commitMsg}"`, { cwd: rootDir, stdio: 'pipe' });
  console.log(`   ✅ Commit: ${commitMsg}`);
} catch {
  console.log('   ℹ️  Nenhuma mudança para commitar (versão já atualizada)');
}

try {
  execSync('git push origin main', { cwd: rootDir, stdio: 'pipe' });
  execSync('git push origin main:master', { cwd: rootDir, stdio: 'pipe' });
  console.log('   ✅ Push para main e master');
} catch (e) {
  console.error('   ❌ Erro no push:', e.message);
  process.exit(1);
}

// ==================== STEP 3: Trigger Vercel Deploy ====================
console.log('\n📦 Step 3: Disparando deploy no Vercel...');

// Pegar SHA do commit atual
let sha;
try {
  sha = execSync('git rev-parse HEAD', { cwd: rootDir, encoding: 'utf-8' }).trim();
} catch {
  sha = '';
}

function httpsPost(urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: 'api.vercel.com',
      path: urlPath,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch { reject(new Error(body)); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function httpsGet(urlPath) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.vercel.com',
      path: urlPath,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${VERCEL_TOKEN}` },
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch { reject(new Error(body)); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

try {
  const deploy = await httpsPost('/v13/deployments', {
    name: PROJECT_NAME,
    gitSource: { type: 'github', repoId: 1187713066, ref: 'main', sha },
  });
  const deployId = deploy.id || deploy.uid;
  if (!deployId) {
    console.error('   ❌ Resposta inesperada:', JSON.stringify(deploy));
    process.exit(1);
  }
  console.log(`   ✅ Deploy disparado: ${deployId}`);

  // ==================== STEP 4: Aguardar build ====================
  console.log('\n📦 Step 4: Aguardando build...');

  const startTime = Date.now();
  const TIMEOUT = 5 * 60 * 1000; // 5 min
  let ready = false;

  while (!ready && (Date.now() - startTime) < TIMEOUT) {
    await new Promise(r => setTimeout(r, 10000)); // poll a cada 10s
    try {
      const status = await httpsGet(`/v13/deployments/${deployId}`);
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const state = status.state || status.readyState || 'building';

      if (state === 'READY' || status.readyState === 3) {
        ready = true;
        console.log(`   ✅ Build pronto em ${elapsed}s`);

        // Versão final
        console.log('');
        console.log('╔══════════════════════════════════════╗');
        console.log(`║  BUILD OK  │  ${versionDisplay.padEnd(17)}║`);
        console.log(`║  Data      │  ${today.padEnd(17)}║`);
        console.log(`║  Deploy ID │  ${deployId.padEnd(17)}║`);
        console.log('╚══════════════════════════════════════╝');
        console.log('');
      } else if (state === 'ERROR' || status.error) {
        console.error(`   ❌ Build falhou: ${status.error || state}`);
        process.exit(1);
      } else {
        process.stdout.write(`   ⏳  ${state}... (${elapsed}s)\r`);
      }
    } catch {
      // continuação do poll
    }
  }

  if (!ready) {
    console.error('   ❌ Timeout aguardando build (5 min)');
    console.log('');
    console.log(`Versão: ${versionDisplay} (${today})`);
    console.log(`Deploy: https://vercel.com/deployments (verificar manualmente)`);
    console.log('');
  }
} catch (e) {
  console.error('   ❌ Erro no deploy:', e.message);
  console.log('');
  console.log(`Versão: ${versionDisplay} (${today})`);
  console.log('Deploy: verificar manualmente no Vercel');
  console.log('');
}
