// Builds the VS Code extension: bundles the language client into
// vscode/dist/extension.js and copies the built language server
// (server/dist/, from scripts/build-server.mjs) into vscode/server/.
//
// Usage: node scripts/build-vscode.mjs

import { cpSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const extension = join(root, 'vscode');

await build({
  entryPoints: [join(extension, 'src', 'extension.ts')],
  outfile: join(extension, 'dist', 'extension.js'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  // Provided by VS Code at run time.
  external: ['vscode'],
  logLevel: 'warning',
});

rmSync(join(extension, 'server'), { recursive: true, force: true });
cpSync(join(root, 'server', 'dist'), join(extension, 'server'), { recursive: true });
