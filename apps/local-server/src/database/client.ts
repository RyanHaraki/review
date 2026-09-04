import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  migration001,
  migration002,
  migration003,
  migration004,
  migration005,
} from "./schema.js";

export type ReviewDatabase = {
  database: DatabaseSync;
  path: string;
  close(): void;
};

export function openReviewDatabase(dataDirectory: string): ReviewDatabase {
  mkdirSync(dataDirectory, { recursive: true });
  const path = join(dataDirectory, "review.sqlite");
  const database = new DatabaseSync(path);

  database.exec("PRAGMA busy_timeout = 5000;");
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec("PRAGMA journal_mode = WAL;");

  database.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);",
  );

  const migration = database.prepare("SELECT version FROM schema_migrations WHERE version = ?");
  const migrations = [migration001, migration002, migration003, migration004, migration005];

  for (const [index, sql] of migrations.entries()) {
    const version = index + 1;
    if (migration.get(version) !== undefined) {
      continue;
    }
    database.exec("BEGIN IMMEDIATE;");
    try {
      database.exec(sql);
      database
        .prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)")
        .run(version, new Date().toISOString());
      database.exec("COMMIT;");
    } catch (error) {
      database.exec("ROLLBACK;");
      throw error;
    }
  }

  return {
    database,
    path,
    close: () => database.close(),
  };
}
