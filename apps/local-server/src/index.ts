import { homedir } from "node:os";
import { join } from "node:path";

import { z } from "zod";

import { openReviewDatabase } from "./database/client.js";
import { createReviewServer } from "./server.js";

const host = "127.0.0.1";
const port = Number.parseInt(process.env.REVIEW_SERVER_PORT ?? "4319", 10);
const dataDirectory = process.env.REVIEW_DATA_DIR ?? join(homedir(), ".review");

const reviewDatabase = openReviewDatabase(dataDirectory);
const server = createReviewServer(reviewDatabase);

server.listen(port, host, () => {
  const address = server.address();
  const addressResult = z.object({ port: z.number().int().nonnegative() }).safeParse(address);
  const assignedPort = addressResult.success ? addressResult.data.port : port;
  console.log(`Review local service listening on http://${host}:${assignedPort}`);
});

function shutdown() {
  server.close(() => {
    reviewDatabase.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
