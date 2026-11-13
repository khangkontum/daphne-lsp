; The query passed to the built-in function `sql` is SQL.
((call_expr
  !namespace
  function: (identifier) @_function
  (call_args
    .
    (call_arg
      !param
      value: (string) @injection.content)))
  (#eq? @_function "sql")
  (#offset! @injection.content 0 1 0 -1)
  (#set! injection.language "sql"))

((comment) @injection.content
  (#set! injection.language "comment"))
