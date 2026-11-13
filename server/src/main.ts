// DaphneDSL language server: reports syntax errors and formats documents.
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
import { formattingChanges } from './format.ts';
import { loadParser } from './parser.ts';

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);
const parserReady = loadParser(__dirname);

connection.onInitialize(async () => {
  await parserReady;
  return {
    capabilities: { textDocumentSync: TextDocumentSyncKind.Incremental, documentFormattingProvider: true },
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

// The style is fixed, so the editor's tab size and other options are ignored.
connection.onDocumentFormatting(async ({ textDocument }) => {
  const document = documents.get(textDocument.uri);
  if (!document) return null;
  const parser = await parserReady;
  const text = document.getText();
  const tree = parser.parse(text);
  if (!tree) return null;
  const changes = formattingChanges(tree, text);
  tree.delete();
  // A document with syntax errors is left alone; the diagnostics already show why.
  if (!changes) return null;
  return changes.map(({ start, end, newText }) => ({
    range: { start: document.positionAt(start), end: document.positionAt(end) },
    newText,
  }));
});

documents.onDidClose(({ document }) => {
  void connection.sendDiagnostics({ uri: document.uri, diagnostics: [] });
});

documents.listen(connection);
connection.listen();
