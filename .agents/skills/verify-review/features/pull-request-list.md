# Pull-request list

## Sub-features

- Load pull requests for selected repositories.
- Group rows by selected status.
- Select a row and show its details.
- Open the pull request in GitHub.

## How to get to it (user POV)

Complete setup, or start Review with `setupComplete: true` and saved repositories. Wait for the loading state to end.

## Driving it with CDP

Find the `Pull requests` heading and a button containing a pull-request title, repository, and number. Click that button through Playwright. Confirm the detail pane shows the matching repository and number, title, author, review state, and additions and deletions. The list uses the `Refresh` button to request fresh data.

## Gotchas

GitHub failures can leave a repository marked unavailable. A cached result may still appear. Record both the visible state and the local-server health response.
