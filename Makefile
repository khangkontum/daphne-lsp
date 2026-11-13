# `make` builds the tree-sitter parser as a shared library that Neovim loads
# from `parser/daphnedsl.so` on its runtimepath.
# `make server` builds the language server into `server/dist/`.

CC ?= cc
CFLAGS ?= -O2

parser/daphnedsl.so: src/parser.c
	mkdir -p parser
	$(CC) $(CFLAGS) -shared -fPIC -I src -o $@ $<

.PHONY: parser server clean

parser: parser/daphnedsl.so

server:
	npm ci
	npm run build

clean:
	rm -rf parser server/dist
