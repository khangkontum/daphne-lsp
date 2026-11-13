// DaphneDSL language server: reports syntax errors.
//
// Run as `node server.cjs --stdio`. The two .wasm files must sit next to the
// bundled server.cjs.

import {
  createConnection,
  DiagnosticSeverity,
  ProposedFeatures,
  TextDocuments,
  TextDocumentSyncKind,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { syntaxProblems } from './diagnostics.ts';
import { loadParser } from './parser.ts';

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);
const parserReady = loadParser(__dirname);

connection.onInitialize(async () => {
  await parserReady;
  return {
    capabilities: { textDocumentSync: TextDocumentSyncKind.Incremental },
    serverInfo: { name: 'daphnedsl-language-server' },
  };
});

// Fires when a document is opened and after each change.
documents.onDidChangeContent(async ({ document }) => {
  const parser = await parserReady;
  // DaphneDSL scripts are small, so parse from scratch on each change.
  const tree = parser.parse(document.getText());
  if (!tree) return;
  const diagnostics = syntaxProblems(tree).map((problem) => ({
    ...problem,
    severity: DiagnosticSeverity.Error,
    source: 'daphnedsl',
  }));
  tree.delete();
  void connection.sendDiagnostics({ uri: document.uri, version: document.version, diagnostics });
});

documents.onDidClose(({ document }) => {
  void connection.sendDiagnostics({ uri: document.uri, diagnostics: [] });
});

documents.listen(connection);
connection.listen();
