// Starts the DaphneDSL language server for DaphneDSL documents. VS Code runs
// the server with its own Node.js, so users do not need to install one.

import type { ExtensionContext } from 'vscode';
import { LanguageClient, TransportKind } from 'vscode-languageclient/node';

let client: LanguageClient | undefined;

export async function activate(context: ExtensionContext): Promise<void> {
  client = new LanguageClient(
    'daphnedsl',
    'DaphneDSL',
    { module: context.asAbsolutePath('server/server.cjs'), transport: TransportKind.ipc },
    { documentSelector: [{ language: 'daphnedsl' }] },
  );
  await client.start();
}

export function deactivate(): Promise<void> | undefined {
  return client?.stop();
}
