const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'src');
const exts = ['.ts', '.tsx'];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (exts.includes(path.extname(entry.name))) processFile(full);
  }
}

function processFile(file) {
  let src = fs.readFileSync(file, 'utf8');
  const original = src;

  // Patterns to replace common unused parameter names when they appear in parameter lists
  // Replace (e) -> (_e), (e: Type) -> (_e: Type), e => -> _e =>, (value) -> (_value)

  // Avoid replacing property accesses like obj.e by focusing on patterns with parentheses or arrow params
  src = src.replace(/\(\s*e\s*\)/g, '(_e)');
  src = src.replace(/\(\s*e\s*:\s*([^\)]+)\)/g, '(_e: $1)');
  src = src.replace(/([\s,(])e\s*=>/g, '$1_e =>');
  src = src.replace(/\(\s*value\s*\)/g, '(_value)');
  src = src.replace(/\(\s*value\s*:\s*([^\)]+)\)/g, '(_value: $1)');
  src = src.replace(/([\s,(])value\s*=>/g, '$1_value =>');
  src = src.replace(/\(\s*id\s*\)/g, '(_id)');
  src = src.replace(/\(\s*id\s*:\s*([^\)]+)\)/g, '(_id: $1)');
  src = src.replace(/([\s,(])id\s*=>/g, '$1_id =>');

  // Replace common event param names `event` -> `_event` and `evt` -> `_evt`
  src = src.replace(/\(\s*event\s*\)/g, '(_event)');
  src = src.replace(/\(\s*event\s*:\s*([^\)]+)\)/g, '(_event: $1)');
  src = src.replace(/([\s,(])event\s*=>/g, '$1_event =>');
  src = src.replace(/\(\s*evt\s*\)/g, '(_evt)');
  src = src.replace(/([\s,(])evt\s*=>/g, '$1_evt =>');

  if (src !== original) {
    fs.writeFileSync(file, src, 'utf8');
    console.log('Patched', file);
  }
}

walk(root);
console.log('Done');
