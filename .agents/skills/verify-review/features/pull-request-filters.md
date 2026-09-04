# Pull-request filters

## Sub-features

- Filter by repository.
- Filter by pull-request status.
- Persist filter changes.
- Show an empty-state message when no rows match.

## How to get to it (user POV)

Open the pull-request list and use the repository or status filter above the sidebar.

## Driving it with CDP

Find `Filter pull requests by repository` or `Filter pull requests by status`. Open the combobox through Playwright, choose a visible item, and wait for the list to update. Confirm the selection count in the combobox and read `/preferences` to confirm the saved value. If no row matches, confirm the status text `No pull requests match the selected statuses.`

## Gotchas

The repository filter is disabled while repository choices load or fail. The current status choices are Draft, Open, In review, Approved, Merged, and Closed. The default statuses are Draft and Open, but existing saved preferences may select more.
