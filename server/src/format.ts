// Formats DaphneDSL in one fixed style: 4 spaces, `{` on the line of its
// statement, one statement per line.
//
// The formatter only rewrites the whitespace between tokens. It never adds,
// removes or reorders a token or a comment, so it cannot change what a script
// means. Line breaks that the author put inside an expression are kept and
// re-indented; long lines are not wrapped.

import type { Node, Tree } from 'web-tree-sitter';

/** Replaces `text.slice(start, end)`. Offsets are in UTF-16 code units. */
export interface TextChange {
  start: number;
  end: number;
  newText: string;
}

const INDENT = '    ';
const LINE_BREAK = /\r\n|\r|\n/g;

/** How a token follows the one before it. */
interface Lead {
  gap: 'none' | 'space' | 'line';
  /** Pull the token up when the source has a line break before it. */
  join?: boolean;
  /** At the start of a line, the token sits at the indent of its statement, not at a continuation indent. */
  structural?: boolean;
  /** The node is one block level deeper than its parent. */
  nest?: boolean;
}

interface Token {
  start: number;
  end: number;
  text: string;
  kind: 'code' | 'line comment' | 'block comment';
  lead: Lead;
  /** Block level of the statement that the token belongs to. */
  depth: number;
  /** A bracket of an expression, as opposed to the braces of a block. */
  bracket?: 'open' | 'close';
  blockBrace?: 'open' | 'close';
}

const NONE: Lead = { gap: 'none' };
const SPACE: Lead = { gap: 'space' };
const STATEMENT: Lead = { gap: 'line', structural: true };
const NESTED_STATEMENT: Lead = { ...STATEMENT, nest: true };
/** `{`, `else` and the `while` of `do ... while` stay on the line of the token before them. */
const SAME_LINE: Lead = { gap: 'space', join: true, structural: true };
const KEYWORD_PAREN: Lead = { gap: 'space', join: true };
const SEMICOLON: Lead = { gap: 'none', join: true };

type Layout = (child: Node, field: string | null, parent: Node) => Lead;

const isBlock = (node: Node | null): boolean => node?.type === 'block_statement';
const body = (statement: Node): Lead => (isBlock(statement) ? SAME_LINE : NESTED_STATEMENT);

/** The lead of each child after the first, by the type of its parent. Children not listed follow tightly. */
const LAYOUTS: Record<string, Layout> = {
  script: () => STATEMENT,
  block_statement: (child, _field, parent) => {
    if (child.type !== '}') return NESTED_STATEMENT;
    return parent.namedChildren.some((statement) => statement?.type !== 'comment')
      ? STATEMENT
      : { gap: 'none', join: true, structural: true };
  },
  if_statement: (child, field, parent) => {
    if (child.type === '(') return KEYWORD_PAREN;
    if (field === 'then') return body(child);
    if (field === 'else') return child.type === 'if_statement' ? SAME_LINE : body(child);
    if (child.type === 'else') return isBlock(parent.childForFieldName('then')) ? SAME_LINE : STATEMENT;
    return NONE;
  },
  while_statement: (child, field) => {
    if (child.type === '(') return KEYWORD_PAREN;
    return field === 'body' ? body(child) : NONE;
  },
  do_while_statement: (child, field, parent) => {
    if (child.type === '(') return KEYWORD_PAREN;
    if (field === 'body') return body(child);
    if (child.type === 'while') return isBlock(parent.childForFieldName('body')) ? SAME_LINE : STATEMENT;
    return NONE;
  },
  for_statement: (child, field) => {
    if (child.type === '(') return KEYWORD_PAREN;
    if (field === 'body') return body(child);
    return child.type === 'in' || field === 'from' ? SPACE : NONE;
  },
  function_statement: (child, field) => {
    if (field === 'body') return SAME_LINE;
    return field === 'name' || field === 'return_types' || child.type === '->' ? SPACE : NONE;
  },
  import_statement: () => SPACE,
  return_statement: () => SPACE,
  assign_statement: (child, field) => (child.type === '=' || field === 'value' ? SPACE : NONE),
  function_arg: (_child, field) => (field === 'type' ? SPACE : NONE),
  // A kernel hint stays attached to its operator: `a +::kernel b`.
  binary_expr: (_child, field) => (field === 'op' || field === 'rhs' ? SPACE : NONE),
  cond_expr: () => SPACE,
  col_major_frame_literal: (_child, field) => (field === 'column' ? SPACE : NONE),
};

const OPENING_BRACKETS = new Set(['(', '[', '[[', '{']);
const CLOSING_BRACKETS = new Set([')', ']', ']]', '}']);

/** The tokens and comments of an error-free tree in source order, each with its lead. */
function collectTokens(root: Node): Token[] {
  const tokens: Token[] = [];
  let depth = 0;

  const addToken = (node: Node, lead: Lead): void => {
    const token: Token = { start: node.startIndex, end: node.endIndex, text: node.text, kind: 'code', lead, depth };
    if (isBlock(node.parent)) {
      if (node.type === '{') token.blockBrace = 'open';
      if (node.type === '}') token.blockBrace = 'close';
    } else if (OPENING_BRACKETS.has(node.type)) {
      token.bracket = 'open';
    } else if (CLOSING_BRACKETS.has(node.type)) {
      token.bracket = 'close';
    }
    tokens.push(token);
  };

  const addComment = (node: Node): void => {
    const isLineComment = !node.text.startsWith('/*');
    // Trailing whitespace of a line comment becomes part of the gap after it.
    const text = isLineComment ? node.text.trimEnd() : node.text;
    tokens.push({
      start: node.startIndex,
      end: node.startIndex + text.length,
      text,
      kind: isLineComment ? 'line comment' : 'block comment',
      // Comments are placed by where they are in the source, see `separators`.
      lead: NONE,
      depth,
    });
  };

  const visit = (node: Node, lead: Lead): void => {
    if (lead.nest) {
      depth++;
      visit(node, { ...lead, nest: false });
      depth--;
      return;
    }
    // A string is one token, whatever is inside it.
    if (node.childCount === 0 || node.type === 'string') {
      if (node.endIndex > node.startIndex) addToken(node, lead);
      return;
    }
    const layout = LAYOUTS[node.type];
    let previous: Node | null = null;
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (!child) continue;
      if (child.type === 'comment') {
        addComment(child);
        continue;
      }
      visit(child, previous ? childLead(child, previous, node.fieldNameForChild(i), node, layout) : lead);
      previous = child;
    }
  };

  visit(root, STATEMENT);
  return tokens;
}

function childLead(child: Node, previous: Node, field: string | null, parent: Node, layout?: Layout): Lead {
  if (child.type === ';') return SEMICOLON;
  if (child.type === ',') return NONE;
  // `[1.0](2,)`, but `X[1, ]` as in DAPHNE's language reference.
  if (previous.type === ',') return child.type === ')' ? NONE : SPACE;
  return layout ? layout(child, field, parent) : NONE;
}

/**
 * Pairs of characters that DAPHNE's lexer reads as one token or as the start
 * of a comment. It always takes the longest match, so `X[, [0, 2]]` ends in
 * one `]]` token there and is rejected.
 */
const MERGING_PAIRS = new Set(['[[', ']]', '::', '->', '==', '!=', '<=', '>=', '&&', '||', '//', '/*']);
const WORD_CHARACTER = /[A-Za-z0-9_]/;

/** Whether two tokens written without a space would be read differently. */
function needsSpace(left: string, right: string): boolean {
  const last = left[left.length - 1];
  const first = right[0];
  if (WORD_CHARACTER.test(last) && WORD_CHARACTER.test(first)) return true;
  // `- -x` reads better than `--x`.
  if ((last === '-' || last === '+') && last === first) return true;
  return MERGING_PAIRS.has(last + first);
}

/** The whitespace before each token, and after the last one. */
function separators(tokens: Token[], text: string, lineEnding: string): string[] {
  const nextCode: (Token | undefined)[] = new Array(tokens.length);
  for (let i = tokens.length - 1; i >= 0; i--) {
    nextCode[i] = tokens[i].kind === 'code' ? tokens[i] : nextCode[i + 1];
  }

  /** Indent of the line that is being written. */
  let lineIndent = 0;
  /** For each open bracket of an expression, the indent of the line that it is on. */
  const brackets: number[] = [];
  const continuationIndent = (depth: number): number =>
    brackets.length > 0 ? brackets[brackets.length - 1] + 1 : depth + 1;

  const indentOf = (token: Token, index: number): number => {
    if (token.kind !== 'code') {
      // A comment on its own line is indented like the code after it.
      const next = nextCode[index];
      if (!next) return 0;
      if (!next.lead.structural) return continuationIndent(next.depth);
      return next.blockBrace === 'close' ? next.depth + 1 : next.depth;
    }
    if (token.lead.structural) return token.depth;
    // A closing bracket lines up with the line of its opening bracket.
    if (token.bracket === 'close' && brackets.length > 0) return brackets[brackets.length - 1];
    return continuationIndent(token.depth);
  };

  const result = [''];
  tokens.forEach((token, index) => {
    if (index > 0) {
      const previous = tokens[index - 1];
      const between = text.slice(previous.end, token.start);
      const lineBreaks = between.match(LINE_BREAK)?.length ?? 0;
      if (startsLine(token, previous, lineBreaks)) {
        // At most one blank line, and none at the start or end of a block.
        const blankLine = lineBreaks > 1 && previous.blockBrace !== 'open' && token.blockBrace !== 'close';
        lineIndent = indentOf(token, index);
        result.push(lineEnding.repeat(blankLine ? 2 : 1) + INDENT.repeat(lineIndent));
      } else {
        result.push(sameLineSeparator(token, previous, between));
      }
    }
    if (token.bracket === 'open') brackets.push(lineIndent);
    if (token.bracket === 'close') brackets.pop();
  });
  result.push(tokens.length > 0 ? lineEnding : '');
  return result;
}

function startsLine(token: Token, previous: Token, lineBreaksInSource: number): boolean {
  if (previous.kind === 'line comment') return true;
  if (token.lead.gap === 'line' && token.kind === 'code') return true;
  // Comments stay where they are: at the end of a line or on their own line.
  if (token.kind !== 'code' || previous.kind === 'block comment') return lineBreaksInSource > 0;
  return lineBreaksInSource > 0 && !token.lead.join;
}

function sameLineSeparator(token: Token, previous: Token, between: string): string {
  if (token.kind === 'line comment') return ' ';
  // Keep `f(/* default */ 1)` as it is.
  if (token.kind === 'block comment') return between === '' ? '' : ' ';
  if (previous.kind === 'block comment') return between === '' || token.text === ',' || token.text === ';' ? '' : ' ';
  return token.lead.gap === 'space' || needsSpace(previous.text, token.text) ? ' ' : '';
}

/**
 * The changes that format `text`, which `tree` is the syntax tree of. Returns
 * null for a script with syntax errors: its tree does not say reliably where
 * statements start and end.
 */
export function formattingChanges(tree: Tree, text: string): TextChange[] | null {
  if (tree.rootNode.hasError) return null;
  const tokens = collectTokens(tree.rootNode);
  // Keep the line ending that the document uses.
  const lineEnding = text.match(LINE_BREAK)?.[0] ?? '\n';
  const wanted = separators(tokens, text, lineEnding);

  const changes: TextChange[] = [];
  for (let i = 0; i <= tokens.length; i++) {
    const start = i === 0 ? 0 : tokens[i - 1].end;
    const end = i === tokens.length ? text.length : tokens[i].start;
    const current = text.slice(start, end);
    // Everything between two tokens must be whitespace. Refuse to touch anything else.
    if (/[^ \t\r\n]/.test(current)) return null;
    if (current !== wanted[i]) changes.push({ start, end, newText: wanted[i] });
  }
  return changes;
}
