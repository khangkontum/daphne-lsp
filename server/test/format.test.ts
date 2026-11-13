import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formattingChanges, type TextChange } from '../src/format.ts';
import { loadParser } from '../src/parser.ts';

const parser = await loadParser(new URL('../dist/', import.meta.url).pathname);

function changesFor(source: string): TextChange[] | null {
  const tree = parser.parse(source);
  assert.ok(tree);
  return formattingChanges(tree, source);
}

/** The formatted source, or null when the formatter refuses it. */
function format(source: string): string | null {
  const changes = changesFor(source);
  if (!changes) return null;
  let formatted = '';
  let position = 0;
  for (const change of changes) {
    formatted += source.slice(position, change.start) + change.newText;
    position = change.end;
  }
  formatted += source.slice(position);
  assert.equal(formatted.replace(/\s+/g, ''), source.replace(/\s+/g, ''), 'only whitespace changes');
  assert.deepEqual(changesFor(formatted), [], 'formatting a second time changes nothing');
  return formatted;
}

const lines = (...text: string[]): string => text.map((line) => `${line}\n`).join('');

test('braces open on the line of their statement and blocks are indented by 4 spaces', () => {
  const source = lines(
    'def f(a)',
    '{',
    '  if(a>0)',
    '  {',
    '\treturn 1;',
    '  }',
    '  else',
    '  {',
    '          return 2;',
    '  }',
    '}',
    'while(x) { x = g(x); }',
    'do',
    '{',
    'x = x + 1;',
    '}',
    'while (x < 3);',
    'for(i in 1:n) { }',
  );
  assert.equal(
    format(source),
    lines(
      'def f(a) {',
      '    if (a > 0) {',
      '        return 1;',
      '    } else {',
      '        return 2;',
      '    }',
      '}',
      'while (x) {',
      '    x = g(x);',
      '}',
      'do {',
      '    x = x + 1;',
      '} while (x < 3);',
      'for (i in 1:n) {}',
    ),
  );
});

test('each statement gets its own line, and a body without braces is indented', () => {
  const source = lines(
    'if (a) x = 1; else if (b) x = 2; else x = 3;',
    'for(i in 1:n) for(j in 1 : n : 2) s = s + i;',
    'x = 1; y = 2;',
    'do x = x + 1; while (x < 3);',
    'if (a) { x = 1; } else x = 2;',
  );
  assert.equal(
    format(source),
    lines(
      'if (a)',
      '    x = 1;',
      'else if (b)',
      '    x = 2;',
      'else',
      '    x = 3;',
      'for (i in 1:n)',
      '    for (j in 1:n:2)',
      '        s = s + i;',
      'x = 1;',
      'y = 2;',
      'do',
      '    x = x + 1;',
      'while (x < 3);',
      'if (a) {',
      '    x = 1;',
      '} else',
      '    x = 2;',
    ),
  );
});

test('spacing inside statements and expressions', () => {
  const cases: [source: string, formatted: string][] = [
    ['x=a+b*c-d/e%f^g@h;', 'x = a + b * c - d / e % f ^ g @ h;'],
    ['ok=a==b&&c!=d||e<=f;', 'ok = a == b && c != d || e <= f;'],
    ['y = - x + ( + 1 ) ;', 'y = -x + (+1);'],
    ['z = a +::myAdd b * :: myMul c;', 'z = a +::myAdd b *::myMul c;'],
    ['v = c?1:2;', 'v = c ? 1 : 2;'],
    ['r = f ( a ,b , n = 3 ) ;', 'r = f(a, b, n=3);'],
    ['r = ns . g :: kern ( ) ;', 'r = ns.g::kern();'],
    ['t = as . matrix < f64 > ( $ p ) ;', 't = as.matrix<f64>($p);'],
    ['X[ 0 ,1 ] = X [ 1 : , : 2 ] ;', 'X[0, 1] = X[1:, :2];'],
    ['c = X[,0] + X[1,] + X[ , ];', 'c = X[, 0] + X[1, ] + X[, ];'],
    ['d = X[[ r , ]];', 'd = X[[r, ]];'],
    ['m = [ 1 ,2 ] ( 2 , ) ;', 'm = [1, 2](2,);'],
    ['fr = { "a" : [ 1 ] , "b" : [ 2 ] } ;', 'fr = {"a": [1], "b": [2]};'],
    ['fr = { [ "a" , "b" ] , [ 1 , 2 ] } ;', 'fr = {["a", "b"], [1, 2]};'],
    ['a , b = f ( ) ;', 'a, b = f();'],
    ['import  "a.daphne"  as  "a" ;', 'import "a.daphne" as "a";'],
    ['s = "a  +b"+ "c" ;', 's = "a  +b" + "c";'],
    [
      'def f ( a : matrix < f64 > , b ) -> si64 , f64 { return 1 , 2.0 ; }',
      'def f(a: matrix<f64>, b) -> si64, f64 {\n    return 1, 2.0;\n}',
    ],
  ];
  for (const [source, formatted] of cases) assert.equal(format(source), `${formatted}\n`);
});

test("never joins tokens that DAPHNE's lexer reads as one", () => {
  // DAPHNE always reads `]]` and `[[` as one token.
  assert.equal(format('y = X[ , [0, 2] ];'), 'y = X[, [0, 2] ];\n');
  assert.equal(format('y = X[, [0, 2]];'), 'y = X[, [0, 2] ];\n');
  assert.equal(format('m = [ [1],[2] ];'), 'm = [ [1], [2] ];\n');
  assert.equal(format('z = a - - b + - - c;'), 'z = a - -b + - -c;\n');
});

test('comments stay where they are and are indented like the code after them', () => {
  const source = lines(
    'x = 1;   # trailing   ',
    '  // own line',
    'if (a) { // after brace',
    '        # first in block',
    '  y = 2;',
    '      // before closing brace',
    '}',
    '// before else',
    'else {',
    '  z = f(a, /* inline */ b, /*tight*/c); /* end */',
    '}',
    'if (b)',
    '# before body',
    'x = 2;',
    '/* multi',
    '     line */',
  );
  assert.equal(
    format(source),
    lines(
      'x = 1; # trailing',
      '// own line',
      'if (a) { // after brace',
      '    # first in block',
      '    y = 2;',
      '    // before closing brace',
      '}',
      '// before else',
      'else {',
      '    z = f(a, /* inline */ b, /*tight*/c); /* end */',
      '}',
      'if (b)',
      '    # before body',
      '    x = 2;',
      '/* multi',
      '     line */',
    ),
  );
});

test('line breaks inside an expression are kept and re-indented', () => {
  const source = lines(
    'f = {',
    '  "a": [1, 2],',
    '        "b": [3,',
    '  4]',
    '};',
    'r = g(a,',
    '      h(',
    '  1,',
    '  2',
    '      ), b);',
    'if (a) {',
    'total = a +',
    'b',
    '  + c;',
    '}',
  );
  assert.equal(
    format(source),
    lines(
      'f = {',
      '    "a": [1, 2],',
      '    "b": [3,',
      '        4]',
      '};',
      'r = g(a,',
      '    h(',
      '        1,',
      '        2',
      '    ), b);',
      'if (a) {',
      '    total = a +',
      '        b',
      '        + c;',
      '}',
    ),
  );
});

test('line breaks before `;`, `{`, `else` and the `(` of a keyword are removed', () => {
  assert.equal(
    format('x = 1\n;\nif\n(a)\n{\nx = 2;\n}\nelse\n{\nx = 3;\n}\n;'),
    'x = 1;\nif (a) {\n    x = 2;\n} else {\n    x = 3;\n};\n',
  );
});

test('blank lines collapse to one and go away at the edges of files and blocks', () => {
  assert.equal(
    format('\n\n\nx = 1;\n\n\n\ny = 2;\nif (a) {\n\n  z = 3;\n\n  // done\n\n}\n\n\n'),
    'x = 1;\n\ny = 2;\nif (a) {\n    z = 3;\n\n    // done\n}\n',
  );
});

test('a file ends with exactly one line break, and an empty file stays empty', () => {
  assert.equal(format('x = 1;'), 'x = 1;\n');
  assert.equal(format('x = 1;  \n\n'), 'x = 1;\n');
  assert.equal(format(''), '');
  assert.equal(format(' \n\n'), '');
});

test('keeps Windows line endings', () => {
  assert.equal(format('if(a){\r\nx=1;\r\n\r\n\r\ny=2;}'), 'if (a) {\r\n    x = 1;\r\n\r\n    y = 2;\r\n}\r\n');
});

test('refuses a script with syntax errors', () => {
  assert.equal(format('x = ;'), null);
  assert.equal(format('if (a) {\n  x=1;\n'), null);
});

test('changes only the whitespace that differs', () => {
  assert.deepEqual(changesFor('x = 1;\ny=2;\n'), [
    { start: 8, end: 8, newText: ' ' },
    { start: 9, end: 9, newText: ' ' },
  ]);
});
