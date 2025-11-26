const fs = require('fs');
const path = require('path');

const REPORT_PATH = path.resolve(process.cwd(), 'eslint-report.json');

if (!fs.existsSync(REPORT_PATH)) {
  console.error('eslint-report.json not found. Run ESLint with `-f json` and redirect output to eslint-report.json first.');
  process.exit(1);
}

let data;
const raw = fs.readFileSync(REPORT_PATH);
const tryParsers = [
  {enc: 'utf8'},
  {enc: 'utf16le'}, // PowerShell may produce UTF-16 LE
];
let parsed = null;
for (const p of tryParsers) {
  try {
    const text = raw.toString(p.enc).replace(/\uFEFF/g, '');
    // Strip common ANSI escape sequences if any
    const cleaned = text.replace(/\x1B\[[0-9;]*m/g, '');
    parsed = JSON.parse(cleaned);
    break;
  } catch (e) {
    // try next
  }
}
if (!parsed) {
  console.error('Failed to parse eslint-report.json: unsupported encoding or malformed JSON');
  process.exit(1);
}
data = parsed;

if (!Array.isArray(data) || data.length === 0) {
  console.log('No ESLint results to process.');
  process.exit(0);
}

const filesToPatch = {};

for (const fileResult of data) {
  const filePath = fileResult.filePath;
  for (const msg of fileResult.messages || []) {
    if (!msg || !msg.message) continue;
    const m = msg.message.match(/'(.*?)'/);
    if (!m) continue;
    const name = m[1];
    if (!name || name.startsWith('_')) continue; // already prefixed

    // Consider messages that indicate unused variable
    const text = msg.message.toLowerCase();
    if (text.includes('is defined but never used') || text.includes('is assigned a value but never used') || text.includes('is defined but never used') || text.includes('is declared but its value is never read') || text.includes('is never used')) {
      filesToPatch[filePath] = filesToPatch[filePath] || new Set();
      filesToPatch[filePath].add(name);
    }
  }
}

const patchedFiles = [];

for (const [filePath, namesSet] of Object.entries(filesToPatch)) {
  const names = Array.from(namesSet);
  if (!fs.existsSync(filePath)) {
    console.warn('File not found, skipping:', filePath);
    continue;
  }
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // helper to escape names for RegExp
  const escapeForRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  for (const name of names) {
    const pref = `_${name}`;
    const esc = escapeForRegex(name);

    // 1) Array destructuring: replace occurrences inside [...] lists
    // We'll do a conservative replace: find patterns like [ ... name ... ] and replace the standalone name with _name
    content = content.replace(/\[([^\]]*)\]/g, (match, inner) => {
      // split by commas, replace exact token matches
      const parts = inner.split(',');
      const newParts = parts.map(p => {
        const trimmed = p.trim();
        // match exact name (possibly with default e.g. `id = 0` or rest `...id`)
        const regex = new RegExp('(^|\\s|\$)'+name+'($|\\s|=|,|\\])');
        if (new RegExp('(^|\\W)'+esc+'(\\W|$)').test(trimmed)) {
          // replace only exact identifier occurrences
          return p.replace(new RegExp('\\b'+esc+'\\b','g'), pref);
        }
        return p;
      });
      return '[' + newParts.join(',') + ']';
    });

    // 2) Variable declarations: const|let|var name
    content = content.replace(new RegExp('(\\b(?:const|let|var)\\s+)'+esc+'\\b','g'), `$1${pref}`);

    // 3) Function parameters (regular and arrow functions)
    // Replace occurrences in parentheses parameter lists: (a, b, name, c)
    content = content.replace(new RegExp('([\\(,\\s])'+esc+'(\\s*(?:,|\\)|=))','g'), `$1${pref}$2`);

    // 4) Parameter without surrounding (single param arrow functions): name =>
    content = content.replace(new RegExp('(^|[\\n\\r\\t\\s\\(,\\[] )'+esc+'(?=\\s*=>)','g'), `$1${pref}`);

    // 5) For function declarations like function foo(name) { }
    content = content.replace(new RegExp('(function\\s+[A-Za-z0-9_$]+\\s*\\([^\\)]*)\\b'+esc+'\\b','g'), (m0,m1) => m0.replace(new RegExp('\\b'+esc+'\\b','g'), pref));

    // 6) Object destructuring: { a, b: alias, c = default }
    content = content.replace(/\{([^}]*)\}/g, (match, inner) => {
      const parts = inner.split(',');
      const newParts = parts.map(p => {
        const trimmed = p.trim();
        // handle patterns like "a", "a: alias", "a = 1"
        // we only replace the left-hand identifier
        const m = trimmed.match(new RegExp('^('+esc+')(\s*[:=]|\s*$)'));
        if (m) {
          return p.replace(new RegExp('\\b'+esc+'\\b','g'), pref);
        }
        return p;
      });
      return '{' + newParts.join(',') + '}';
    });

    // Note: We intentionally DO NOT replace usages beyond declarations/parameters to avoid accidental renames of real usages.
  }

  if (content !== original) {
    fs.copyFileSync(filePath, filePath + '.bak');
    fs.writeFileSync(filePath, content, 'utf8');
    patchedFiles.push(filePath);
  }
}

if (patchedFiles.length === 0) {
  console.log('No files patched.');
} else {
  console.log('Patched files:');
  patchedFiles.forEach(f => console.log(' -', f));
}

console.log('Done. Review changes and run `npx eslint --fix` if needed.');
