/**
 * Update App.jsx to import data from JSON files instead of inline constants.
 *
 * This script:
 * 1. Removes the inline data constant declarations
 * 2. Adds import statements for JSON files
 * 3. Replaces the inline changelog with a reference to imported data
 */

import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const srcDir = join(rootDir, 'src');
const appJsxPath = join(srcDir, 'App.jsx');

let content = readFileSync(appJsxPath, 'utf-8');
const lines = content.split('\n');

// Define line ranges to remove (0-indexed)
// From the extraction script output:
// SoC: lines 8-47 (0-indexed: 7-46)
// S: line 49 (0-indexed: 48)
// SC: line 50 (0-indexed: 49)
// SB: line 51 (0-indexed: 50)
// DRUGS: lines 53-250 (0-indexed: 52-249)
// EVENTS: lines 252-273 (0-indexed: 251-272)
// JP_OUTLOOK: lines 275-283 (0-indexed: 274-282)
// LANDSCAPE: lines 484-526 (0-indexed: 483-525)
// MOA_CAT_LABELS: lines 528-542 (0-indexed: 527-541)
// STAGE_STYLE: lines 544-550 (0-indexed: 543-549)
// TIMELINE: lines 554-592 (0-indexed: 553-591)
// stColors: line 594 (0-indexed: 593)
// subColors: line 595 (0-indexed: 594)

// Also need to remove comment lines that precede data blocks
// Line 7 (0-indexed 6): // ===== 日本の標準治療 ...
// Line 52 (0-indexed 51): empty line before DRUGS (will be handled)
// Line 552-553 (0-indexed 551-552): comments before TIMELINE

// Strategy: Mark lines to remove, then rebuild.
// We'll also handle blank lines and comments that only relate to removed data.

const removeRanges = [
  // SoC block + preceding comment
  [6, 46],    // line 7-47 (comment + SoC array)
  [48, 50],   // lines 49-51 (S, SC, SB)
  [51, 51],   // line 52 (blank line)
  [52, 249],  // lines 53-250 (DRUGS array)
  [250, 250], // blank line after DRUGS
  [251, 272], // lines 252-273 (EVENTS)
  [273, 273], // blank line
  [274, 282], // lines 275-283 (JP_OUTLOOK)
  [483, 525], // lines 484-526 (LANDSCAPE)
  [526, 526], // blank line
  [527, 541], // lines 528-542 (MOA_CAT_LABELS)
  [542, 542], // blank line
  [543, 549], // lines 544-550 (STAGE_STYLE)
  [550, 550], // blank line
  [551, 552], // comment lines before TIMELINE
  [553, 591], // lines 554-592 (TIMELINE)
  [592, 592], // blank line
  [593, 594], // lines 594-595 (stColors, subColors)
];

// Mark lines for removal
const toRemove = new Set();
for (const [start, end] of removeRanges) {
  for (let i = start; i <= end; i++) {
    toRemove.add(i);
  }
}

// Verify we're removing the right things
const checkPoints = [
  [6, '// ===== 日本の標準治療'],
  [7, 'const SoC'],
  [46, '];'],
  [48, 'const S ='],
  [49, 'const SC ='],
  [50, 'const SB ='],
  [52, 'const DRUGS ='],
  [249, '];'],
  [251, 'const EVENTS ='],
  [272, '];'],
  [274, 'const JP_OUTLOOK ='],
  [282, '];'],
  [483, 'const LANDSCAPE ='],
  [525, '];'],
  [527, 'const MOA_CAT_LABELS ='],
  [541, '};'],
  [543, 'const STAGE_STYLE ='],
  [549, '};'],
  [553, 'const TIMELINE ='],
  [591, '];'],
  [593, 'const stColors ='],
  [594, 'const subColors ='],
];

let errors = [];
for (const [lineIdx, prefix] of checkPoints) {
  if (!lines[lineIdx].trimStart().startsWith(prefix.trim())) {
    errors.push(`Line ${lineIdx + 1}: expected "${prefix}", got "${lines[lineIdx].substring(0, 60)}"`);
  }
}

if (errors.length > 0) {
  console.error('Verification errors:');
  errors.forEach(e => console.error('  ' + e));
  process.exit(1);
}

console.log('All checkpoints verified.');

// Build the import block
const importBlock = `
import SoC from "./data/standard-treatments.json";
import DRUGS from "./data/drugs.json";
import EVENTS from "./data/events.json";
import JP_OUTLOOK from "./data/jp-outlook.json";
import LANDSCAPE from "./data/landscape.json";
import TIMELINE from "./data/timeline.json";
import CHANGELOG from "./data/changelog.json";
import _constants from "./data/constants.json";
const { S, SC, SB, MOA_CAT_LABELS, STAGE_STYLE, stColors, subColors } = _constants;
`.trim();

// Build new file
const newLines = [];
let insertedImports = false;

for (let i = 0; i < lines.length; i++) {
  if (toRemove.has(i)) {
    // Insert imports right after the first removed block (line 6)
    if (!insertedImports && i === 6) {
      newLines.push(importBlock);
      newLines.push('');
      insertedImports = true;
    }
    continue;
  }
  newLines.push(lines[i]);
}

// Now replace the inline changelog with CHANGELOG reference
let newContent = newLines.join('\n');

// Replace the inline changelog array with CHANGELOG variable
// The pattern is: {[ {ver:"1.0"...} ].map((log,i)=>
// We need to replace { [inline array].map with { CHANGELOG.map
const changelogPattern = /\{\[\s*\n\s*\{ver:"1\.0"[\s\S]*?\],?\s*\},?\s*\n\s*\]\.map\(\(log,i\)/;
const changelogReplacement = '{CHANGELOG.map((log,i)';
newContent = newContent.replace(changelogPattern, changelogReplacement);

// Verify the replacement happened
if (!newContent.includes('CHANGELOG.map')) {
  console.error('WARNING: Changelog replacement did not match. Trying alternative pattern...');
  // Try a broader pattern
  const alt = /\{\[\n\s+\{ver:"1\.0".*?\n(?:.*?\n)*?\s+\]\.map\(\(log,i\)/;
  newContent = newContent.replace(alt, '{CHANGELOG.map((log,i)');
  if (!newContent.includes('CHANGELOG.map')) {
    console.error('ERROR: Could not replace changelog inline data.');
  }
}

writeFileSync(appJsxPath, newContent, 'utf-8');
console.log('App.jsx updated successfully.');
console.log(`Removed ${toRemove.size} lines, added ${importBlock.split('\n').length} import lines.`);
