# Review

Review is a local desktop workspace for reviewing pull requests with Codex.

The first version is single-player. It reads pull requests from GitHub, caches review data in SQLite, generates review guides through the local Codex app-server, and stores review threads on the user's machine.

## Repository layout

```text
apps/desktop          Electron main and preload processes
apps/renderer         Vite, React, and the review interface
apps/local-server     Local HTTP service, SQLite, GitHub, Git, and Codex coordination
packages/contracts    Types shared across process boundaries
packages/codex-app-server  Codex app-server adapter boundary
```

The renderer has no Node.js access. Electron exposes a small preload bridge. The local service owns the database and all long-running work.

## Development

Requirements:

- Node.js 24 or newer
- pnpm 10

Install and run:

```bash
pnpm install
pnpm dev
```

Other checks:

```bash
pnpm build
pnpm typecheck
pnpm test
```

The local service listens on `127.0.0.1:4319` by default. Set `REVIEW_DATA_DIR` to change the local data directory.

