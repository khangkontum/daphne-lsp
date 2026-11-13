" Vim only: register the DaphneDSL language server with the LSP client plugin
" that is installed (yegappan/lsp or prabirshrestha/vim-lsp), once the server
" has been built with `make server`. Needs Node.js.
" Neovim uses plugin/daphnedsl.lua instead.

if has('nvim') || exists('g:loaded_daphnedsl')
  finish
endif
let g:loaded_daphnedsl = 1

let s:server = expand('<sfile>:p:h:h') .. '/server/dist/server.cjs'
if !executable('node') || !filereadable(s:server)
  finish
endif

augroup daphnedsl_lsp
  autocmd!
  " yegappan/lsp
  autocmd User LspSetup call LspAddServer([#{
        \ name: 'daphnedsl',
        \ filetype: 'daphnedsl',
        \ path: 'node',
        \ args: [s:server, '--stdio'],
        \ }])
  " prabirshrestha/vim-lsp
  autocmd User lsp_setup call lsp#register_server(#{
        \ name: 'daphnedsl',
        \ cmd: ['node', s:server, '--stdio'],
        \ allowlist: ['daphnedsl'],
        \ })
augroup END
