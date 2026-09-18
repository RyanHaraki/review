# GitHub HTTP fixture

This local server replaces GitHub's device authorization and API endpoints in an isolated development app. It listens on an assigned loopback port. It never calls GitHub. Unknown API requests and mutations are rejected.

Start a fresh fixture and keep the process running:

```sh
node .agents/skills/verify-review/fixtures/github-review-server.mjs \
  --state /tmp/review-github-fixture-<unique-run>.json
```

The first JSON line gives the assigned `origin`. Start the isolated app with that origin for both endpoints:

```sh
PATH="$PWD/.agents/skills/verify-review/fixtures:$PATH" \
REVIEW_CODEX_FIXTURE_LOG=/tmp/review-github-fixture-<unique-run>.codex.jsonl \
REVIEW_GITHUB_AUTH_ORIGIN=http://127.0.0.1:<fixture-port> \
REVIEW_GITHUB_API_ORIGIN=http://127.0.0.1:<fixture-port> \
REVIEW_GITHUB_CLIENT_ID=review-fixture-client \
node .agents/skills/verify-review/control-review.mjs inspect snapshot --new-run
```

These endpoint overrides are for an unpackaged app only. The app still uses its device authorization flow and encrypted credential store. There is no injected session or token shortcut. Use the GitHub sign-in button in setup, then select `review-fixture/demo`. The verification URL in the device response is GitHub's standard device URL; the explicit development fixture mode prevents an external browser from opening.

The PATH override supplies a local Codex app-server fixture. It returns a connected account and a deterministic guide after two seconds. It never calls a model provider. `REVIEW_CODEX_FIXTURE_LOG` records generation counts without source text.

The fixture contains account 42, PR 42, a changed TypeScript file, an added TypeScript file, a binary file without a patch, a 4,000-line added file, and a review thread with a reply. The account's local routes are under `/accounts/42`.

Run the PR check with the CDP and local-service ports reported by the control CLI:

```sh
REVIEW_CODEX_FIXTURE_LOG=/tmp/review-github-fixture-<unique-run>.codex.jsonl \
node .agents/skills/verify-review/verify-pull-request-pages.mjs \
  http://127.0.0.1:<cdp-port> http://127.0.0.1:<server-port> \
  /tmp/review-github-fixture-<unique-run>.json \
  .agents/skills/verify-review/evidence/<run-id>
```

The check uses UI controls to authorize, select a repository, edit and preview Markdown, save drafts, restart the renderer, submit comments, reply, resolve and reopen threads, mark files as reviewed, open and close the comments sidebar, and scroll all files in unified view. It also verifies that Guide generates only after a click, completes after navigation away, displays code on first load, and reuses the saved result. It checks local draft records and fixture publication counts. Screenshots and `verification.json` are saved in the evidence directory.

## Authorization UI check

Start a separate fresh fixture and isolated app run with the same environment variables. Then run:

```sh
node .agents/skills/verify-review/fixtures/verify-github-session.mjs \
  <run-id> /tmp/review-github-fixture-<unique-run>.json \
  .agents/skills/verify-review/evidence/<run-id>
```

Keep the fixture environment variables set for this command. It restarts the owned Electron process with the same profile and local server. It checks denied sign-in, canceled polling, encrypted credential persistence after process restart, sign-out, account-specific preferences, and revoked credentials. The PR publication fixture check uses a different fresh run so its mutation counts remain independent.

## Authorization controls

The server reloads its state file for each request. Change these fields between requests to test authorization outcomes:

- `auth.outcome`: `approved`, `authorization_pending`, `access_denied`, `expired_token`, or `slow_down`.
- `auth.name`, `auth.email`, and `auth.avatarUrl`: set profile values to check the sidebar account control. Null values exercise username and initials.
- `auth.revoked`: set `true` to return 401 for API requests.
- `auth.accountId` and `auth.login`: change both before the next sign-in to test account switching. Existing tokens cannot access the new account.

Use pending authorization to test the Cancel button. Use app sign-out to test credential removal, and restart the same isolated app profile to test saved credentials. These controls do not write to the app database or bypass its sign-in flow.

`mutations` records description, discussion, line-comment, reply, resolve, and reopen publications. Saving local drafts must not change it. Submitting adds one entry; reads and reloads must not add duplicates. `requests` records HTTP methods and paths only. Credentials and request bodies are not logged there.

## Cleanup

Clean the isolated app run with `control-review.mjs health cleanup --run-id <run-id>`. Then stop the fixture process that you started. Keep evidence files. Do not use a normal app profile or database for this check.
