export const migration001 = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS repositories (
    id TEXT PRIMARY KEY,
    github_id INTEGER NOT NULL UNIQUE,
    owner TEXT NOT NULL,
    name TEXT NOT NULL,
    default_branch TEXT NOT NULL,
    etag TEXT,
    fetched_at TEXT NOT NULL,
    UNIQUE(owner, name)
  );

  CREATE TABLE IF NOT EXISTS pull_requests (
    id TEXT PRIMARY KEY,
    repository_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    github_id INTEGER NOT NULL UNIQUE,
    number INTEGER NOT NULL,
    title TEXT NOT NULL,
    state TEXT NOT NULL CHECK(state IN ('open', 'closed', 'merged')),
    author_login TEXT NOT NULL,
    base_sha TEXT NOT NULL,
    head_sha TEXT NOT NULL,
    etag TEXT,
    fetched_at TEXT NOT NULL,
    UNIQUE(repository_id, number)
  );

  CREATE TABLE IF NOT EXISTS pull_request_files (
    id TEXT PRIMARY KEY,
    pull_request_id TEXT NOT NULL REFERENCES pull_requests(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('added', 'changed', 'removed', 'renamed')),
    additions INTEGER NOT NULL,
    deletions INTEGER NOT NULL,
    patch TEXT,
    UNIQUE(pull_request_id, path)
  );

  CREATE TABLE IF NOT EXISTS review_revisions (
    id TEXT PRIMARY KEY,
    pull_request_id TEXT NOT NULL REFERENCES pull_requests(id) ON DELETE CASCADE,
    head_sha TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('pending', 'generating', 'ready', 'failed')),
    guide_markdown TEXT,
    generated_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(pull_request_id, head_sha)
  );

  CREATE TABLE IF NOT EXISTS threads (
    id TEXT PRIMARY KEY,
    review_revision_id TEXT NOT NULL REFERENCES review_revisions(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    citations_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sync_state (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_pull_requests_repository_updated
    ON pull_requests(repository_id, fetched_at DESC);

  CREATE INDEX IF NOT EXISTS idx_review_revisions_pull_request_created
    ON review_revisions(pull_request_id, created_at DESC);

  CREATE INDEX IF NOT EXISTS idx_threads_review_updated
    ON threads(review_revision_id, updated_at DESC);

  CREATE INDEX IF NOT EXISTS idx_messages_thread_created
    ON messages(thread_id, created_at);
`;

export const migration002 = `
  CREATE TABLE IF NOT EXISTS pull_request_summaries (
    repository TEXT NOT NULL,
    github_id TEXT NOT NULL,
    number INTEGER NOT NULL,
    title TEXT NOT NULL,
    author_login TEXT NOT NULL,
    author_avatar_url TEXT,
    additions INTEGER NOT NULL,
    deletions INTEGER NOT NULL,
    updated_at TEXT NOT NULL,
    is_draft INTEGER NOT NULL CHECK(is_draft IN (0, 1)),
    url TEXT NOT NULL,
    head_ref_name TEXT NOT NULL,
    base_sha TEXT NOT NULL,
    head_sha TEXT NOT NULL,
    review_state TEXT NOT NULL CHECK(review_state IN ('approved', 'changesRequested', 'reviewRequired', 'none')),
    fetched_at TEXT NOT NULL,
    PRIMARY KEY(repository, number)
  );

  CREATE INDEX IF NOT EXISTS idx_pull_request_summaries_repository_updated
    ON pull_request_summaries(repository, updated_at DESC);
`;

export const migration003 = `
  ALTER TABLE pull_request_summaries
    ADD COLUMN status TEXT NOT NULL DEFAULT 'open'
    CHECK(status IN ('draft', 'open', 'inReview', 'approved', 'merged', 'closed'));

  DELETE FROM sync_state WHERE key LIKE 'pull-requests:%';
`;

export const migration004 = `
  CREATE TABLE IF NOT EXISTS user_preferences (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    repositories_json TEXT NOT NULL,
    pull_request_statuses_json TEXT NOT NULL,
    setup_complete INTEGER NOT NULL CHECK(setup_complete IN (0, 1)),
    updated_at TEXT NOT NULL
  );
`;

export const migration005 = `
  ALTER TABLE pull_request_summaries
    ADD COLUMN base_ref_name TEXT NOT NULL DEFAULT '';

  ALTER TABLE pull_request_summaries
    ADD COLUMN changed_files INTEGER NOT NULL DEFAULT 0
    CHECK(changed_files >= 0);

  DELETE FROM sync_state WHERE key LIKE 'pull-requests:%';
`;
