import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright-core";

const [cdp, server, statePath, evidence] = process.argv.slice(2);
if (!cdp || !server || !statePath || !evidence) throw new Error("Usage: node verify-pull-request-pages.mjs <cdp-url> <server-url> <fixture-state-path> <evidence-directory>");
const remote = async () => JSON.parse(await readFile(statePath, "utf8"));
assert.equal((await remote()).repository, "review-fixture/demo", "This check requires the isolated GitHub fixture.");
assert.equal((await remote()).mutations.length, 0, "Use fresh fixture state.");
await mkdir(evidence, { recursive: true });
const browser = await chromium.connectOverCDP(cdp);
const page = browser.contexts().flatMap(context => context.pages()).find(page => page.url().includes("/apps/desktop/out/renderer/index.html"));
assert.ok(page, "Review renderer is missing.");
const errors = [];
page.on("pageerror", error => errors.push(error.message));
page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
const key = { repository: "review-fixture/demo", number: 42 };
const records = [];
const record = (step, result) => { records.push({ step, result }); console.log(step, JSON.stringify(result)); };
const drafts = async () => {
  const response = await fetch(`${server}/pull-requests/details/drafts/read`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(key) });
  assert.equal(response.status, 200); return response.json();
};
async function waitFor(check, label) {
  const start = Date.now();
  while (Date.now() - start < 15000) { if (await check()) return; await new Promise(resolve => setTimeout(resolve, 100)); }
  throw new Error(`Timed out: ${label}`);
}
async function saved(kind, body) {
  await waitFor(async () => (await drafts()).some(draft => draft.target.kind === kind && draft.body === body && draft.status === "draft"), `${kind} draft saved`);
}
async function published(kind, count) {
  await waitFor(async () => (await remote()).mutations.length === count, `${kind} published`);
  await waitFor(async () => (await drafts()).some(draft => draft.target.kind === kind && draft.status === "submitted"), `${kind} receipt`);
  record(`${kind} submitted`, { mutationCount: count, receipt: true });
}
try {
  if (page.url().includes("setup")) {
    await page.getByRole("combobox", { name: "Repositories", exact: true }).click();
    await page.getByRole("option", { name: key.repository, exact: true }).click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Get started", exact: true }).click();
  }
  await page.getByRole("heading", { name: "Review fixture", exact: true }).waitFor();
  assert.equal(await page.locator("body").evaluate(element => getComputedStyle(element).backgroundColor), "rgb(249, 250, 250)");
  const description = "## Updated review description\n\n| Feature | State |\n| --- | --- |\n| SQLite | Saved |\n\n- [x] Markdown preview";
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("textbox", { name: "Write a PR description in Markdown." }).fill(description);
  await saved("description", description);
  assert.equal((await remote()).mutations.length, 0);
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await page.getByRole("table").waitFor();
  await page.screenshot({ path: join(evidence, "description-preview.png") });
  await page.getByRole("button", { name: "Submit to GitHub", exact: true }).click();
  await published("description", 1);
  await page.getByRole("button", { name: "Edit", exact: true }).waitFor();
  assert.equal((await remote()).body, description);

  const discussion = "Fixture discussion comment with **Markdown**.";
  await page.getByRole("button", { name: "Add comment", exact: true }).click();
  await page.getByRole("textbox").fill(discussion);
  await saved("discussion", discussion);
  assert.equal((await remote()).mutations.length, 1);
  await page.getByRole("button", { name: "Submit to GitHub", exact: true }).click();
  await published("discussion", 2);
  await page.getByText("Fixture discussion comment with", { exact: false }).waitFor();
  await page.screenshot({ path: join(evidence, "overview-activity.png") });

  await page.getByRole("tab", { name: "Diffs", exact: true }).click();
  await page.waitForFunction(() => Array.from(document.querySelectorAll("diffs-container")).some(host => host.shadowRoot?.textContent?.includes("safeName")));
  assert.equal(await page.locator(".diff-scroll").evaluate(element => element.scrollTop), 0);
  assert.equal(await page.getByRole("combobox", { name: "Changed file" }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "Unified", exact: true }).count(), 0);
  assert.equal(await page.getByRole("complementary", { name: "Review comments" }).count(), 0);
  await page.getByRole("button", { name: "View comments", exact: true }).hover();
  await page.getByText("View comments", { exact: true }).waitFor();
  await page.getByRole("button", { name: "View comments", exact: true }).click();
  await page.getByRole("complementary", { name: "Review comments" }).waitFor();
  await page.getByRole("button", { name: "Close comments", exact: true }).click();
  await page.getByRole("checkbox", { name: "Reviewed src/greeting.ts", exact: true }).click();
  await page.getByText("1 / 4 files reviewed", { exact: true }).waitFor();
  const reviewResponse = await fetch(`${server}/pull-requests/details/reviewed/read`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key, baseSha: "a".repeat(40), headSha: "b".repeat(40) }) });
  assert.deepEqual(await reviewResponse.json(), ["src/greeting.ts"]);
  assert.equal(await page.locator('diffs-container [data-diff-type="split"]').count(), 0);
  await page.getByRole("button", { name: "Open src/greeting.ts", exact: true }).waitFor();
  await page.getByRole("button", { name: "Open src/greeting.ts", exact: true }).click();
  await page.getByRole("button", { name: "Close src/greeting.ts", exact: true }).waitFor();
  await page.getByRole("button", { name: "Close src/greeting.ts", exact: true }).click();
  await page.getByRole("button", { name: "Open src/greeting.ts", exact: true }).waitFor();
  await page.getByRole("button", { name: "Open src/greeting.ts", exact: true }).click();
  const start = page.locator('diffs-container [data-column-number="2"][data-line-type="change-addition"]').first();
  const end = page.locator('diffs-container [data-column-number="3"][data-line-type="change-addition"]').first();
  await start.scrollIntoViewIfNeeded();
  const a = await start.boundingBox(), b = await end.boundingBox();
  assert.ok(a && b);
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 5 }); await page.mouse.up();
  await page.getByRole("button", { name: "Add comment", exact: true }).click();
  const lineBody = "**Inline review** for the selected range.";
  await page.getByRole("textbox").fill(lineBody);
  await saved("line", lineBody);
  const lineDraft = (await drafts()).find(draft => draft.target.kind === "line");
  assert.deepEqual(lineDraft.target.anchor, { path: "src/greeting.ts", baseSha: "a".repeat(40), headSha: "b".repeat(40), side: "RIGHT", startLine: 2, line: 3 });
  assert.equal((await remote()).mutations.length, 2);
  await page.reload();
  await page.getByRole("tab", { name: "Diffs", exact: true }).click();
  await page.getByRole("checkbox", { name: "Reviewed src/greeting.ts", exact: true }).waitFor();
  await page.getByText("1 / 4 files reviewed", { exact: true }).waitFor();
  assert.equal(await page.getByRole("checkbox", { name: "Reviewed src/greeting.ts", exact: true }).isChecked(), true);
  await page.getByRole("button", { name: "View comments", exact: true }).click();
  await page.getByRole("textbox").waitFor();
  assert.equal(await page.getByRole("textbox").inputValue(), lineBody);
  await page.getByRole("button", { name: "Open src/greeting.ts", exact: true }).waitFor();
  await page.getByRole("button", { name: "Open src/greeting.ts", exact: true }).click();
  record("reviewed file starts closed after reload and can reopen", true);
  record("line draft survived renderer restart", lineDraft.target.anchor);
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await page.screenshot({ path: join(evidence, "line-comment-draft.png") });
  await page.getByRole("button", { name: "Submit to GitHub", exact: true }).click();
  await published("line", 3);
  await page.getByText("Inline review", { exact: true }).waitFor();
  const thread = page.getByRole("article").filter({ hasText: "Can we keep the greeting easy to test?" });
  await thread.getByRole("button", { name: "Reply", exact: true }).click();
  const reply = "Yes. This reply is saved before submission.";
  await thread.getByRole("textbox").fill(reply);
  await saved("reply", reply);
  assert.equal((await remote()).mutations.length, 3);
  await thread.getByRole("button", { name: "Submit to GitHub", exact: true }).click();
  await published("reply", 4);
  await thread.getByText(reply, { exact: true }).waitFor();
  await thread.getByRole("button", { name: "Resolve thread", exact: true }).click();
  await thread.getByRole("button", { name: "Reopen thread", exact: true }).waitFor();
  assert.equal((await remote()).threads.find(item => item.id === "THREAD_100").isResolved, true);
  await thread.getByRole("button", { name: "Reopen thread", exact: true }).click();
  await thread.getByRole("button", { name: "Resolve thread", exact: true }).waitFor();
  assert.equal((await remote()).threads.find(item => item.id === "THREAD_100").isResolved, false);
  record("thread replies and resolution", { mutations: (await remote()).mutations.map(item => item.kind) });
  await page.screenshot({ path: join(evidence, "threads.png") });

  await page.getByRole("button", { name: "Close comments", exact: true }).click();
  await page.locator(".diff-scroll").hover();
  await page.mouse.wheel(0, 600);
  await page.getByRole("checkbox", { name: "Reviewed src/example.ts", exact: true }).waitFor();
  await page.getByRole("checkbox", { name: "Reviewed src/example.ts", exact: true }).click();
  await page.getByText("2 / 4 files reviewed", { exact: true }).waitFor();
  await page.mouse.wheel(0, 100);
  await page.getByRole("checkbox", { name: "Reviewed assets/icon.png", exact: true }).waitFor();
  await page.getByText("No text changes.", { exact: false }).waitFor();
  await page.getByRole("checkbox", { name: "Reviewed assets/icon.png", exact: true }).click();
  await page.getByText("3 / 4 files reviewed", { exact: true }).waitFor();
  await page.mouse.wheel(0, 100);
  await page.getByRole("checkbox", { name: "Reviewed src/large.ts", exact: true }).waitFor();
  const renderedLines = await page.locator("diffs-container [data-line]").count();
  assert.ok(renderedLines > 0 && renderedLines < 500, `Virtualization rendered ${renderedLines} of 4000 lines`);
  await page.mouse.wheel(0, 4000);
  await waitFor(async () => await page.locator(".diff-scroll").evaluate(element => element.scrollTop) > 2000, "large diff scroll");
  record("all files in unified view; reviewed marks saved; sidebar hidden by default", { reviewedFiles: 3 });
  record("large diff virtualization", { fileLines: 4000, renderedLines, workers: page.workers().length });
  assert.equal((await remote()).mutations.length, 6, "Reads and reloads must not publish again.");
  await page.screenshot({ path: join(evidence, "large-diff.png") });
  assert.deepEqual(errors, []);
  await writeFile(join(evidence, "verification.json"), JSON.stringify({ ok: true, records, errors }, null, 2));
} catch (error) {
  await writeFile(join(evidence, "verification.json"), JSON.stringify({ ok: false, records, errors, error: String(error), snapshot: await page.locator("body").ariaSnapshot() }, null, 2));
  await page.screenshot({ path: join(evidence, "failure.png") });
  throw error;
} finally { await browser.close(); }
