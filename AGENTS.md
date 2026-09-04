## General guidelines
- Use pascal case to name folders and files
- Prefer simpler, extendible solutions over novel ones
- If you are doing something like updating where data is stored, or making a migration on a model, do NOT leave any legacy fallbacks. If you are asked to update a data source or do a migration, your task is also to fully complete the migration and ensure the old data store is not used.

Anti-pattern
```typescript
// User has asked you to switch from storing prefernces in localStorage to Sqlite.
export async function readPreferences() {
  const legacyRepositories = legacyPreferences?.repositories
  const migratedPreferences: ReviewPreferences = {
    repositories: legacyRepositories,
    pullRequestStatuses: [...defaultPullRequestStatuses],
    setupComplete: legacySetupComplete,
  };
  return migratedPreferences;
}

```

Good
```typescript
// you full ymigrate from localStorage to sqlite and the function just becomes
export async function readPreferences() {
    return window.reviewDesktop.readPreferences(); // sqlite call
}

```


## Writing React code
- Avoid inline functions when writing react if they cause rerenders of child components. `onClick={() => void refresh()}` is an anti-pattern. Generally, you should wrap funcitons in useCallback and values in useMemo when you can.
  - Include a maximum of one component per file. Consider organizing the directory if you see that multiple components are needed for a certain piece of UI
  - When fetching data (especially in multiple components), prefer writing a custom hook. Do not fetch in a useEffect when the component mounts. 