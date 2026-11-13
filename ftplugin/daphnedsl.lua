-- Neovim only: highlight with the tree-sitter parser instead of
-- syntax/daphnedsl.vim. Neovim runs ftplugin/daphnedsl.vim before this file.

if pcall(vim.treesitter.start) then
  vim.b.undo_ftplugin = (vim.b.undo_ftplugin or '') .. ' | lua vim.treesitter.stop()'
else
  vim.notify_once(
    'daphnedsl: tree-sitter parser not found, using regex highlighting. '
      .. 'Run `make` in the daphne-lsp plugin directory for precise highlighting.',
    vim.log.levels.WARN
  )
end
