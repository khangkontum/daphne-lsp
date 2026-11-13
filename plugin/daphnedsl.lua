-- Neovim only: start the language server in DaphneDSL buffers, once it has
-- been built with `make server`. Needs Neovim 0.11+ and Node.js.
-- Turn it off with `vim.lsp.enable('daphnedsl', false)`.

if not vim.lsp.enable then
  return
end

local root = vim.fs.dirname(vim.fs.dirname(debug.getinfo(1, 'S').source:sub(2)))
local server = root .. '/server/dist/server.cjs'

if vim.fn.executable('node') == 1 and vim.uv.fs_stat(server) then
  vim.lsp.config('daphnedsl', {
    cmd = { 'node', server, '--stdio' },
    filetypes = { 'daphnedsl' },
  })
  vim.lsp.enable('daphnedsl')
end
