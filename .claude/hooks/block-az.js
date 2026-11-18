#!/usr/bin/env node
// PreToolUse hook: block every shell command that invokes the Azure CLI, except
// a single read-only Application Insights call.
//
// This hook is the only gate on az: permissions.deny rules only match the start
// of a command (missing `foo && az ...`, `x | az ...`, `$(az ...)`), and they
// cannot express "everything except". So .claude/settings.json has no az deny
// rules, and this hook fails closed.
//
// Allowed, as the WHOLE command and nothing else (case-sensitive):
//   az monitor app-insights query | metrics show | metrics get-metadata | events show
// Arguments: unquoted tokens of [A-Za-z0-9_\-.:/=,+%]; single-quoted strings
// without a quote; double-quoted strings without $ ` \ or newlines; no quoted
// value starting with @ (az reads @path as a file); no --debug.
// `component show` is excluded on purpose: it returns the connection string.
// Mirrors the user-level ~/.claude/hooks/block-az.ps1.

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

// One unquoted CHARACTER per repetition, not [...]+ : a nested (x+)+ backtracks
// exponentially on a long non-matching argument and hangs the hook.
const ARG = "(?:[A-Za-z0-9_\\-.:/=,+%]|'(?!@)[^']*'|\"(?!@)[^\"$`\\\\\\r\\n]*\")+";
const ALLOWED = new RegExp(
  "^[ \\t]*az[ \\t]+monitor[ \\t]+app-insights[ \\t]+" +
    "(?:query|metrics[ \\t]+show|metrics[ \\t]+get-metadata|events[ \\t]+show)" +
    "(?:[ \\t]+" + ARG + ")*[ \\t]*$",
);
const DEBUG = /(?:^|[ \t])--debug(?=[ \t=]|$)/i;

function deny() {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason:
          "The Azure CLI is off limits to Claude in this repo, except a single read-only " +
          "`az monitor app-insights query|metrics show|metrics get-metadata|events show` call " +
          "(KQL in single quotes, no @file arguments, no --debug, no chaining). " +
          "`az login` is a developer setup step — run it yourself with `! az login`.",
      },
    }),
  );
  process.exit(0);
}

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  let command = "";
  try {
    command = JSON.parse(raw)?.tool_input?.command ?? "";
  } catch {
    // Unreadable payload: no deny rule backs this hook, so fail closed.
    if (AZ.test(raw)) deny();
    process.exit(0);
  }

  if (!AZ.test(command)) process.exit(0);
  if (ALLOWED.test(command) && !DEBUG.test(command)) process.exit(0);
  deny();
});
