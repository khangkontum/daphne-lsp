; Capture names follow Neovim's conventions (`:help treesitter-highlight-groups`).
; When several patterns match a node, the last one wins.

; Identifiers
(identifier) @variable

(function_arg
  name: (identifier) @variable.parameter)

(call_arg
  param: (identifier) @variable.parameter)

(arg_expr
  "$" @variable.builtin
  name: (identifier) @variable.builtin)

(identifier_expr
  namespace: (identifier) @module)

(assign_target
  namespace: (identifier) @module)

(call_expr
  namespace: (identifier) @module)

; Functions
(function_statement
  name: (identifier) @function)

(call_expr
  function: (identifier) @function.call)

; BEGIN GENERATED builtins (scripts/update-builtins.mjs)
((call_expr
  !namespace
  function: (identifier) @function.builtin)
  (#any-of? @function.builtin
    "abs"
    "acos"
    "affine"
    "aggMax"
    "aggMin"
    "antiJoin"
    "append"
    "asin"
    "atan"
    "avg_pool2d"
    "avg_pool2d_backward"
    "batch_norm2d"
    "batch_norm2d_backward"
    "biasAdd"
    "bin"
    "cartesian"
    "cbind"
    "ceil"
    "close"
    "concat"
    "conv2d"
    "conv2d_backward_data"
    "conv2d_backward_filter"
    "cos"
    "cosh"
    "count"
    "createFrame"
    "createList"
    "ctable"
    "cumMax"
    "cumMin"
    "cumProd"
    "cumSum"
    "diagMatrix"
    "diagVector"
    "eigen"
    "except"
    "exp"
    "fill"
    "floor"
    "fullOuterJoin"
    "gemv"
    "groupJoin"
    "groupSum"
    "idxMax"
    "idxMin"
    "innerJoin"
    "intersect"
    "isNan"
    "isSymmetric"
    "leftOuterJoin"
    "length"
    "ln"
    "log"
    "lower"
    "lowerTri"
    "map"
    "max"
    "max_pool2d"
    "max_pool2d_backward"
    "mean"
    "merge"
    "min"
    "minus"
    "mod"
    "ncell"
    "ncol"
    "now"
    "nrow"
    "oneHot"
    "openDevice"
    "openFile"
    "openFileOnTarget"
    "order"
    "outerAdd"
    "outerAnd"
    "outerConcat"
    "outerDiv"
    "outerEq"
    "outerGe"
    "outerGt"
    "outerLe"
    "outerLog"
    "outerLt"
    "outerMax"
    "outerMin"
    "outerMod"
    "outerMul"
    "outerNeq"
    "outerOr"
    "outerPow"
    "outerSub"
    "outerXor"
    "pow"
    "print"
    "quantize"
    "rand"
    "rbind"
    "readCsv"
    "readFrame"
    "readMatrix"
    "receiveFromNumpy"
    "recode"
    "registerView"
    "relu"
    "remove"
    "replace"
    "reshape"
    "reverse"
    "round"
    "sample"
    "saveDaphneLibResult"
    "semiJoin"
    "seq"
    "setColLabels"
    "setColLabelsPrefix"
    "sign"
    "sin"
    "sinh"
    "softmax"
    "solve"
    "sparsity"
    "sql"
    "sqrt"
    "startProfiling"
    "stddev"
    "stop"
    "stopProfiling"
    "sum"
    "syrk"
    "t"
    "tan"
    "tanh"
    "transpose"
    "typeOf"
    "upper"
    "upperTri"
    "var"
    "write"
    "writeFrame"
    "writeMatrix"))
; END GENERATED builtins

; Kernel hints, e.g. `a +::myKernel b`
(call_expr
  kernel: (identifier) @attribute)

(binary_expr
  kernel: (identifier) @attribute)

; Types
(data_type) @type.builtin

(value_type) @type.builtin

; Literals
(integer) @number

(float) @number.float

(boolean) @boolean

(string) @string

(escape_sequence) @string.escape

(import_statement
  path: (string) @string.special.path)

; Keywords
"as" @keyword

"import" @keyword.import

"def" @keyword.function

"return" @keyword.return

[
  "if"
  "else"
] @keyword.conditional

[
  "while"
  "do"
  "for"
  "in"
] @keyword.repeat

; Operators and punctuation
[
  "+"
  "-"
  "*"
  "/"
  "%"
  "^"
  "@"
  "=="
  "!="
  "<"
  "<="
  ">"
  ">="
  "&&"
  "||"
  "="
  "->"
] @operator

[
  ","
  ";"
  "."
  ":"
  "::"
] @punctuation.delimiter

[
  "("
  ")"
  "["
  "]"
  "[["
  "]]"
  "{"
  "}"
] @punctuation.bracket

(type
  [
    "<"
    ">"
  ] @punctuation.bracket)

(cond_expr
  [
    "?"
    ":"
  ] @keyword.conditional.ternary)

(comment) @comment @spell
