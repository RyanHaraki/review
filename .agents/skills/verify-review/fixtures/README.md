# GitHub review fixture

This CLI replaces `gh` only in an isolated verification process. It never calls GitHub. It requires an absolute `REVIEW_GITHUB_FIXTURE_STATE` path and rejects unknown commands and mutation endpoints.

Initialize a new state file before launching the app:

```sh
export REVIEW_GITHUB_FIXTURE_STATE="/tmp/review-ui-fixture-$(date +%s).json"
node .agents/skills/verify-review/fixtures/github-review-cli.mjs --init
PATH="$PWD/.agents/skills/verify-review/fixtures:$PATH" pnpm verify:review inspect snapshot --new-run
```

Use the verification CLI's isolated profile and database. Select `review-fixture/demo` in setup. It contains PR 42, a changed TypeScript file, an added TypeScript file, a binary file without a patch, a 4,000-line added file for virtualization checks, and an existing review thread with a reply.

The fixture stores remote descriptions, discussion comments, review threads, and resolution state in the JSON file. The `mutations` array records each publication. Typing and saving local drafts must leave this array unchanged. Submit must append one mutation. Repeat checks and reloads must not append a duplicate.

Use a new state path for a new run. Keep the fixture directory first in PATH only for the isolated app command. Do not put this shim in your shell profile.

Run the complete UI check with the CDP port and server origin from the new run:

```sh
node .agents/skills/verify-review/verify-pull-request-pages.mjs \
  http://127.0.0.1:<cdp-port> http://127.0.0.1:<server-port> \
  "$REVIEW_GITHUB_FIXTURE_STATE" .agents/skills/verify-review/evidence/<run-id>
```

The check uses UI controls to edit and preview Markdown, save drafts, restart the renderer, submit comments, reply, resolve and reopen threads, mark files as reviewed, open and close the comments sidebar, and scroll all files in unified view. It verifies local draft records and fixture publication counts. It writes screenshots and `verification.json` to the evidence directory.
