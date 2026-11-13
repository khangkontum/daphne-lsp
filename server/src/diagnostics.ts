// Turns the error nodes of a tree-sitter syntax tree into editor diagnostics.
//
// Tree-sitter recovers from a syntax error in two ways. It inserts a
// zero-width MISSING node for a token that it expected, or it wraps the
// tokens that it could not use in an ERROR node.

import type { Node, Tree } from 'web-tree-sitter';

export interface Position {
  line: number;
  /** In UTF-16 code units, which is what both tree-sitter and LSP count. */
  character: number;
}

export interface SyntaxProblem {
  range: { start: Position; end: Position };
  message: string;
}

const MAX_QUOTED_LENGTH = 40;

export function syntaxProblems(tree: Tree): SyntaxProblem[] {
  const problems: SyntaxProblem[] = [];
  const visit = (node: Node): void => {
    if (node.isMissing) {
      problems.push(missingTokenProblem(node));
    } else if (node.isError) {
      // Nested ERROR nodes belong to the same mistake, so do not descend.
      problems.push(unexpectedTextProblem(node));
    } else if (node.hasError) {
      for (const child of node.children) {
        if (child) visit(child);
      }
    }
  };
  visit(tree.rootNode);
  return problems;
}

function missingTokenProblem(node: Node): SyntaxProblem {
  // The parser notices a missing token only at the next token, which can be
  // lines further down. Report it on the token that it should follow.
  const previous = previousToken(node);
  return {
    range: previous ? firstLineRange(previous) : firstLineRange(node),
    message:
      node.parent?.type === 'identifier_expr'
        ? 'expected an expression'
        : `missing ${node.isNamed ? node.type.replaceAll('_', ' ') : `'${node.type}'`}`,
  };
}

function unexpectedTextProblem(error: Node): SyntaxProblem {
  const culprit = errorCulprit(error);
  const text = culprit.text;
  let message: string;
  if (culprit.type === '"') {
    message = 'unterminated string';
  } else if (text.startsWith('/*')) {
    message = 'unterminated block comment';
  } else {
    message = `unexpected '${abbreviate(text)}'`;
  }
  return { range: firstLineRange(culprit), message };
}

/** The part of an ERROR node that is closest to the actual mistake. */
function errorCulprit(error: Node): Node {
  // A character that no token can start with is a nested ERROR.
  const nested = error.children.find((child) => child?.isError);
  if (nested) return nested;
  // When the text after a token cannot be tokenized at all (an unterminated
  // string), the ERROR runs on past its last token, often to the end of the
  // file. That last token is where it went wrong.
  const last = error.lastChild;
  if (last && last.endIndex < error.endIndex) return last;
  return error;
}

function previousToken(node: Node): Node | null {
  let current: Node | null = node;
  while (current) {
    let sibling: Node | null = current.previousSibling;
    while (sibling) {
      const token = lastToken(sibling);
      if (token) return token;
      sibling = sibling.previousSibling;
    }
    current = current.parent;
  }
  return null;
}

/** The last token in `node` that is real source text and not a comment. */
function lastToken(node: Node): Node | null {
  if (node.type === 'comment' || node.startIndex === node.endIndex) return null;
  if (node.childCount === 0) return node;
  for (let i = node.childCount - 1; i >= 0; i--) {
    const child = node.child(i);
    const token = child && lastToken(child);
    if (token) return token;
  }
  return null;
}

/** The range of `node`, cut off at the end of its first line. */
function firstLineRange(node: Node): SyntaxProblem['range'] {
  const start = { line: node.startPosition.row, character: node.startPosition.column };
  if (node.endPosition.row === node.startPosition.row) {
    return { start, end: { line: node.endPosition.row, character: node.endPosition.column } };
  }
  const firstLine = node.text.split(/\r?\n/, 1)[0];
  return { start, end: { line: start.line, character: start.character + firstLine.length } };
}

function abbreviate(text: string): string {
  const oneLine = text.split(/\r?\n/, 1)[0];
  return oneLine.length > MAX_QUOTED_LENGTH ? `${oneLine.slice(0, MAX_QUOTED_LENGTH)}…` : oneLine;
}
