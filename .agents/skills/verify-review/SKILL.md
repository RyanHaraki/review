---
name: verify-review
description: Drive the Review macOS Electron desktop app and prove setup and pull-request browsing work. Use after UI, desktop, local-server, or GitHub integration changes.
---

# Verify Review

## Launch

The verification CLI owns the isolated run. Start it from the repository root:

```sh
node .agents/skills/verify-review/control-review.mjs inspect info
```

The CLI builds the app, starts the local service on an OS-assigned port, starts Electron with an isolated profile, starts CDP on another assigned port, and waits for the Review renderer.

Use `--new-run` to create another isolated run. Use `--run-id <id>` when more than one run exists.

For a production-build check with Chrome DevTools Protocol (CDP), run this from `apps/desktop` after `pnpm build`:

```sh
/Users/ryanharaki/Desktop/projects/review/node_modules/.pnpm/electron@44.1.1/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron . --user-data-dir=/tmp/review-verify-profile --remote-debugging-port=9222
```

The Electron process must print a DevTools listening message. Use a different free port if 9222 is in use, and pass the same port to the doctor and CDP client.

Stop only the processes or terminal sessions started by the run. Do not kill by process name.

## Doctor

Run this before driving the UI when the app is not ready:

```sh
node .agents/skills/verify-review/control-review.mjs health doctor
```

The TOON response checks the Review process, local server, CDP connection, renderer page, and React Doctor. It refuses unknown process ownership.

For a low-level CDP check, read the port from `inspect info` and run:

```sh
curl -fsS http://127.0.0.1:9222/json/version
```

The response must include a WebSocket debugger URL. Check port ownership with `lsof -nP -iTCP:9222 -sTCP:LISTEN`; the owner must be the Electron process started for this run.

## Drive

Use the verification CLI for CDP actions, DOM assertions, screenshots, traces, profiles, recordings, console events, network events, and metrics:

```sh
node .agents/skills/verify-review/control-review.mjs inspect snapshot
node .agents/skills/verify-review/control-review.mjs interact aria-click button Refresh
node .agents/skills/verify-review/control-review.mjs performance trace --duration 10s
```

For a low-level CDP operation that the CLI does not expose, use `node_repl` and the bundled `playwright-core` package:

```js
const {createRequire} = await import("node:module");
const require = createRequire("/Users/ryanharaki/Desktop/projects/review/.cdp-verify.cjs");
const {chromium} = require("/Users/ryanharaki/Desktop/projects/review/node_modules/.pnpm/playwright-core@1.62.1/node_modules/playwright-core/index.js");
const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
const page = browser.contexts().flatMap((context) => context.pages()).find((candidate) => candidate.url().startsWith("file:///Users/ryanharaki/Desktop/projects/review/apps/desktop/out/renderer/index.html"));
```

Find the page whose URL starts with `file:///Users/ryanharaki/Desktop/projects/review/apps/desktop/out/renderer/index.html`. Use role and accessible-name locators such as `page.getByRole("button", {name: /blog posts/})`, `page.getByRole("button", {name: "Refresh"})`, and `page.getByRole("combobox", {name: /status/})`. Capture a screenshot with `page.screenshot({path: ".agents/skills/verify-review/evidence/<name>.png", fullPage: true})`.

Use macOS Computer Use through `node_repl` and `@oai/sky` only when CDP cannot expose a native Electron or external-browser action. Start with `sky.get_app_state` for the Electron app, then refresh the state after every action. Prefer accessibility element indexes and labels over coordinates.

Stable handles include:

- Setup: `Get started with Review`, `GitHub CLI`, `Codex`, `Repositories`, `Get started`, `Check again`, and `Connect Codex`.
- Pull requests: `Pull requests`, `Filter pull requests by repository`, `Filter pull requests by status`, `Refresh`, pull-request buttons containing the title and repository, and `Open in GitHub`.

Exercise the user path. For the pull-request proof, wait for the list to load, click a pull-request button, and confirm the detail pane shows the same title, repository, author, review state, and change counts. For setup, confirm all three steps before using `Get started`; do not call IPC methods directly.

## Evidence

Store proof files in `.agents/skills/verify-review/evidence/`. Capture the accessibility tree or terminal transcript before the action, the action itself, and the resulting state. Screenshots may support the transcript, but a final screenshot alone is not proof.

Verify side effects with the local service. After changing preferences in the UI, read `GET http://127.0.0.1:4319/preferences` and confirm the selected repositories, statuses, and `setupComplete` value. For pull-request loading, confirm the visible title and detail values against the UI result. Do not use internal setters or test-only endpoints.

GitHub and Codex are external boundaries. Use the authenticated local sessions only when the run needs them. Do not submit sign-in forms or transmit credentials during verification.

## Cleanup

Close the Electron window created by the run. Stop the local-server and desktop terminal sessions created by the run. Remove only a scratch directory created for this run, such as `/tmp/review-verify-profile` or a run-specific `REVIEW_DATA_DIR`. Keep all files in `.agents/skills/verify-review/evidence/`.

The CLI allocates isolated ports and data directories. Do not reuse the normal `~/.review` database during verification.

## Helpers

The CLI is the helper. Use its `--help` output and the commands in this file directly.
