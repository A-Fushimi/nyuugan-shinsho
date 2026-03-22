/**
 * Extract data constants from App.jsx into separate JSON files.
 *
 * Strategy: Read App.jsx, use regex to find each const block,
 * eval the JS expression, then JSON.stringify to files.
 */

import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const srcDir = join(rootDir, 'src');
const dataDir = join(srcDir, 'data');

const appJsx = readFileSync(join(srcDir, 'App.jsx'), 'utf-8');
const lines = appJsx.split('\n');

/**
 * Extract a const declaration that is an array or object.
 * Finds "const NAME = [...];" or "const NAME = {...};"
 * by tracking bracket depth.
 */
function extractConst(name) {
  const startPattern = new RegExp(`^const ${name}\\s*=\\s*`);
  let startLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (startPattern.test(lines[i])) {
      startLine = i;
      break;
    }
  }
  if (startLine === -1) throw new Error(`Could not find const ${name}`);

  // Get the text starting from the = sign
  const firstLine = lines[startLine].replace(startPattern, '');

  // Find the opening bracket
  const openChar = firstLine.trim()[0]; // [ or {
  const closeChar = openChar === '[' ? ']' : '}';

  let depth = 0;
  let endLine = -1;
  let collecting = false;

  for (let i = startLine; i < lines.length; i++) {
    const line = i === startLine ? firstLine : lines[i];
    for (const ch of line) {
      if (ch === openChar || ch === '{' || ch === '[') depth++;
      if (ch === closeChar || ch === '}' || ch === ']') depth--;
      if (depth > 0) collecting = true;
      if (collecting && depth === 0) {
        endLine = i;
        break;
      }
    }
    if (endLine !== -1) break;
  }

  if (endLine === -1) throw new Error(`Could not find end of const ${name}`);

  // Actually, the bracket counting above is wrong because it treats
  // all brackets equally. Let's use a simpler approach:
  // just track the depth of the OUTERMOST bracket type.
  return { startLine, endLine };
}

/**
 * Better extraction: get the raw JS text of a const value and eval it.
 */
function extractConstValue(name) {
  const startPattern = new RegExp(`^const ${name}\\s*=\\s*`);
  let startLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (startPattern.test(lines[i])) {
      startLine = i;
      break;
    }
  }
  if (startLine === -1) throw new Error(`Could not find const ${name}`);

  // Get text from the = sign to the end, tracking bracket depth
  const afterEquals = lines[startLine].replace(startPattern, '');
  let text = afterEquals;

  // Determine opening bracket
  const trimmed = afterEquals.trim();
  const openChar = trimmed[0];

  if (openChar !== '[' && openChar !== '{') {
    // It's a simple value or object on same line
    // Find the ; at the end
    const fullLine = lines[startLine];
    const match = fullLine.match(new RegExp(`^const ${name}\\s*=\\s*(.+);\\s*$`));
    if (match) {
      return { value: match[1], startLine, endLine: startLine };
    }
    throw new Error(`Cannot parse single-line const ${name}`);
  }

  const closeChar = openChar === '[' ? ']' : '}';

  // Track depth properly - count ALL openers/closers
  let depth = 0;
  let endLine = -1;
  let result = '';
  let inString = false;
  let stringChar = '';
  let escaped = false;

  for (let i = startLine; i < lines.length; i++) {
    const line = i === startLine ? afterEquals : lines[i];
    result += (i === startLine ? '' : '\n') + line;

    for (let j = 0; j < line.length; j++) {
      const ch = line[j];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (ch === '\\' && inString) {
        escaped = true;
        continue;
      }

      if (inString) {
        if (ch === stringChar) inString = false;
        continue;
      }

      if (ch === '"' || ch === "'" || ch === '`') {
        inString = true;
        stringChar = ch;
        continue;
      }

      // Skip line comments
      if (ch === '/' && j + 1 < line.length && line[j + 1] === '/') {
        break; // rest of line is comment
      }

      if (ch === '[' || ch === '{' || ch === '(') depth++;
      if (ch === ']' || ch === '}' || ch === ')') depth--;

      if (depth === 0 && (ch === ']' || ch === '}')) {
        endLine = i;
        break;
      }
    }
    if (endLine !== -1) break;
  }

  if (endLine === -1) throw new Error(`Could not find end of const ${name}`);

  // Clean up: remove trailing ; and whitespace
  result = result.replace(/;\s*$/, '').trim();

  return { value: result, startLine, endLine };
}

function evalJS(jsText) {
  // Wrap in parentheses to make it an expression
  const fn = new Function(`return (${jsText});`);
  return fn();
}

function writeJSON(filename, data) {
  const path = join(dataDir, filename);
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  console.log(`  Written: src/data/${filename} (${JSON.stringify(data).length} bytes)`);
}

// Extract all constants
console.log('Extracting data from App.jsx...\n');

const extractions = [
  { name: 'SoC', file: 'standard-treatments.json' },
  { name: 'DRUGS', file: 'drugs.json' },
  { name: 'EVENTS', file: 'events.json' },
  { name: 'JP_OUTLOOK', file: 'jp-outlook.json' },
  { name: 'LANDSCAPE', file: 'landscape.json' },
  { name: 'TIMELINE', file: 'timeline.json' },
  { name: 'MOA_CAT_LABELS', file: null }, // will go into constants.json
  { name: 'STAGE_STYLE', file: null },
  { name: 'stColors', file: null },
  { name: 'subColors', file: null },
  { name: 'S', file: null },
  { name: 'SC', file: null },
  { name: 'SB', file: null },
];

const lineRanges = {};
const constants = {};

for (const { name, file } of extractions) {
  try {
    const { value, startLine, endLine } = extractConstValue(name);
    const data = evalJS(value);
    lineRanges[name] = { startLine, endLine };

    if (file) {
      writeJSON(file, data);
    } else {
      constants[name] = data;
    }

    console.log(`  ${name}: lines ${startLine + 1}-${endLine + 1}`);
  } catch (e) {
    console.error(`  ERROR extracting ${name}: ${e.message}`);
  }
}

// Write constants.json
writeJSON('constants.json', constants);

// Extract changelog from inline JSX
// Find the changelog array inline in the Dashboard component
console.log('\nExtracting changelog...');
const changelogMatch = appJsx.match(/tab==="changelog"[\s\S]*?\{(\[[\s\S]*?\])\}\.map\(\(log,i\)/);
if (changelogMatch) {
  try {
    const changelogData = evalJS(changelogMatch[1]);
    writeJSON('changelog.json', changelogData);
    console.log('  Changelog extracted successfully');
  } catch (e) {
    console.error(`  ERROR extracting changelog: ${e.message}`);
  }
}

console.log('\nLine ranges for removal:');
for (const [name, range] of Object.entries(lineRanges)) {
  console.log(`  ${name}: lines ${range.startLine + 1} to ${range.endLine + 1}`);
}

console.log('\nDone! Now update App.jsx to import from JSON files.');
