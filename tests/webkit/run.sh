#!/bin/zsh
# 在 WKWebView 里把 CSS 动效和界面组件全画一遍，报错或空白就失败。样张存到第一个参数指定的目录。
set -u
ROOT="${0:A:h:h:h}"
OUT="${1:-${TMPDIR:-/tmp}/datamotion-webkit}"
BIN="${TMPDIR:-/tmp}/datamotion-wkrun"
mkdir -p "$OUT"
[[ "$BIN" -nt "$ROOT/tests/webkit/main.swift" ]] || swiftc -O -o "$BIN" "$ROOT/tests/webkit/main.swift" -framework AppKit -framework WebKit || exit 1
report="$(perl -e 'alarm shift @ARGV; exec @ARGV' 300 "$BIN" "$ROOT/mac/Resources/stage.html" "$ROOT/tests/webkit/sheet.js" "$OUT" 2>&1)"
print -r -- "$report" | grep -E '^(errs|blank|total|出错|结果)' | cut -c1-600
print -r -- "$report" | grep -q '^errs \[\]' && print -r -- "$report" | grep -q '^blank \[\]'
