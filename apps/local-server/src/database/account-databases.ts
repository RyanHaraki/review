import { join } from "node:path";
import { z } from "zod";
import { openReviewDatabase, type ReviewDatabase } from "./client.js";

const accountIdSchema = z.string().regex(/^[1-9][0-9]*$/).max(20);

export function openAccountDatabases(directory: string) {
  const databases = new Map<string, ReviewDatabase>();
  return {
    path: join(directory, "accounts", "github.com"),
    forAccount(input: string) {
      const accountId = accountIdSchema.parse(input);
      let database = databases.get(accountId);
      if (!database) {
        database = openReviewDatabase(join(directory, "accounts", "github.com", accountId));
        databases.set(accountId, database);
      }
      return database;
    },
    close() {
      for (const database of databases.values()) database.close();
      databases.clear();
    },
  };
}

export type AccountDatabases = ReturnType<typeof openAccountDatabases>;
