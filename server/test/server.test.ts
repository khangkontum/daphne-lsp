// Talks to the built server over stdio, the way an editor does.

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import lsp from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

const serverPath = fileURLToPath(new URL('../dist/server.cjs', import.meta.url));

/** Starts the server and completes the initialize handshake. */
async function startServer() {
  const server = spawn(process.execPath, [serverPath, '--stdio'], { stdio: ['pipe', 'pipe', 'inherit'] });
  const connection = lsp.createProtocolConnection(
    new lsp.StreamMessageReader(server.stdout),
    new lsp.StreamMessageWriter(server.stdin),
  );
  const published: lsp.PublishDiagnosticsParams[] = [];
  let notify = () => {};
  connection.onNotification(lsp.PublishDiagnosticsNotification.type, (params) => {
    published.push(params);
    notify();
  });
  // Fail at once, not by timeout, when the server crashes.
  const crashed = once(server, 'exit').then(([code]) => {
    throw new Error(`server exited early with code ${code}`);
  });
  crashed.catch(() => {});
  const orCrash = <T>(promise: Promise<T>) => Promise.race([promise, crashed]);
  const nextPublished = async () => {
    if (published.length === 0) await orCrash(new Promise<void>((resolve) => (notify = resolve)));
    return published.shift()!;
  };
  connection.listen();

  const initialized = await orCrash(
    connection.sendRequest(lsp.InitializeRequest.type, { processId: process.pid, rootUri: null, capabilities: {} }),
  );
  await connection.sendNotification(lsp.InitializedNotification.type, {});

  const stop = async () => {
    const exited = once(server, 'exit');
    await connection.sendRequest(lsp.ShutdownRequest.type);
    await connection.sendNotification(lsp.ExitNotification.type);
    const [exitCode] = await exited;
    assert.equal(exitCode, 0);
  };
  return { connection, capabilities: initialized.capabilities, orCrash, nextPublished, stop };
}

test('publishes syntax errors when a document is opened, changed and closed', async () => {
  const { connection, nextPublished, stop } = await startServer();
  const uri = 'file:///tmp/example.daphne';

  await connection.sendNotification(lsp.DidOpenTextDocumentNotification.type, {
    textDocument: { uri, languageId: 'daphnedsl', version: 1, text: 'x = 1\ny = 2;\n' },
  });
  const opened = await nextPublished();
  assert.equal(opened.uri, uri);
  assert.deepEqual(opened.diagnostics, [
    {
      range: { start: { line: 0, character: 4 }, end: { line: 0, character: 5 } },
      message: "missing ';'",
      severity: lsp.DiagnosticSeverity.Error,
      source: 'daphnedsl',
    },
  ]);

  // Insert the missing `;` as an incremental change.
  await connection.sendNotification(lsp.DidChangeTextDocumentNotification.type, {
    textDocument: { uri, version: 2 },
    contentChanges: [{ range: { start: { line: 0, character: 5 }, end: { line: 0, character: 5 } }, text: ';' }],
  });
  assert.deepEqual((await nextPublished()).diagnostics, []);

  await connection.sendNotification(lsp.DidChangeTextDocumentNotification.type, {
    textDocument: { uri, version: 3 },
    contentChanges: [{ text: 'x = ;' }],
  });
  assert.deepEqual(
    (await nextPublished()).diagnostics.map((diagnostic) => diagnostic.message),
    ['expected an expression'],
  );

  await connection.sendNotification(lsp.DidCloseTextDocumentNotification.type, { textDocument: { uri } });
  assert.deepEqual((await nextPublished()).diagnostics, []);

  await stop();
});

test('formats a document on request, unless it has syntax errors', async () => {
  const { connection, capabilities, orCrash, stop } = await startServer();
  assert.equal(capabilities.documentFormattingProvider, true);

  const formatted = async (uri: string, text: string) => {
    await connection.sendNotification(lsp.DidOpenTextDocumentNotification.type, {
      textDocument: { uri, languageId: 'daphnedsl', version: 1, text },
    });
    const edits = await orCrash(
      connection.sendRequest(lsp.DocumentFormattingRequest.type, {
        textDocument: { uri },
        // The style is fixed: these options must not change the result.
        options: { tabSize: 2, insertSpaces: false },
      }),
    );
    return edits && TextDocument.applyEdits(TextDocument.create(uri, 'daphnedsl', 1, text), edits);
  };

  assert.equal(
    await formatted('file:///tmp/valid.daphne', 'if(x>1)\r\n{\r\n  y=[1,2];  # é\r\n}'),
    'if (x > 1) {\r\n    y = [1, 2]; # é\r\n}\r\n',
  );
  assert.equal(await formatted('file:///tmp/broken.daphne', 'if(x>1) {\n  y=[1,2;\n}\n'), null);

  await stop();
});
