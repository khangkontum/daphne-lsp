"""Checks the tree-sitter grammar against DAPHNE's own ANTLR grammar.

Both parsers read every DaphneDSL script in a DAPHNE checkout, plus the scripts
in conformance/cases/. For each script they must agree on whether it is
syntactically valid, and for valid scripts they must produce the same syntax
nodes at the same source positions (so precedence and associativity match too).

Usage: python conformance/check.py <path to a DAPHNE checkout>

Scripts listed in conformance/known-divergences.txt are skipped.
"""

import re
import subprocess
import sys
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
GENERATED = REPO / ".cache" / "antlr"
TREE_SITTER = REPO / "node_modules" / ".bin" / "tree-sitter"
ANTLR_VERSION = "4.13.2"

# ANTLR rule context -> tree-sitter node type. Contexts that are missing here
# (e.g. `statement`, `literal`) have no node of their own in tree-sitter.
ANTLR_TO_NODE = {
    "ImportStatement": "import_statement",
    "BlockStatement": "block_statement",
    "ExprStatement": "expr_statement",
    "AssignStatement": "assign_statement",
    "IfStatement": "if_statement",
    "WhileStatement": "while_statement",
    "ForStatement": "for_statement",
    "FunctionStatement": "function_statement",
    "ReturnStatement": "return_statement",
    "FunctionArgs": "function_args",
    "FunctionArg": "function_arg",
    "FunctionRetTypes": "function_ret_types",
    "LiteralExpr": "literal",
    "ArgExpr": "arg_expr",
    "IdentifierExpr": "identifier_expr",
    "ParanthesesExpr": "parenthesized_expr",
    "CallExpr": "call_expr",
    "CastExpr": "cast_expr",
    "RightIdxFilterExpr": "right_idx_filter_expr",
    "RightIdxExtractExpr": "right_idx_extract_expr",
    "MinusExpr": "unary_expr",
    "MatmulExpr": "binary_expr",
    "PowExpr": "binary_expr",
    "ModExpr": "binary_expr",
    "MulExpr": "binary_expr",
    "AddExpr": "binary_expr",
    "CmpExpr": "binary_expr",
    "ConjExpr": "binary_expr",
    "DisjExpr": "binary_expr",
    "CondExpr": "cond_expr",
    "MatrixLiteralExpr": "matrix_literal",
    "ColMajorFrameLiteralExpr": "col_major_frame_literal",
    "RowMajorFrameLiteralExpr": "row_major_frame_literal",
    "FrameRow": "frame_row",
    "CallArgs": "call_args",
    "CallArg": "call_arg",
    "Indexing": "indexing",
    "Range": "range",
}

# tree-sitter node types that ANTLR represents differently.
NODE_ALIASES = {
    "do_while_statement": "while_statement",
    "integer": "literal",
    "float": "literal",
    "boolean": "literal",
    "string": "literal",
}
COMPARED_NODES = set(ANTLR_TO_NODE.values())

# One node in the output of `tree-sitter parse`, e.g. `path: (string [1, 7] - [1, 17])`.
NODE_LINE = re.compile(r"^\s*(?:(\w+): )?\((\w+) \[(\d+), (\d+)\] - \[(\d+), (\d+)\]")
# The strings of an import statement are plain tokens in ANTLR, not literal expressions.
TOKEN_ONLY_FIELDS = {"path", "alias"}


def generate_antlr_parser(grammar: Path) -> None:
    GENERATED.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["antlr4", "-v", ANTLR_VERSION, "-Dlanguage=Python3", "-o", str(GENERATED), "-Xexact-output-dir", str(grammar)],
        check=True,
    )
    sys.path.insert(0, str(GENERATED))


def antlr_nodes(text: str):
    """Returns the Counter of (node type, start byte, end byte), or None if ANTLR reports a syntax error."""
    from antlr4 import CommonTokenStream, InputStream, ParserRuleContext
    from antlr4.error.ErrorListener import ErrorListener

    from DaphneDSLGrammarLexer import DaphneDSLGrammarLexer
    from DaphneDSLGrammarParser import DaphneDSLGrammarParser

    class Errors(ErrorListener):
        count = 0

        def syntaxError(self, *args):
            self.count += 1

    errors = Errors()
    lexer = DaphneDSLGrammarLexer(InputStream(text))
    lexer.removeErrorListeners()
    lexer.addErrorListener(errors)
    parser = DaphneDSLGrammarParser(CommonTokenStream(lexer))
    parser.removeErrorListeners()
    parser.addErrorListener(errors)
    tree = parser.script()
    if errors.count:
        return None

    # ANTLR counts characters, tree-sitter counts bytes.
    byte_offset = [0]
    for char in text:
        byte_offset.append(byte_offset[-1] + len(char.encode("utf-8")))

    nodes = Counter()
    pending = [tree]
    while pending:
        ctx = pending.pop()
        node = ANTLR_TO_NODE.get(type(ctx).__name__.removesuffix("Context"))
        if node:
            nodes[(node, byte_offset[ctx.start.start], byte_offset[ctx.stop.stop + 1])] += 1
        pending.extend(child for child in ctx.getChildren() if isinstance(child, ParserRuleContext))
    return nodes


def tree_sitter_nodes(path: Path, data: bytes):
    """Same as antlr_nodes(), for the tree-sitter parser."""
    result = subprocess.run([str(TREE_SITTER), "parse", str(path)], cwd=REPO, capture_output=True, text=True)
    if result.returncode != 0:
        if "(ERROR" not in result.stdout and "(MISSING" not in result.stdout:
            raise RuntimeError(f"tree-sitter failed on {path}:\n{result.stderr or result.stdout}")
        return None

    line_start = [0]
    for line in data.split(b"\n"):
        line_start.append(line_start[-1] + len(line) + 1)

    nodes = Counter()
    for line in result.stdout.splitlines():
        match = NODE_LINE.match(line)
        if not match or match[1] in TOKEN_ONLY_FIELDS:
            continue
        node = NODE_ALIASES.get(match[2], match[2])
        if node in COMPARED_NODES:
            start = line_start[int(match[3])] + int(match[4])
            end = line_start[int(match[5])] + int(match[6])
            nodes[(node, start, end)] += 1
    return nodes


def describe(nodes: Counter, data: bytes, limit: int = 5) -> str:
    lines = []
    for node, start, end in sorted(nodes, key=lambda n: (n[1], n[2]))[:limit]:
        lines.append(f"      {node} `{data[start:end].decode('utf-8', 'replace')}`")
    return "\n".join(lines)


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    daphne = Path(sys.argv[1]).resolve()
    generate_antlr_parser(daphne / "src/parser/daphnedsl/DaphneDSLGrammar.g4")

    known = {
        line.split("#")[0].strip()
        for line in (REPO / "conformance/known-divergences.txt").read_text().splitlines()
        if line.split("#")[0].strip()
    }
    scripts = [
        (path, f"daphne/{path.relative_to(daphne)}")
        for pattern in ("*.daphne", "*.daph")
        for path in daphne.rglob(pattern)
        if "thirdparty" not in path.parts
    ]
    scripts += [(path, f"cases/{path.name}") for path in (REPO / "conformance/cases").glob("*.daphne")]
    scripts = sorted((path, name) for path, name in scripts if name not in known)

    contents = [path.read_bytes() for path, _ in scripts]
    with ThreadPoolExecutor() as pool:
        from_tree_sitter = list(pool.map(tree_sitter_nodes, [path for path, _ in scripts], contents))

    failures = 0
    valid = 0
    for (path, name), data, actual in zip(scripts, contents, from_tree_sitter):
        expected = antlr_nodes(data.decode("utf-8"))
        if expected is None and actual is None:
            continue
        if expected is None or actual is None:
            failures += 1
            rejecting = "ANTLR" if expected is None else "tree-sitter"
            print(f"FAIL {name}\n    only {rejecting} reports a syntax error")
        elif expected != actual:
            failures += 1
            print(f"FAIL {name}\n    the syntax trees differ")
            print(f"    only in ANTLR:\n{describe(expected - actual, data)}")
            print(f"    only in tree-sitter:\n{describe(actual - expected, data)}")
        else:
            valid += 1

    invalid = len(scripts) - valid - failures
    print(f"{len(scripts)} scripts: {valid} valid with identical trees, {invalid} rejected by both, {failures} failures")
    print(f"{len(known)} known divergences skipped")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
