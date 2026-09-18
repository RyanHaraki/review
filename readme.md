# Review

Review is a local desktop workspace for reviewing pull requests with Codex.

The first version is single-player. It reads pull requests from GitHub, caches review data in SQLite, generates review guides through the local Codex app-server, and stores review threads on the user's machine.

## Repository layout

```text
apps/desktop          Electron main and preload processes
apps/renderer         Vite, React, and the review interface
apps/local-server     Local HTTP service and account-scoped SQLite storage
packages/contracts    Types shared across process boundaries
packages/codex-app-server  Codex app-server adapter boundary
```

The renderer has no Node.js access. Electron exposes a small preload bridge. The local service owns the databases. Electron main owns GitHub sessions, GitHub API requests, and guide generation through Codex.

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

## GitHub sign-in

Review uses the `diligent-review` GitHub App and OAuth Device Flow. In setup, choose **Sign in with GitHub**, enter the displayed code on GitHub, and authorize Review. Install the GitHub App on the repositories you want to review, then refresh the repository list. An organization owner may need to approve the installation.

The app registration requires these repository permissions:

- Pull requests: read and write.
- Contents: read-only.
- Metadata: read-only.

Enable Device Flow and token expiration. Leave **Request user authorization during installation** unchecked. Webhooks are not used.

The public client ID is included in the desktop app. `REVIEW_GITHUB_CLIENT_ID` can override it for development. No client secret, app private key, personal access token, or GitHub CLI is required. GitHub requests run in Electron main. Access and refresh tokens stay in an encrypted file under Electron's user data directory. The OS protects the encryption key through Electron `safeStorage`. Review refuses unprotected credential storage.

Review refreshes expired access tokens and saves the rotated token pair. **Sign out of GitHub** removes local credentials. To revoke the authorization on GitHub, use [GitHub's authorized apps settings](https://github.com/settings/apps/authorizations).

Each GitHub account has a separate database at `~/.review/accounts/github.com/<user-id>/review.sqlite`. Signing out preserves that account's drafts, preferences, reviewed files, and guides. The previous unscoped `~/.review/review.sqlite` is preserved but is no longer read. It has no account ownership record, so Review does not assign its private data to a new login automatically.

The local [HTTP fixture](.agents/skills/verify-review/fixtures/README.md) verifies authentication and review actions without posting to GitHub. Fixture endpoint overrides are limited to loopback addresses in unpackaged builds.
