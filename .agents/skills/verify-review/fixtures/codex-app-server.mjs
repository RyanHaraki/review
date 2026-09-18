#!/usr/bin/env node
import { appendFileSync } from "node:fs";
import { isAbsolute } from "node:path";
import { createInterface } from "node:readline";

const logPath = process.env.REVIEW_CODEX_FIXTURE_LOG;
if (!logPath || !isAbsolute(logPath)) throw new Error("Fixture requires an absolute REVIEW_CODEX_FIXTURE_LOG path.");
if (process.argv[2] === "--version") {
  process.stdout.write("codex-cli review-verification-fixture\n");
  process.exit(0);
}
if (process.argv[2] !== "app-server" || process.argv[3] !== "--stdio") throw new Error("Unknown Codex fixture command.");
const send = value => process.stdout.write(`${JSON.stringify(value)}\n`);
let nextThread = 1;
createInterface({ input: process.stdin }).on("line", line => {
  const request = JSON.parse(line);
  if (!request.id) return;
  let result = {};
  switch (request.method) {
    case "initialize":
    case "thread/unsubscribe":
    case "turn/interrupt":
      break;
    case "account/read":
      result = { account: { type: "chatgpt", email: "review-fixture@example.invalid", planType: "plus" }, requiresOpenaiAuth: true };
      break;
    case "model/list":
      result = { data: [{ model: "fixture-model", isDefault: true }] };
      break;
    case "thread/start":
      result = { thread: { id: `fixture-thread-${nextThread++}` } };
      break;
    case "turn/start": {
      const input = JSON.parse(request.params.input[0].text);
      const generatedFiles = input.files.filter(file => file.generated).map(file => file.path);
      const outline = {
        chapters: [{ title: "Greeting implementation", explanation: "The greeting trims whitespace before it creates its response. `greet` now stores the trimmed name in `safeName`, and the example imports the function. The image has no text patch.", filePaths: input.files.filter(file => !file.generated).map(file => file.path) }],
        generatedFiles,
      };
      appendFileSync(logPath, `${JSON.stringify({ method: "turn/start", threadId: request.params.threadId, fileCount: input.files.length })}\n`);
      result = { turn: { id: "fixture-turn" } };
      setTimeout(() => {
        send({ method: "item/completed", params: { threadId: request.params.threadId, item: { type: "agentMessage", phase: "final_answer", text: JSON.stringify(outline) } } });
        send({ method: "turn/completed", params: { threadId: request.params.threadId, turn: { status: "completed", error: null } } });
      }, 2000);
      break;
    }
    default:
      send({ id: request.id, error: { code: -32601, message: `Unsupported fixture method: ${request.method}` } });
      return;
  }
  send({ id: request.id, result });
});
