import assert from 'node:assert/strict';
import { test } from 'node:test';
import { syntaxProblems } from '../src/diagnostics.ts';
import { loadParser } from '../src/parser.ts';

const parser = await loadParser(new URL('../dist/', import.meta.url).pathname);

/** Problems as `line:startColumn-endColumn message`, all zero-based. */
function problems(source: string): string[] {
  const tree = parser.parse(source);
  assert.ok(tree);
  return syntaxProblems(tree).map(({ range, message }) => {
    assert.equal(range.end.line, range.start.line, 'a problem stays on one line');
    return `${range.start.line}:${range.start.character}-${range.end.character} ${message}`;
  });
}

test('valid code has no problems', () => {
  assert.deepEqual(problems('x = [1, 2](2, 1);\nif (sum(x) > 2) { print("big"); }\n'), []);
  assert.deepEqual(problems(''), []);
});

test('a missing token is reported on the token before it', () => {
  assert.deepEqual(problems('x = 1\ny = 2;'), ["0:4-5 missing ';'"]);
  assert.deepEqual(problems('print(x;'), ["0:6-7 missing ')'"]);
  assert.deepEqual(problems('if (x) {\n  y = 10;\n'), ["1:8-9 missing '}'"]);
});

test('a missing token is not reported on the comments and blank lines after it', () => {
  assert.deepEqual(problems('x = 1;\ny = 20 // why\n\n# more\nz = 3;'), ["1:4-6 missing ';'"]);
});

test('a missing operand is reported on the operator', () => {
  assert.deepEqual(problems('x = 1 +;'), ['0:6-7 expected an expression']);
});

test('unexpected tokens are reported where they are', () => {
  assert.deepEqual(problems('x = 1;\n}\ny = 2;'), ["1:0-1 unexpected '}'"]);
  assert.deepEqual(problems('x = 1 if y else 2;'), ["0:6-17 unexpected 'if y else 2'"]);
});

test('a character that starts no token is reported once', () => {
  assert.deepEqual(problems('x = 1 ~ 2;'), ["0:6-7 unexpected '~'"]);
});

test('an unterminated string is reported at its quote, not to the end of the file', () => {
  assert.deepEqual(problems('x = 1;\ny = "abc;\nz = 2;\n'), ['1:4-5 unterminated string']);
  assert.deepEqual(problems('x = 1;\r\ny = "abc;\r\nz = 2;\r\n'), ['1:4-5 unterminated string']);
});

test('columns count UTF-16 code units', () => {
  // "😀" is two UTF-16 code units, four UTF-8 bytes and one code point.
  assert.deepEqual(problems('x = "😀" +;'), ['0:9-10 expected an expression']);
});
