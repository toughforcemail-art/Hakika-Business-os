#!/usr/bin/env node
/**
 * Audit Verification Script
 * Scans legacy Real Estate source files and compares discovered interactive
 * controls against the JSON audit inventory.
 *
 * Usage:
 *   node verify-audit.cjs
 *
 * Run from: C:\Users\evince\Projects\Hakika-Business-OS\Docs\migration\real-estate\legacy-audit\scripts\
 *
 * Does NOT modify any files. Read-only scan.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ─── Configuration ────────────────────────────────────────────────────────────

const LEGACY_RE_DIR = path.resolve(
  'C:\\Users\\evince\\Downloads\\omniguard-operations-hub\\frontend\\src\\pages\\real-estate'
);

const AUDIT_DIR = path.resolve(
  'C:\\Users\\evince\\Projects\\Hakika-Business-OS\\Docs\\migration\\real-estate\\legacy-audit'
);

// ─── Load audit inventories ───────────────────────────────────────────────────

function loadJson(filename) {
  const filePath = path.join(AUDIT_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.warn(`  [WARN] Audit file not found: ${filename}`);
    return [];
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const auditedRoutes = loadJson('routes.json');
const auditedActions = loadJson('actions.json');
const auditedForms = loadJson('forms.json');

// ─── Scan legacy source files ─────────────────────────────────────────────────

function getAllTsxFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllTsxFiles(fullPath));
    } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

const legacyFiles = getAllTsxFiles(LEGACY_RE_DIR);

// Patterns to discover
const PATTERNS = {
  buttons: /\bbutton\b.*?onClick/gi,
  links: /<Link\s+to=/gi,
  navigateCalls: /navigate\(['"`]/gi,
  supabaseCalls: /supabase\.(from|rpc|storage|channel)\(/gi,
  edgeFunctions: /invokeEdgeFunction\(['"`]/gi,
  darajaCalls: /callDaraja\(/gi,
  formSubmits: /onSubmit=/gi,
  deleteOps: /\.delete\(\)/gi,
  insertOps: /\.insert\(/gi,
  updateOps: /\.update\(/gi,
  rpcCalls: /\.rpc\(/gi,
};

const discovered = {
  files: [],
  buttons: [],
  links: [],
  navigateCalls: [],
  supabaseCalls: [],
  edgeFunctions: [],
  darajaCalls: [],
  formSubmits: [],
  deleteOps: [],
  insertOps: [],
  updateOps: [],
  rpcCalls: [],
};

for (const filePath of legacyFiles) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relPath = path.relative(LEGACY_RE_DIR, filePath);
  discovered.files.push(relPath);

  for (const [key, pattern] of Object.entries(PATTERNS)) {
    const matches = content.match(pattern) || [];
    if (matches.length > 0) {
      discovered[key].push({ file: relPath, count: matches.length });
    }
  }
}

// ─── Compare against audit ────────────────────────────────────────────────────

const auditedComponentNames = new Set(
  auditedRoutes
    .filter(r => r.component && r.component !== 'REDIRECT')
    .map(r => r.component)
);

const discoveredComponentNames = new Set(
  discovered.files.map(f => {
    const base = path.basename(f, path.extname(f));
    return base;
  })
);

const undocumentedComponents = [...discoveredComponentNames].filter(
  name => !auditedComponentNames.has(name)
);

const documentedButMissing = [...auditedComponentNames].filter(
  name => !discoveredComponentNames.has(name)
);

// ─── Count totals ─────────────────────────────────────────────────────────────

const totalDiscoveredButtons = discovered.buttons.reduce((s, x) => s + x.count, 0);
const totalDiscoveredLinks = discovered.links.reduce((s, x) => s + x.count, 0);
const totalDiscoveredNavigate = discovered.navigateCalls.reduce((s, x) => s + x.count, 0);
const totalDiscoveredSupabase = discovered.supabaseCalls.reduce((s, x) => s + x.count, 0);
const totalDiscoveredEdgeFns = discovered.edgeFunctions.reduce((s, x) => s + x.count, 0);
const totalDiscoveredDaraja = discovered.darajaCalls.reduce((s, x) => s + x.count, 0);
const totalDiscoveredForms = discovered.formSubmits.reduce((s, x) => s + x.count, 0);
const totalDiscoveredDeletes = discovered.deleteOps.reduce((s, x) => s + x.count, 0);
const totalDiscoveredInserts = discovered.insertOps.reduce((s, x) => s + x.count, 0);
const totalDiscoveredUpdates = discovered.updateOps.reduce((s, x) => s + x.count, 0);
const totalDiscoveredRpcs = discovered.rpcCalls.reduce((s, x) => s + x.count, 0);

// ─── Report ───────────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  HAKIKA REAL ESTATE — LEGACY AUDIT VERIFICATION REPORT');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('LEGACY SOURCE DIRECTORY:');
console.log(`  ${LEGACY_RE_DIR}\n`);

console.log('FILES DISCOVERED:');
console.log(`  ${discovered.files.length} .tsx/.ts files in real-estate/\n`);

console.log('INTERACTIVE CONTROLS DISCOVERED (regex scan):');
console.log(`  onClick buttons:     ${totalDiscoveredButtons}`);
console.log(`  <Link to=:          ${totalDiscoveredLinks}`);
console.log(`  navigate() calls:   ${totalDiscoveredNavigate}`);
console.log(`  onSubmit forms:     ${totalDiscoveredForms}`);
console.log('');

console.log('DATA OPERATIONS DISCOVERED:');
console.log(`  supabase.from/rpc:  ${totalDiscoveredSupabase}`);
console.log(`  .insert():          ${totalDiscoveredInserts}`);
console.log(`  .update():          ${totalDiscoveredUpdates}`);
console.log(`  .delete():          ${totalDiscoveredDeletes}`);
console.log(`  .rpc():             ${totalDiscoveredRpcs}`);
console.log(`  invokeEdgeFunction: ${totalDiscoveredEdgeFns}`);
console.log(`  callDaraja():       ${totalDiscoveredDaraja}`);
console.log('');

console.log('AUDIT INVENTORY COUNTS:');
console.log(`  Routes documented:  ${auditedRoutes.length}`);
console.log(`  Actions documented: ${auditedActions.length}`);
console.log(`  Forms documented:   ${auditedForms.length}`);
console.log('');

console.log('COMPONENT COVERAGE:');
console.log(`  Components in source:     ${discoveredComponentNames.size}`);
console.log(`  Components in audit:      ${auditedComponentNames.size}`);
console.log(`  Undocumented components:  ${undocumentedComponents.length}`);
console.log(`  Documented but not found: ${documentedButMissing.length}`);
console.log('');

if (undocumentedComponents.length > 0) {
  console.log('⚠️  UNDOCUMENTED COMPONENTS (source exists, not in audit):');
  for (const name of undocumentedComponents.sort()) {
    console.log(`  - ${name}`);
  }
  console.log('');
}

if (documentedButMissing.length > 0) {
  console.log('⚠️  DOCUMENTED BUT NOT FOUND IN SOURCE:');
  for (const name of documentedButMissing.sort()) {
    console.log(`  - ${name}`);
  }
  console.log('');
}

console.log('FILES WITH MOST BUTTONS (top 10):');
const topButtons = discovered.buttons
  .sort((a, b) => b.count - a.count)
  .slice(0, 10);
for (const { file, count } of topButtons) {
  console.log(`  ${count.toString().padStart(3)}  ${file}`);
}
console.log('');

console.log('FILES WITH MOST SUPABASE CALLS (top 10):');
const topSupabase = discovered.supabaseCalls
  .sort((a, b) => b.count - a.count)
  .slice(0, 10);
for (const { file, count } of topSupabase) {
  console.log(`  ${count.toString().padStart(3)}  ${file}`);
}
console.log('');

// ─── Completeness assessment ──────────────────────────────────────────────────

const coveragePct = Math.round((auditedComponentNames.size / discoveredComponentNames.size) * 100);

console.log('═══════════════════════════════════════════════════════════════');
console.log('  COMPLETENESS ASSESSMENT');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`  Component coverage: ${coveragePct}% (${auditedComponentNames.size}/${discoveredComponentNames.size})`);
console.log(`  Undocumented components: ${undocumentedComponents.length}`);
console.log('');

if (undocumentedComponents.length === 0) {
  console.log('  ✅ All discovered components are documented in the audit.');
} else {
  console.log(`  ❌ ${undocumentedComponents.length} component(s) discovered in source but not documented.`);
  console.log('     These require follow-up audit passes.');
}

console.log('\n  NOTE: This script uses regex pattern matching, not AST analysis.');
console.log('  Counts are approximate. Manual verification required for semantic correctness.');
console.log('═══════════════════════════════════════════════════════════════\n');
