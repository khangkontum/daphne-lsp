# daphne-lsp

Editor support for [DaphneDSL](https://github.com/daphne-eu/daphne), the language of the DAPHNE system (`.daphne` and `.daph` files): syntax highlighting, syntax errors while you type, and a formatter, in Neovim, Vim and VS Code.

## Demo

The same script in each editor. It has three syntax errors: a missing `;` on line 9, an unclosed `[` on line 12, and an unterminated string on line 18.

**Neovim**

![DaphneDSL in Neovim: highlighted code with three syntax errors shown next to their lines](docs/images/neovim.png)

**Vim**

![DaphneDSL in Vim: highlighted code with three syntax errors shown next to their lines](docs/images/vim.png)

**VS Code**

![DaphneDSL in VS Code: highlighted code with three syntax errors listed in the Problems panel](docs/images/vscode.png)

The colors come from your own color scheme. The Neovim and Vim screenshots use the built-in `retrobox`, and the VS Code screenshot uses Dark Modern.

## What is in this repository

| Part | Where | Status |
| --- | --- | --- |
| Tree-sitter grammar | `grammar.js`, `src/` | Checked against DAPHNE's own ANTLR grammar |
| Neovim syntax highlighting | `queries/`, `ftdetect/`, `ftplugin/` | Works |
| Vim syntax highlighting | `syntax/`, `ftdetect/`, `ftplugin/` | Works |
| VS Code extension | `vscode/` | Works, not published to the Marketplace |
| Language server | `server/`, `plugin/` | Reports syntax errors and formats documents in Neovim, Vim and VS Code |

## Installation

Open the section for your editor. Everything here was tested on Linux only.

<details>
<summary><b>Neovim</b></summary>

<br>

**Requirements**

| For | You need |
| --- | --- |
| Highlighting | A C compiler and `make`, to build the parser once |
| Syntax errors and formatting | Also Node.js, and Neovim 0.11 or newer |

**Install with lazy.nvim**

Highlighting, syntax errors and formatting:

```lua
{ 'khangkontum/daphne-lsp', build = 'make parser server' }
```

Highlighting only:

```lua
{ 'khangkontum/daphne-lsp', build = 'make' }
```

**Install with another plugin manager, or by hand**

Install the repository as a plugin, then run `make parser server` (or only `make`) in its directory. Without a plugin manager:

```sh
git clone https://github.com/khangkontum/daphne-lsp ~/.local/share/nvim/site/pack/plugins/start/daphne-lsp
cd ~/.local/share/nvim/site/pack/plugins/start/daphne-lsp
make parser server
```

`make server` runs `npm ci` and builds `server/dist/`. The first build downloads a WebAssembly toolchain, so it takes a while.

**Use**

Opening a `.daphne` or `.daph` file sets the filetype `daphnedsl`, starts tree-sitter highlighting, and starts the language server. Nothing needs to be configured, and nvim-treesitter is not required.

Neovim marks each error in the sign column and underlines it. To also show the message next to the line, as in the screenshot:

```lua
vim.diagnostic.config({ virtual_text = true })
```

Format the buffer with `:lua vim.lsp.buf.format()`. To format each time you save:

```lua
vim.api.nvim_create_autocmd('BufWritePre', {
  pattern = { '*.daphne', '*.daph' },
  callback = function() vim.lsp.buf.format() end,
})
```

Turn the language server off with `vim.lsp.enable('daphnedsl', false)`.

**Notes**

- Without the built parser, Neovim warns once and falls back to the regex highlighting that Vim uses.
- SQL inside `sql("...")` is highlighted when a tree-sitter parser for `sql` is installed.
- Tested with Neovim 0.12.6.

</details>

<details>
<summary><b>Vim</b></summary>

<br>

**Requirements**

| For | You need |
| --- | --- |
| Highlighting | `filetype plugin on` and `syntax on` in your vimrc. Nothing needs to be built |
| Syntax errors and formatting | Also Node.js, `make`, and an LSP client plugin: [yegappan/lsp](https://github.com/yegappan/lsp) or [vim-lsp](https://github.com/prabirshrestha/vim-lsp) |

**Install with vim-plug**

Highlighting, syntax errors and formatting:

```vim
Plug 'yegappan/lsp'
Plug 'khangkontum/daphne-lsp', { 'do': 'make server' }
```

Highlighting only:

```vim
Plug 'khangkontum/daphne-lsp'
```

**Install by hand**

```sh
git clone https://github.com/khangkontum/daphne-lsp ~/.vim/pack/plugins/start/daphne-lsp
cd ~/.vim/pack/plugins/start/daphne-lsp
make server   # only for syntax errors and formatting
```

`make server` runs `npm ci` and builds `server/dist/`. The first build downloads a WebAssembly toolchain, so it takes a while.

**Use**

Opening a `.daphne` or `.daph` file sets the filetype `daphnedsl` and highlights it. When the language server is built, the plugin registers it with whichever of the two LSP client plugins is installed. Nothing needs to be configured.

With yegappan/lsp, this shows the message next to the line, as in the screenshot:

```vim
autocmd User LspSetup call LspOptionsSet({'showDiagWithVirtualText': v:true, 'diagVirtualTextAlign': 'after'})
```

Format the buffer with `:LspFormat` (yegappan/lsp) or `:LspDocumentFormat` (vim-lsp). To format each time you save:

```vim
" yegappan/lsp
autocmd BufWritePre *.daphne,*.daph LspFormat
" vim-lsp
autocmd BufWritePre *.daphne,*.daph LspDocumentFormatSync
```

**Notes**

- Vim has no tree-sitter support, so it highlights with `syntax/daphnedsl.vim` (regular expressions). It does not highlight SQL inside `sql("...")`.
- Tested with Vim 9.1.

</details>

<details>
<summary><b>VS Code</b></summary>

<br>

**Requirements**

VS Code 1.91 or newer, and Node.js to build the extension. The extension is not on the Marketplace, so you build a `.vsix` file and install that.

**Install**

```sh
git clone https://github.com/khangkontum/daphne-lsp
cd daphne-lsp
npm ci
npm run build:vscode
cd vscode
npx @vscode/vsce package
code --install-extension daphnedsl-0.1.0.vsix
```

Instead of the last command, you can run "Extensions: Install from VSIX..." from the Command Palette.

**Use**

Opening a `.daphne` or `.daph` file highlights it and lists its syntax errors in the Problems panel (Ctrl+Shift+M). The extension runs the language server with the Node.js that is built into VS Code, and it also works in Restricted Mode.

Format with "Format Document" from the Command Palette. To format each time you save, add this to your settings:

```json
"[daphnedsl]": { "editor.formatOnSave": true }
```

**Notes**

- VS Code highlights with a TextMate grammar (regular expressions), not with the tree-sitter grammar, so it is less precise. For example, it cannot tell the `<` of `matrix<f64>` from a comparison.
- Tested with VS Code Server 1.146 in a browser, not with the desktop application.

</details>

<details>
<summary><b>Another editor with an LSP client</b></summary>

<br>

Build the language server with `make server` (it needs Node.js), then let your editor start it for DaphneDSL files with:

```sh
node /path/to/daphne-lsp/server/dist/server.cjs --stdio
```

This gives syntax errors and formatting (`textDocument/formatting`). Highlighting needs the tree-sitter grammar or the Vim syntax file from this repository.

</details>

## Language server

`server/` is a language server that parses each open document with the tree-sitter grammar (compiled to WebAssembly). It reports the document's syntax errors, and it formats the document on request.

It reports syntax errors only: a missing `;`, an unclosed bracket, an unterminated string, tokens that do not belong. It does not know about names or types, so it accepts `x = undefinedVariable + "a";`. DAPHNE's own compiler finds those errors when the script runs.

The messages are not DAPHNE's messages. The error is usually reported on the same line as DAPHNE reports it, but one mistake can produce more than one error, and an error in the middle of a statement can be reported a few tokens away from the real mistake.

With several errors in one file, the parser sometimes cannot recover, and the server then reports only one of them. The others appear once that one is fixed.

### Formatter

The style is fixed and has no options, like `gofmt`. The editor's tab size is ignored.

Before:

```
def  normalize ( X:matrix<f64>,eps )->matrix<f64>
{
  mu=mean(X,1);  sd = stddev(X,1)+eps ;   # column-wise
  if(sum(sd==0)>0)
        return X-mu;
  else
  {
     return (X-mu)/sd ;
  }
}

f = { "a":[1,2,3],
        "b" : [4.0,5.0,6.0] };
X=normalize(as.matrix<f64>(f),1e-9)[ ,0];
```

After:

```
def normalize(X: matrix<f64>, eps) -> matrix<f64> {
    mu = mean(X, 1);
    sd = stddev(X, 1) + eps; # column-wise
    if (sum(sd == 0) > 0)
        return X - mu;
    else {
        return (X - mu) / sd;
    }
}

f = {"a": [1, 2, 3],
    "b": [4.0, 5.0, 6.0]};
X = normalize(as.matrix<f64>(f), 1e-9)[, 0];
```

The style:

- 4 spaces for each block level, and no tabs.
- `{` goes on the line of its statement: `if (a) {`, `} else {`, `} while (a);`.
- Each statement gets its own line. A body without braces goes on the next line, indented.
- Spaces go around binary operators, `=`, `->`, and the `?` and `:` of a conditional. A space follows `,`, the `:` of `x: type` and of `"label": column`, and `if`, `for` and `while`.
- No space goes after a unary sign, inside brackets, before the `(` of a call, or around `.`, `::`, the `:` of a range and the `=` of a named argument: `fill(value=2, numRows=3)`.
- Indexing is written as in DAPHNE's language reference: `X[, 0]` and `X[1, ]`.
- Blank lines collapse to one, and go away at the start and end of a block. Lines have no trailing whitespace, and the file ends with one line break. Windows line endings are kept.

What the formatter does not do:

- It only changes whitespace. It never adds or removes braces, `;` or comments, and it never joins or splits a token.
- It does not wrap long lines. A line break that you put inside an expression stays, and the next line is re-indented.
- It does not change the text of a comment. A comment stays at the end of its line or on its own line, trailing comments are not aligned, and the later lines of a `/* ... */` comment keep the indentation they had.
- It does not format a document that has syntax errors, and it formats whole documents only, not a selection.

## Limitations

- Highlighting does not report errors. The language server does, and only syntax errors.
- Built-in functions are a list of names (`data/builtins.txt`) taken from DAPHNE's source. A variable with the same name as a built-in is highlighted as a function only where it is called.
- One known difference from DAPHNE's parser: DAPHNE reads `]]` as a single token, so it rejects `X[, [0, 2]]` and wants `X[, [0, 2] ]`. This grammar accepts both, and the formatter writes the form that DAPHNE accepts.

## Development

```sh
npm install
npx tree-sitter generate              # after editing grammar.js
make                                  # builds parser/daphnedsl.so for Neovim
node scripts/update-builtins.mjs      # rewrites the built-in lists from data/builtins.txt
npm run build                         # builds the language server into server/dist/
npm test                              # tests the language server; run `npm run build` first
npm run typecheck
```

`npm test` runs the TypeScript tests directly with Node.js, which needs Node.js 22.18 or newer.

`node scripts/update-builtins.mjs --from <DAPHNE checkout>` refreshes `data/builtins.txt` from DAPHNE's source first.

### Conformance check

`conformance/check.py` parses every DaphneDSL script in a DAPHNE checkout, plus `conformance/cases/`, with both this grammar and a parser generated from DAPHNE's `DaphneDSLGrammar.g4`. Both must agree on which scripts are valid and must produce the same syntax nodes at the same positions. It needs Python and Java.

```sh
pip install -r conformance/requirements.txt
python conformance/check.py "$(conformance/fetch-daphne.sh)"
```

`conformance/DAPHNE_REF` pins the DAPHNE commit. To follow a newer DAPHNE, change it, run the check, and port any grammar changes that it reports.
