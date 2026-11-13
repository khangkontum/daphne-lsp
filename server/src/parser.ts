import { join } from 'node:path';
import { Language, Parser } from 'web-tree-sitter';

/**
 * Loads the DaphneDSL parser. `wasmDirectory` holds `web-tree-sitter.wasm`
 * (the tree-sitter runtime) and `tree-sitter-daphnedsl.wasm` (the grammar).
 */
export async function loadParser(wasmDirectory: string): Promise<Parser> {
  await Parser.init({ locateFile: (file: string) => join(wasmDirectory, file) });
  const parser = new Parser();
  parser.setLanguage(await Language.load(join(wasmDirectory, 'tree-sitter-daphnedsl.wasm')));
  return parser;
}
