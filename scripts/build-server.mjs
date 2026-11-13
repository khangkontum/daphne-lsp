// Builds the language server into server/dist/: the bundled server.cjs, the
// grammar compiled to WebAssembly, and the tree-sitter runtime.
//
// Usage: node scripts/build-server.mjs

import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const out = join(root, 'server', 'dist');
const require = createRequire(import.meta.url);

mkdirSync(out, { recursive: true });

await build({
  entryPoints: [join(root, 'server', 'src', 'main.ts')],
  // .cjs so that Node runs it as CommonJS wherever it is copied to.
  outfile: join(out, 'server.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  // The package's ES module build reads import.meta.url, which a CommonJS
  // bundle does not have. `require.resolve` picks its CommonJS build.
  alias: { 'web-tree-sitter': require.resolve('web-tree-sitter') },
  logLevel: 'warning',
});

copyFileSync(require.resolve('web-tree-sitter/web-tree-sitter.wasm'), join(out, 'web-tree-sitter.wasm'));

// Downloads the wasi-sdk toolchain on first use.
execFileSync(
  join(root, 'node_modules', '.bin', 'tree-sitter'),
  ['build', '--wasm', '-o', join(out, 'tree-sitter-daphnedsl.wasm')],
  { cwd: root, stdio: 'inherit' },
);
