#!/usr/bin/env node
// PreToolUse hook: block any shell command that invokes the Azure CLI.
//
// The permissions.deny rules in .claude/settings.json only match the start of
// a command, so they miss `foo && az ...`, `x | az ...`, `$(az ...)` and the
// like. This scans the whole command string for a standalone `az` token.
//
// A token is delimited by whitespace, shell separators or quotes. This matches
// `az`, `az.exe`/`az.cmd`/`az.bat` and path-qualified forms like /usr/bin/az,
// but not `azure`, `topaz`, `--az` or `foo-az`.
const DELIM = "[\\s;&|(){}`'\"<>]";
const AZ = new RegExp(
  "(?:^|" + DELIM + ")" + // start of string or a shell delimiter
    "(?:[^\\s;&|(){}`'\"<>]*[/\\\\])?" + // optional leading path
    "az(?:\\.(?:exe|cmd|bat))?" + // the token itself
    "(?=$|" + DELIM + ")", // must end the token
  "i",
);

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  let command = "";
  try {
    command = JSON.parse(raw)?.tool_input?.command ?? "";
  } catch {
    process.exit(0); // Unreadable payload: let the deny rules handle it.
  }

  if (AZ.test(command)) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason:
            "The Azure CLI is off limits to Claude in this repo. `az login` is a " +
            "developer setup step — run it yourself with `! az login`.",
        },
      }),
    );
  }
  process.exit(0);
});
