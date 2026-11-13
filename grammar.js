/**
 * Tree-sitter grammar for DaphneDSL.
 *
 * Ported by hand from DAPHNE's authoritative ANTLR grammar
 * (src/parser/daphnedsl/DaphneDSLGrammar.g4 in daphne-eu/daphne). The rule
 * names follow the ANTLR rules so the two are easy to compare, and
 * conformance/ checks that both produce the same trees for DAPHNE's scripts.
 *
 * Known divergence: ANTLR's lexer always reads `[[` and `]]` as one token, so
 * DAPHNE rejects `X[, [0, 2]]` (it wants `X[, [0, 2] ]`). This grammar accepts
 * it, because tree-sitter only looks for the tokens that are valid at the
 * current position.
 */

// Mirrors the alternative order of `expr` in the ANTLR grammar (earlier = binds tighter).
const PREC = {
  cond: 1,
  disj: 2,
  conj: 3,
  cmp: 4,
  add: 5,
  mul: 6,
  mod: 7,
  pow: 8,
  matmul: 9,
  unary: 10,
  postfix: 11,
};

const KEYWORDS = ['if', 'else', 'while', 'do', 'for', 'in', 'true', 'false', 'as', 'def', 'return', 'import'];
const DATA_TYPES = ['matrix', 'scalar', 'frame'];
const VALUE_TYPES = ['f64', 'f32', 'si64', 'si32', 'si8', 'ui64', 'ui32', 'ui8', 'str', 'bool'];
const SPECIAL_FLOATS = ['nan', 'nanf', 'inf', 'inff'];

const INT_PART = /0|[1-9]([_']?[0-9])*/;
const FRACTION = /\.[0-9]+([_']?[0-9])*/;
const EXPONENT = /[eE][-+]?(0|[1-9][0-9]*)/;

const commaSep1 = rule => seq(rule, repeat(seq(',', rule)));

module.exports = grammar({
  name: 'daphnedsl',

  word: $ => $.identifier,

  // In ANTLR these are lexer tokens that win over IDENTIFIER everywhere.
  reserved: {
    global: _ => [...KEYWORDS, ...DATA_TYPES, ...VALUE_TYPES, ...SPECIAL_FLOATS],
  },

  extras: $ => [/[ \t\r\n]+/, $.comment],

  conflicts: $ => [
    // `x[0, 0] = 1;` vs. `x[0, 0];` and `a, b = f();` vs. `a;`
    [$.assign_target, $.identifier_expr],
    // `{` can start a block or a frame literal.
    [$.block_statement, $.col_major_frame_literal],
  ],

  rules: {
    script: $ => repeat($._statement),

    _statement: $ => choice(
      $.block_statement,
      $.expr_statement,
      $.assign_statement,
      $.if_statement,
      $.while_statement,
      $.do_while_statement,
      $.for_statement,
      $.function_statement,
      $.return_statement,
      $.import_statement,
    ),

    import_statement: $ => seq(
      'import', field('path', $.string), optional(seq('as', field('alias', $.string))), ';',
    ),

    block_statement: $ => prec.right(seq('{', repeat($._statement), '}', optional(';'))),

    expr_statement: $ => seq($._expr, ';'),

    assign_statement: $ => seq(commaSep1($.assign_target), '=', field('value', $._expr), ';'),

    assign_target: $ => seq(
      repeat(seq(field('namespace', $.identifier), '.')),
      field('name', $.identifier),
      optional($.indexing),
    ),

    if_statement: $ => prec.right(seq(
      'if', '(', field('condition', $._expr), ')',
      field('then', $._statement),
      optional(seq('else', field('else', $._statement))),
    )),

    while_statement: $ => seq('while', '(', field('condition', $._expr), ')', field('body', $._statement)),

    do_while_statement: $ => prec.right(seq(
      'do', field('body', $._statement), 'while', '(', field('condition', $._expr), ')', optional(';'),
    )),

    for_statement: $ => seq(
      'for', '(', field('var', $.identifier), 'in',
      field('from', $._expr), ':', field('to', $._expr), optional(seq(':', field('step', $._expr))),
      ')', field('body', $._statement),
    ),

    function_statement: $ => seq(
      'def', field('name', $.identifier),
      '(', optional($.function_args), ')',
      optional(seq('->', field('return_types', $.function_ret_types))),
      field('body', $.block_statement),
    ),

    return_statement: $ => seq('return', optional(commaSep1($._expr)), ';'),

    function_args: $ => seq(commaSep1($.function_arg), optional(',')),
    function_arg: $ => seq(field('name', $.identifier), optional(seq(':', field('type', $.type)))),
    function_ret_types: $ => commaSep1($.type),

    type: $ => choice(
      seq($.data_type, optional(seq('<', $.value_type, '>'))),
      $.value_type,
    ),
    data_type: _ => choice(...DATA_TYPES),
    value_type: _ => choice(...VALUE_TYPES),

    _expr: $ => choice(
      $._literal,
      $.arg_expr,
      $.identifier_expr,
      $.parenthesized_expr,
      $.call_expr,
      $.cast_expr,
      $.right_idx_filter_expr,
      $.right_idx_extract_expr,
      $.unary_expr,
      $.binary_expr,
      $.cond_expr,
      $.matrix_literal,
      $.col_major_frame_literal,
      $.row_major_frame_literal,
    ),

    arg_expr: $ => seq('$', field('name', $.identifier)),

    identifier_expr: $ => seq(
      repeat(seq(field('namespace', $.identifier), '.')),
      field('name', $.identifier),
    ),

    parenthesized_expr: $ => seq('(', $._expr, ')'),

    call_expr: $ => seq(
      repeat(seq(field('namespace', $.identifier), '.')),
      field('function', $.identifier),
      optional(seq('::', field('kernel', $.identifier))),
      '(', optional($.call_args), ')',
    ),
    call_args: $ => seq(commaSep1($.call_arg), optional(',')),
    call_arg: $ => seq(optional(seq(field('param', $.identifier), '=')), field('value', $._expr)),

    cast_expr: $ => seq('as', '.', field('type', $.type), '(', field('value', $._expr), ')'),

    right_idx_filter_expr: $ => prec(PREC.postfix, seq(
      field('object', $._expr), '[[', optional(field('rows', $._expr)), ',', optional(field('cols', $._expr)), ']]',
    )),

    right_idx_extract_expr: $ => prec(PREC.postfix, seq(field('object', $._expr), $.indexing)),

    indexing: $ => seq('[', optional(field('rows', $.range)), ',', optional(field('cols', $.range)), ']'),

    range: $ => choice(
      field('pos', $._expr),
      seq(optional(field('lower', $._expr)), ':', optional(field('upper', $._expr))),
    ),

    unary_expr: $ => prec(PREC.unary, seq(field('op', choice('+', '-')), field('arg', $._expr))),

    binary_expr: $ => {
      const kernelHint = $ => optional(seq('::', field('kernel', $.identifier)));
      const table = [
        [PREC.matmul, '@', false],
        [PREC.pow, '^', false],
        [PREC.mod, '%', false],
        [PREC.mul, choice('*', '/'), true],
        [PREC.add, choice('+', '-'), true],
        [PREC.cmp, choice('==', '!=', '<', '<=', '>', '>='), false],
        [PREC.conj, '&&', false],
        [PREC.disj, '||', false],
      ];
      return choice(...table.map(([precedence, op, hasKernelHint]) => prec.left(precedence, seq(
        field('lhs', $._expr),
        field('op', op),
        ...(hasKernelHint ? [kernelHint($)] : []),
        field('rhs', $._expr),
      ))));
    },

    cond_expr: $ => prec.left(PREC.cond, seq(
      field('condition', $._expr), '?', field('then', $._expr), ':', field('else', $._expr),
    )),

    matrix_literal: $ => prec.right(seq(
      '[', optional(commaSep1($._expr)), ']',
      optional(seq('(', optional(field('rows', $._expr)), ',', optional(field('cols', $._expr)), ')')),
    )),

    col_major_frame_literal: $ => seq(
      '{', optional(commaSep1(seq(field('label', $._expr), ':', field('column', $._expr)))), '}',
    ),

    row_major_frame_literal: $ => seq('{', field('labels', $.frame_row), repeat(seq(',', $.frame_row)), '}'),

    frame_row: $ => seq('[', optional(commaSep1($._expr)), ']'),

    _literal: $ => choice($.integer, $.float, $.boolean, $.string),

    integer: _ => token(seq(INT_PART, optional(choice('l', 'u', 'ull', 'z')))),

    float: _ => choice(
      ...SPECIAL_FLOATS,
      token(seq(
        INT_PART,
        choice(FRACTION, seq(optional(FRACTION), EXPONENT)),
        optional('f'),
      )),
    ),

    boolean: _ => choice('true', 'false'),

    string: $ => seq('"', repeat(choice($.escape_sequence, $._string_content)), '"'),
    _string_content: _ => token.immediate(prec(1, /[^"\\]+/)),
    escape_sequence: _ => token.immediate(/\\[bfnrt"\\]/),

    identifier: _ => /[a-zA-Z_][a-zA-Z_0-9]*/,

    comment: _ => token(choice(
      seq('#', /[^\r\n]*/),
      seq('//', /[^\r\n]*/),
      seq('/*', /[^*]*\*+([^/*][^*]*\*+)*/, '/'),
    )),
  },
});
