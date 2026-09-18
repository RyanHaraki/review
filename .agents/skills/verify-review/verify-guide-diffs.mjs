import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const [cdp, viteOrigin] = process.argv.slice(2);
if (!cdp || !viteOrigin) throw new Error("Usage: node verify-guide-diffs.mjs <isolated-electron-cdp-url> <vite-origin>");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const fixture = await mkdtemp(join(root, "apps/renderer/guide-diff-check-"));
const browser = await chromium.connectOverCDP(cdp);
const page = browser.contexts()[0].pages()[0];
assert.ok(page, "The isolated Electron window is missing.");
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

try {
  await writeFile(join(fixture, "index.html"), '<!doctype html><html><body><div id="root"></div><script type="module" src="./check.tsx"></script></body></html>');
  await writeFile(join(fixture, "check.tsx"), `
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { GuideFile } from "../src/components/pull-requests/guide/guide-file";
import "../src/index.css";
const files = ["example.ts", "example.tsx", "example.md", "pnpm-lock.yaml"].map((path) => ({
  path, previousPath: null, status: "added", additions: 1, deletions: 0,
  patch: "@@ -0,0 +1 @@\\n+initial_code",
}));
function Check() {
  const [shown, setShown] = useState(true);
  const [updated, setUpdated] = useState(false);
  return <main className="space-y-4 p-8">
    <button onClick={() => setShown(value => !value)}>Toggle guide</button>
    <button onClick={() => setUpdated(true)}>Update patch</button>
    {shown && files.map(file => <GuideFile key={file.path}
      file={updated ? { ...file, patch: "@@ -0,0 +1 @@\\n+updated_code" } : file}
      generated={file.path === "pnpm-lock.yaml"} />)}
  </main>;
}
createRoot(document.getElementById("root")).render(<StrictMode><Check /></StrictMode>);
`);
  await page.goto(`${viteOrigin}/${basename(fixture)}/index.html`);
  const waitForCode = async (count, text) => {
    await page.waitForFunction(({ count, text }) => {
      const hosts = Array.from(document.querySelectorAll("diffs-container"));
      return hosts.length === count && hosts.every((host) =>
        host.getBoundingClientRect().height > 0 &&
        Array.from(host.shadowRoot?.querySelectorAll("[data-line]") ?? []).some((line) => line.textContent.includes(text)),
      );
    }, { count, text }, { timeout: 15000 });
  };
  await waitForCode(3, "initial_code");
  assert.equal(await page.locator('button[aria-expanded="true"]').count(), 3);
  assert.equal(await page.getByRole("button", { name: /pnpm-lock.yaml/ }).getAttribute("aria-expanded"), "false");
  await page.getByRole("button", { name: "Show diff", exact: true }).click();
  await waitForCode(4, "initial_code");
  await page.getByRole("button", { name: "Update patch", exact: true }).click();
  await waitForCode(4, "updated_code");
  await page.getByRole("button", { name: "Toggle guide", exact: true }).click();
  assert.equal(await page.locator("diffs-container").count(), 0);
  await page.getByRole("button", { name: "Toggle guide", exact: true }).click();
  await waitForCode(3, "updated_code");
  assert.deepEqual(errors, []);
  console.log("Guide diffs passed: cold StrictMode mount, generated-file expansion, patch updates, cleanup, and remount.");
} finally {
  await page.goto("about:blank");
  await browser.close();
  await rm(fixture, { recursive: true, force: true });
}
