# First-run setup

## Sub-features

- Check the GitHub CLI session.
- Check or connect the local Codex session.
- Choose at least one repository.
- Save setup and open the pull-request list.

## How to get to it (user POV)

Start Review with no completed preferences, or open the setup route at `#/setup`. Wait for the three setup steps to report their state.

## Driving it with CDP

Connect Playwright to the Electron CDP endpoint and find `Get started with Review`, `GitHub CLI`, `Codex`, and `Repositories` by role or accessible name. If a connection is missing, use its visible button and observe the result. Select a repository through the `Repositories` combobox. Click `Get started` only when the progress reads `3/3`. Confirm the window navigates to `Pull requests` and read `GET http://127.0.0.1:4319/preferences`.

## Gotchas

GitHub repository choices require an authenticated `gh` session. Codex sign-in opens an external browser. Do not automate credential entry. The app stores preferences in the local SQLite database through the local service.
