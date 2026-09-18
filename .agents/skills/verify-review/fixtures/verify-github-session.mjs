import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { decode } from "@toon-format/toon";
import { chromium } from "playwright-core";

const [runId, statePath, evidence] = process.argv.slice(2);
if (!runId || !statePath || !evidence) throw new Error("Usage: node verify-github-session.mjs <isolated-run-id> <fixture-state> <evidence-directory>");
const controlPath = ".agents/skills/verify-review/control-review.mjs";
const execute = promisify(execFile);
const control = async command => decode((await execute(process.execPath, [controlPath, "health", command, "--run-id", runId], { maxBuffer: 20_000_000 })).stdout);
const info = decode((await execute(process.execPath, [controlPath, "inspect", "info", "--run-id", runId])).stdout);
let run = info.data.run;
let browser;
let page;
const records = [];
const errors = [];
const state = async () => JSON.parse(await readFile(statePath, "utf8"));
assert.equal((await state()).repository, "review-fixture/demo");
assert.equal((await state()).mutations.length, 0, "Use a fresh authorization fixture run.");
async function configure(auth) {
  const next = await state();
  Object.assign(next.auth, auth);
  const temporary = `${statePath}.auth-check.tmp`;
  await writeFile(temporary, JSON.stringify(next, null, 2));
  await rename(temporary, statePath);
}
async function connect() {
  browser = await chromium.connectOverCDP(run.cdp.url);
  page = browser.contexts().flatMap(context => context.pages()).find(candidate => candidate.url().includes("/apps/desktop/out/renderer/index.html"));
  assert.ok(page);
  page.on("pageerror", error => errors.push(error.message));
}
const record = (step, result) => { records.push({ step, result }); console.log(step, JSON.stringify(result)); };
const preferences = async accountId => fetch(`${run.server.origin}/accounts/${accountId}/preferences`).then(response => response.json());
async function signIn(login) {
  await page.getByRole("button", { name: "Sign in with GitHub", exact: true }).click();
  await page.getByText(login, { exact: false }).waitFor();
}
async function selectRepository() {
  await page.getByRole("combobox", { name: "Repositories", exact: true }).click();
  await page.getByRole("option", { name: "review-fixture/demo", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Get started", exact: true }).click();
  await page.getByRole("heading", { name: "Review fixture", exact: true }).waitFor();
}
await mkdir(evidence, { recursive: true });
await connect();
try {
  await configure({ outcome: "access_denied" });
  await page.getByRole("button", { name: "Sign in with GitHub", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: /declined/i }).waitFor();
  await page.getByRole("button", { name: "Sign in with GitHub", exact: true }).waitFor();
  record("authorization denial returns to sign-in", true);

  await configure({ outcome: "authorization_pending" });
  await page.getByRole("button", { name: "Sign in with GitHub", exact: true }).click();
  await page.getByRole("button", { name: "Cancel sign-in", exact: true }).click();
  await page.getByRole("button", { name: "Sign in with GitHub", exact: true }).waitFor();
  await page.waitForTimeout(200);
  const beforeCancel = (await state()).requests.filter(request => request.path === "login/oauth/access_token").length;
  await page.waitForTimeout(1300);
  const afterCancel = (await state()).requests.filter(request => request.path === "login/oauth/access_token").length;
  assert.equal(afterCancel, beforeCancel, "Cancellation must stop device polling.");
  record("cancel stops authorization polling", true);

  await configure({ outcome: "approved" });
  await signIn("fixture-reviewer");
  await selectRepository();
  assert.equal((await preferences(42)).setupComplete, true);
  const devices = Object.keys((await state()).devices).length;
  const encryptedPath = join(run.app.profileDirectory, "github-session.enc");
  assert.equal((await readFile(encryptedPath)).includes(Buffer.from("fixture-token-42")), false, "Saved token must be encrypted.");
  await page.screenshot({ path: join(evidence, "signed-in.png") });
  await browser.close();
  const restarted = await control("restart");
  assert.equal(restarted.ok, true);
  assert.equal(restarted.data.run.app.profileDirectory, run.app.profileDirectory);
  assert.notEqual(restarted.data.run.app.pid, run.app.pid);
  run = restarted.data.run;
  await connect();
  await page.getByRole("heading", { name: "Review fixture", exact: true }).waitFor();
  assert.equal(Object.keys((await state()).devices).length, devices);
  record("encrypted session survives app process restart without new authorization", true);

  await page.getByRole("button", { name: /^Account menu for / }).click();
  await page.getByRole("menuitem", { name: "Log out", exact: true }).click();
  await page.getByRole("button", { name: "Sign in with GitHub", exact: true }).waitFor();
  await assert.rejects(readFile(encryptedPath), error => error.code === "ENOENT");
  record("sidebar Log out returns to sign-in and removes saved credentials", true);

  await configure({ accountId: 84, login: "fixture-alternate" });
  await signIn("fixture-alternate");
  assert.equal(await page.getByRole("button", { name: "Get started", exact: true }).isEnabled(), false);
  assert.deepEqual((await preferences(84)).repositories, []);
  assert.equal((await preferences(84)).setupComplete, false);
  assert.equal((await preferences(42)).setupComplete, true);
  await selectRepository();
  await page.getByRole("button", { name: /^Account menu for / }).click();
  await page.getByRole("menuitem", { name: "Account", exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await configure({ accountId: 42, login: "fixture-reviewer" });
  await signIn("fixture-reviewer");
  await page.getByRole("button", { name: "Get started", exact: true }).click();
  await page.getByRole("heading", { name: "Review fixture", exact: true }).waitFor();
  record("account switch keeps preferences separate and restores original account", true);

  await configure({ revoked: true });
  await page.getByRole("button", { name: /^Account menu for / }).click();
  await page.getByRole("menuitem", { name: "Account", exact: true }).click();
  await page.getByRole("button", { name: "Sign in with GitHub", exact: true }).waitFor();
  record("revoked token returns to sign-in", true);
  assert.equal((await state()).mutations.length, 0);
  assert.deepEqual(errors, []);
  await writeFile(join(evidence, "authorization-verification.json"), JSON.stringify({ ok: true, records, errors }, null, 2));
} catch (error) {
  await writeFile(join(evidence, "authorization-verification.json"), JSON.stringify({ ok: false, records, errors, error: String(error), snapshot: await page.locator("body").ariaSnapshot() }, null, 2));
  await page.screenshot({ path: join(evidence, "authorization-failure.png") });
  throw error;
} finally { await browser?.close(); }
