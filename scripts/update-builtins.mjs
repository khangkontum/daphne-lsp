// Keeps the list of DaphneDSL built-in functions in one place.
//
// data/builtins.txt is the list this repository works from. This script writes
// it into the files that need it: the tree-sitter highlight query, the VS Code
// TextMate grammar and the Vim syntax file.
//
//   node scripts/update-builtins.mjs                   regenerate those files
//   node scripts/update-builtins.mjs --from <daphne>   first re-read the names from a DAPHNE checkout
//   node scripts/update-builtins.mjs --check           fail if a file is out of date (for CI)

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const listPath = join(root, 'data/builtins.txt');
const highlightsPath = join(root, 'queries/daphnedsl/highlights.scm');
const tmLanguagePath = join(root, 'vscode/syntaxes/daphnedsl.tmLanguage.json');
const vimSyntaxPath = join(root, 'syntax/daphnedsl.vim');

const args = process.argv.slice(2);
const check = args.includes('--check');
const fromIndex = args.indexOf('--from');

/** DAPHNE dispatches built-ins by name in one long `if (func == "...")` chain. */
function readNamesFromDaphne(daphneDir) {
  const source = readFileSync(join(daphneDir, 'src/parser/daphnedsl/DaphneDSLBuiltins.cpp'), 'utf8');
  const names = new Set([...source.matchAll(/\bfunc == "(\w+)"/g)].map(match => match[1]));
  if (names.size === 0) throw new Error('found no built-ins; did DaphneDSLBuiltins.cpp change its structure?');
  return [...names].sort();
}

/** Replaces the lines between the BEGIN GENERATED and END GENERATED comments. */
function withGeneratedBlock(current, commentPrefix, block) {
  const begin = `${commentPrefix} BEGIN GENERATED builtins (scripts/update-builtins.mjs)\n`;
  const end = `${commentPrefix} END GENERATED builtins\n`;
  const start = current.indexOf(begin);
  const stop = current.indexOf(end);
  if (start < 0 || stop < start) throw new Error(`missing generated-block markers (${begin.trim()})`);
  return current.slice(0, start + begin.length) + block + current.slice(stop);
}

function highlightsWith(names, current) {
  const block =
    '((call_expr\n' +
    '  !namespace\n' +
    '  function: (identifier) @function.builtin)\n' +
    '  (#any-of? @function.builtin\n' +
    names.map(name => `    "${name}"`).join('\n') +
    '))\n';
  return withGeneratedBlock(current, ';', block);
}

function vimSyntaxWith(names, current) {
  const lines = [];
  for (const name of names) {
    const line = lines.at(-1);
    if (line !== undefined && line.length + name.length < 100) lines[lines.length - 1] = `${line} ${name}`;
    else lines.push(`syn keyword daphnedslBuiltin contained ${name}`);
  }
  return withGeneratedBlock(current, '"', lines.join('\n') + '\n');
}

function tmLanguageWith(names, current) {
  const grammar = JSON.parse(current);
  // Longest first, so that e.g. `sum` cannot shadow `sumCol`-style names.
  const alternatives = [...names].sort((a, b) => b.length - a.length || a.localeCompare(b)).join('|');
  grammar.repository['builtin-function-call'].match =
    `(?<![.\\w])(${alternatives})(?=\\s*(?:::\\s*[A-Za-z_]\\w*\\s*)?\\()`;
  return JSON.stringify(grammar, null, 2) + '\n';
}

const outputs = [];
let names;
if (fromIndex >= 0) {
  names = readNamesFromDaphne(args[fromIndex + 1]);
  outputs.push([listPath, names.join('\n') + '\n']);
} else {
  names = readFileSync(listPath, 'utf8').split('\n').filter(Boolean);
}
outputs.push([highlightsPath, highlightsWith(names, readFileSync(highlightsPath, 'utf8'))]);
outputs.push([tmLanguagePath, tmLanguageWith(names, readFileSync(tmLanguagePath, 'utf8'))]);
outputs.push([vimSyntaxPath, vimSyntaxWith(names, readFileSync(vimSyntaxPath, 'utf8'))]);

const stale = outputs.filter(([path, content]) => readFileSync(path, 'utf8') !== content);
if (check) {
  for (const [path] of stale) console.error(`out of date: ${path}`);
  if (stale.length > 0) console.error('run `node scripts/update-builtins.mjs` and commit the result');
  process.exit(stale.length > 0 ? 1 : 0);
}
for (const [path, content] of stale) {
  writeFileSync(path, content);
  console.log(`updated ${path}`);
}
