# First-run setup

## Sub-features

- Sign in to GitHub with the device authorization flow.
- Check or connect the local Codex session.
- Install the GitHub App in an organization or personal account and confirm access.
- Choose at least one repository.
- Save setup and open the pull-request list.

## How to get to it (user POV)

Start Review with no completed preferences, or open the setup route at `#/setup`. Wait for the four setup steps to report their state.

## Driving it with CDP

Connect Playwright to the Electron CDP endpoint and find `Get started with Review`, `GitHub`, `Codex`, `Install the GitHub app`, and `Choose repositories` by role or accessible name. If a connection is missing, use its visible button and observe the result. Select a repository through the `Repositories` combobox. Click `Get started` only when the progress reads `4/4`. Confirm the window navigates to `Pull requests` and read `GET <isolated-server-origin>/accounts/<signed-in-account-id>/preferences`.

## Gotchas

GitHub repository choices require a signed-in account and repository access granted to the Review GitHub App. The GitHub step has `Sign in with GitHub`, `Cancel sign-in`, and `Sign out` controls. The header `Account` link returns to setup. Use the local HTTP fixture for denial, cancellation, revocation, and account-switch checks. Codex sign-in opens an external browser. Do not automate credential entry. The app stores preferences in the local SQLite database through the local service.
