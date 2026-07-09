#!/usr/bin/env bash
# PostToolUse(Edit|Write): lint edited SPA sources with the project's eslint config.
# Silent unless eslint reports something, in which case the output is fed back to Claude.
set -u

extract_path() {
  node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.stdout.write(j.tool_response?.filePath||j.tool_input?.file_path||"")}catch(e){}})'
}

file=$(extract_path)
[ -n "$file" ] || exit 0

# Normalize Windows separators so the glob below matches either form.
norm=${file//\\//}

case "$norm" in
  */oed-admin.client/src/*.ts|*/oed-admin.client/src/*.tsx) ;;
  *) exit 0 ;;
esac

root="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
cd "$root/oed-admin.client" 2>/dev/null || exit 0

out=$(npx --no-install eslint "$norm" 2>&1)
[ -n "$out" ] || exit 0

node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  process.stdout.write(JSON.stringify({
    hookSpecificOutput:{
      hookEventName:"PostToolUse",
      additionalContext:"eslint reported issues in the file you just edited:\n\n"+s
    }
  }));
})' <<<"$out"
