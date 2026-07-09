#!/usr/bin/env bash
# PostToolUse(Write): a new Features/<Area>/<Op>/Endpoint.cs is unreachable until it is
# registered in Features/Endpoints.cs with an authorization policy. Remind only when the
# registration is actually missing, so this stays quiet on edits to existing endpoints.
set -u

file=$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.stdout.write(j.tool_response?.filePath||j.tool_input?.file_path||"")}catch(e){}})')
[ -n "$file" ] || exit 0

norm=${file//\\//}
case "$norm" in
  */oed-admin.Server/Features/*/Endpoint.cs) ;;
  *) exit 0 ;;
esac

root="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
registry="$root/oed-admin.Server/Features/Endpoints.cs"
[ -f "$registry" ] || exit 0

# Strip everything up to Features/ and the trailing /Endpoint.cs, leaving Area[/Op].
slug=${norm##*/Features/}
slug=${slug%/Endpoint.cs}
symbol=${slug//\//.}

# Already wired up? Then say nothing.
grep -qF "$symbol.Endpoint" "$registry" && exit 0

msg="New endpoint '$slug' is not yet registered. Minimal APIs here are wired up centrally: add a route for ${symbol}.Endpoint in oed-admin.Server/Features/Endpoints.cs, and attach an authorization policy (AuthorizationPolicies.RequireAdminRole, or AtLeastReadRole for read-only lookups). Until then the route does not exist. If it returns estate data without an {estateId} route value, also confirm AuditingLoggingMiddleware can still extract the estate id."

MSG="$msg" node -e '
process.stdout.write(JSON.stringify({
  hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:process.env.MSG}
}));'
