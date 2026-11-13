" Vim syntax file
" Language: DaphneDSL (https://github.com/daphne-eu/daphne)
" URL:      https://github.com/khangkontum/daphne-lsp
"
" Regex-based highlighting for Vim, and for Neovim while the tree-sitter parser
" is not built. Where several items match at one position, keywords win over
" matches and regions, and a later item wins over an earlier one.

if exists('b:current_syntax')
  finish
endif

syn keyword daphnedslConditional if else
syn keyword daphnedslRepeat while do for in
syn keyword daphnedslKeyword return as
syn keyword daphnedslInclude import
syn keyword daphnedslDef def nextgroup=daphnedslFunctionName skipwhite
syn keyword daphnedslType matrix frame scalar f64 f32 si64 si32 si8 ui64 ui32 ui8 str bool
syn keyword daphnedslBoolean true false
syn keyword daphnedslFloat nan nanf inf inff

syn match daphnedslFunctionName /\h\w*/ contained

" The `lib` of `lib.f(x)`.
syn match daphnedslNamespace /\<\h\w*\ze\s*\.\s*\h/

" Calls, optionally with a kernel hint as in `f::myKernel(x)`. A built-in is
" only recognized where it is called without a namespace, so the second item
" repeats the first one for `lib.f(x)`, without the built-ins.
syn match daphnedslFunction /\<\h\w*\ze\s*\%(::\s*\h\w*\s*\)\?(/ contains=daphnedslBuiltin
syn match daphnedslFunction /\.\s*\zs\h\w*\ze\s*\%(::\s*\h\w*\s*\)\?(/
syn match daphnedslKernel /::\s*\zs\h\w*/

" BEGIN GENERATED builtins (scripts/update-builtins.mjs)
syn keyword daphnedslBuiltin contained abs acos affine aggMax aggMin antiJoin append asin atan
syn keyword daphnedslBuiltin contained avg_pool2d avg_pool2d_backward batch_norm2d
syn keyword daphnedslBuiltin contained batch_norm2d_backward biasAdd bin cartesian cbind ceil close
syn keyword daphnedslBuiltin contained concat conv2d conv2d_backward_data conv2d_backward_filter cos
syn keyword daphnedslBuiltin contained cosh count createFrame createList ctable cumMax cumMin
syn keyword daphnedslBuiltin contained cumProd cumSum diagMatrix diagVector eigen except exp fill
syn keyword daphnedslBuiltin contained floor fullOuterJoin gemv groupJoin groupSum idxMax idxMin
syn keyword daphnedslBuiltin contained innerJoin intersect isNan isSymmetric leftOuterJoin length ln
syn keyword daphnedslBuiltin contained log lower lowerTri map max max_pool2d max_pool2d_backward
syn keyword daphnedslBuiltin contained mean merge min minus mod ncell ncol now nrow oneHot
syn keyword daphnedslBuiltin contained openDevice openFile openFileOnTarget order outerAdd outerAnd
syn keyword daphnedslBuiltin contained outerConcat outerDiv outerEq outerGe outerGt outerLe outerLog
syn keyword daphnedslBuiltin contained outerLt outerMax outerMin outerMod outerMul outerNeq outerOr
syn keyword daphnedslBuiltin contained outerPow outerSub outerXor pow print quantize rand rbind
syn keyword daphnedslBuiltin contained readCsv readFrame readMatrix receiveFromNumpy recode
syn keyword daphnedslBuiltin contained registerView relu remove replace reshape reverse round sample
syn keyword daphnedslBuiltin contained saveDaphneLibResult semiJoin seq setColLabels
syn keyword daphnedslBuiltin contained setColLabelsPrefix sign sin sinh softmax solve sparsity sql
syn keyword daphnedslBuiltin contained sqrt startProfiling stddev stop stopProfiling sum syrk t tan
syn keyword daphnedslBuiltin contained tanh transpose typeOf upper upperTri var write writeFrame
syn keyword daphnedslBuiltin contained writeMatrix
" END GENERATED builtins

syn match daphnedslScriptArg /\$\h\w*/

syn match daphnedslNumber /\<\%(0\|[1-9]\%([_']\?[0-9]\)*\)\%(ull\|l\|u\|z\)\?\>/
syn match daphnedslFloat /\<\%(0\|[1-9]\%([_']\?[0-9]\)*\)\%(\.[0-9]\+\%([_']\?[0-9]\)*\%([eE][-+]\?\%(0\|[1-9][0-9]*\)\)\?\|[eE][-+]\?\%(0\|[1-9][0-9]*\)\)f\?\>/

syn match daphnedslEscapeError /\\./ contained
syn match daphnedslEscape /\\[bfnrt"\\]/ contained
syn region daphnedslString start=/"/ end=/"/ contains=daphnedslEscape,daphnedslEscapeError

syn keyword daphnedslTodo TODO FIXME XXX NOTE contained
syn match daphnedslComment /#.*$/ contains=daphnedslTodo,@Spell
syn match daphnedslComment "//.*$" contains=daphnedslTodo,@Spell
syn region daphnedslComment start="/\*" end="\*/" contains=daphnedslTodo,@Spell

syn sync minlines=200

hi def link daphnedslConditional Conditional
hi def link daphnedslRepeat Repeat
hi def link daphnedslKeyword Keyword
hi def link daphnedslInclude Include
hi def link daphnedslDef Keyword
hi def link daphnedslType Type
hi def link daphnedslBoolean Boolean
hi def link daphnedslFloat Float
hi def link daphnedslNumber Number
hi def link daphnedslFunctionName Function
hi def link daphnedslFunction Function
hi def link daphnedslBuiltin Special
hi def link daphnedslKernel PreProc
hi def link daphnedslNamespace Structure
hi def link daphnedslScriptArg Special
hi def link daphnedslString String
hi def link daphnedslEscape SpecialChar
hi def link daphnedslEscapeError Error
hi def link daphnedslComment Comment
hi def link daphnedslTodo Todo

let b:current_syntax = 'daphnedsl'
