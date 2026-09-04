#!/usr/bin/env node

import { execFile, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

import { encode } from "@toon-format/toon";
import { chromium } from "playwright-core";

const require = createRequire(import.meta.url);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const skillRoot = join(repoRoot, ".agents", "skills", "verify-review");
const runRegistry = join(tmpdir(), "review-control", "runs");
const activeRunPath = join(
  tmpdir(),
  "review-control",
  `active-${createHash("sha256").update(repoRoot).digest("hex").slice(0, 16)}.toon`,
);
const errorCodes = new Set([
  "CLI_INVALID_ARGUMENT", "RUN_NOT_FOUND", "RUN_STALE", "AMBIGUOUS_RUN", "PROCESS_NOT_OWNED",
  "PORT_CONFLICT", "APP_NOT_READY", "CDP_UNAVAILABLE", "PAGE_NOT_FOUND", "TARGET_NOT_FOUND",
  "TARGET_AMBIGUOUS", "ACTION_TIMEOUT", "EVAL_NOT_ALLOWED", "EVAL_FAILED", "ARTIFACT_WRITE_FAILED",
  "FEATURE_NOT_AVAILABLE", "REACT_DOCTOR_FAILED", "REACT_DOCTOR_FINDINGS", "CLEANUP_REFUSED",
]);
const mutationCommands = new Set([
  "navigate.home", "navigate.scroll", "interact.click", "interact.click-xy", "interact.aria-click",
  "interact.type", "interact.press", "interact.eval", "health.cleanup", "health.watch",
]);
const knownCommands = new Set([
  "inspect.info", "inspect.snapshot", "inspect.screenshot", "inspect.components",
  "navigate.home", "navigate.scroll", "interact.click", "interact.click-xy", "interact.aria-click",
  "interact.type", "interact.press", "interact.eval", "performance.trace", "performance.profile",
  "performance.record", "performance.perf-metrics", "performance.wait-settle", "streaming.console",
  "streaming.network-log", "streaming.network-summary", "health.doctor", "health.cleanup", "health.watch",
]);

function result(value) {
  process.stdout.write(`${encode(value)}\n`);
}

function fail(command, code, message, next = []) {
  if (!errorCodes.has(code)) throw new Error(`Unknown CLI error code: ${code}`);
  result({ ok: false, command, error: { code, message, next } });
  process.exitCode = 1;
}

function usage() {
  process.stdout.write(`Review control CLI

Usage:
  node .agents/skills/verify-review/control-review.mjs <group> <command> [options]

Groups:
  inspect       info, snapshot, screenshot, components
  navigate     home, scroll
  interact     click, click-xy, aria-click, type, press, eval
  performance  trace, profile, record, perf-metrics, wait-settle
  streaming    console, network-log, network-summary
  health       doctor, cleanup, watch --restart

Common options:
  --run-id <id>       target one isolated run
  --new-run           create a new isolated run instead of reusing the active run
  --dry-run           describe a state-changing action without executing it
  --pretty            use wider TOON indentation for humans
  --help              show this help

Examples:
  control-review inspect snapshot
  control-review interact aria-click button Refresh
  control-review performance trace --duration 10s
  control-review health doctor
`);
}

function parseArgs(argv) {
  const positional = [];
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--help" || token === "-h") options.help = true;
    else if (token === "--dry-run") options.dryRun = true;
    else if (token === "--pretty") options.pretty = true;
    else if (token === "--allow-eval") options.allowEval = true;
    else if (token === "--restart") options.restart = true;
    else if (token === "--new-run") options.new_run = true;
    else if (token.startsWith("--")) {
      const key = token.slice(2);
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`Option --${key} needs a value.`);
      options[key.replaceAll("-", "_")] = value;
      index += 1;
    } else positional.push(token);
  }
  return { positional, options };
}

function commandName(positional) {
  const [group, command] = positional;
  if (!group || !command) return null;
  if (group === "health" && command === "watch") return "health.watch";
  return `${group}.${command}`;
}

function parseDuration(value, fallback = 10000) {
  if (!value) return fallback;
  const match = /^(\d+(?:\.\d+)?)(ms|s|m)?$/.exec(value);
  if (!match) throw new Error(`Invalid duration "${value}". Use values such as 500ms, 10s, or 2m.`);
  const amount = Number(match[1]);
  const unit = match[2] ?? "ms";
  return amount * ({ ms: 1, s: 1000, m: 60000 }[unit]);
}

function sleep(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

async function readToon(path) {
  const { decode } = await import("@toon-format/toon");
  return decode(await readFile(path, "utf8"), { strict: true });
}

async function writeToon(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${encode(value)}\n`, "utf8");
}

function processAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function executablePath() {
  try {
    return require(join(repoRoot, "apps", "desktop", "node_modules", "electron"));
  } catch {
    return null;
  }
}

function waitForLine(child, pattern, timeoutMilliseconds, label) {
  return new Promise((resolvePromise, reject) => {
    let settled = false;
    let output = "";
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.stdout?.off("data", onData);
      child.stderr?.off("data", onData);
      child.off("exit", onExit);
      callback(value);
    };
    const onData = (chunk) => {
      output += chunk.toString();
      const match = pattern.exec(output);
      if (match) finish(resolvePromise, match);
    };
    const onExit = (code) => finish(reject, new Error(`${label} exited with code ${code} before becoming ready. Output: ${output}`));
    const timer = setTimeout(() => finish(reject, new Error(`${label} did not become ready within ${timeoutMilliseconds}ms. Output: ${output}`)), timeoutMilliseconds);
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.on("exit", onExit);
  });
}

async function runCommand(file, args, cwd = repoRoot, env = {}) {
  const { stdout, stderr } = await new Promise((resolvePromise, reject) => {
    execFile(file, args, { cwd, env: { ...process.env, ...env }, maxBuffer: 20_000_000 }, (error, stdoutValue, stderrValue) => {
      if (error) reject(Object.assign(error, { stdout: stdoutValue, stderr: stderrValue }));
      else resolvePromise({ stdout: stdoutValue, stderr: stderrValue });
    });
  });
  return { stdout, stderr };
}

async function createRun(requestedRunId = null) {
  await runCommand("pnpm", ["build"]);
  const runId = requestedRunId ?? `review-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
  const runDirectory = join(runRegistry, runId);
  const dataDirectory = join(runDirectory, "data");
  const profileDirectory = join(runDirectory, "electron");
  const artifactsDirectory = join(skillRoot, "evidence", runId);
  await mkdir(dataDirectory, { recursive: true });
  await mkdir(profileDirectory, { recursive: true });
  await mkdir(artifactsDirectory, { recursive: true });

  const server = spawn(process.execPath, [join(repoRoot, "apps/local-server/dist/index.js")], {
    cwd: repoRoot,
    env: { ...process.env, REVIEW_SERVER_PORT: "0", REVIEW_DATA_DIR: dataDirectory },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  const serverReady = await waitForLine(server, /http:\/\/127\.0\.0\.1:(\d+)/, 15000, "Review local server");
  const serverOrigin = `http://127.0.0.1:${serverReady[1]}`;
  server.stdout?.destroy();
  server.stderr?.destroy();
  server.unref();

  const electron = executablePath();
  if (!electron) {
    server.kill("SIGTERM");
    throw new Error("Electron is not installed. Run pnpm install before using the verification CLI.");
  }
  const app = spawn(electron, [".", `--user-data-dir=${profileDirectory}`, "--remote-debugging-port=0"], {
    cwd: join(repoRoot, "apps/desktop"),
    env: { ...process.env, REVIEW_SERVER_ORIGIN: serverOrigin },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  let cdpReady;
  try {
    cdpReady = await waitForLine(app, /DevTools listening on (ws:\/\/127\.0\.0\.1:(\d+).+)/, 20000, "Review Electron app");
  } catch (error) {
    server.kill("SIGTERM");
    throw error;
  }
  const cdpUrl = cdpReady[1];
  const cdpPort = Number(cdpReady[2]);
  app.stdout?.destroy();
  app.stderr?.destroy();
  app.unref();
  const manifest = {
    runId,
    status: "active",
    workspace: repoRoot,
    runDirectory,
    artifactsDirectory,
    app: { pid: app.pid, profileDirectory },
    server: { pid: server.pid, origin: serverOrigin, dataDirectory },
    cdp: { pid: app.pid, port: cdpPort, url: cdpUrl },
    createdAt: new Date().toISOString(),
  };
  const manifestPath = join(runDirectory, "manifest.toon");
  manifest.manifestPath = manifestPath;
  await writeToon(manifestPath, manifest);
  await writeToon(activeRunPath, { runId, manifestPath });
  return manifest;
}

async function loadRun(runId) {
  let manifestPath;
  if (runId) manifestPath = join(tmpdir(), "review-control", "runs", runId, "manifest.toon");
  else {
    try {
      manifestPath = (await readToon(activeRunPath)).manifestPath;
    } catch {
      manifestPath = null;
    }
  }
  if (!manifestPath) return null;
  try {
    const manifest = await readToon(manifestPath);
    if (!processAlive(manifest.app?.pid) || !processAlive(manifest.server?.pid)) return { ...manifest, status: "stale" };
    return manifest;
  } catch {
    return null;
  }
}

async function ensureRun(options) {
  const existing = await loadRun(options.run_id);
  if (existing?.status === "stale") {
    throw Object.assign(new Error(`Run ${existing.runId} is stale. Its recorded process is no longer running.`), { code: "RUN_STALE" });
  }
  if (existing && !options.new_run) return existing;
  return createRun(options.new_run ? null : options.run_id);
}

async function connectPage(run) {
  let browser;
  try {
    browser = await chromium.connectOverCDP(run.cdp.url);
  } catch (error) {
    throw Object.assign(new Error(`Could not connect to CDP at ${run.cdp.url}: ${error.message}`), { code: "CDP_UNAVAILABLE" });
  }
  const pages = browser.contexts().flatMap((context) => context.pages());
  const page = pages.find((candidate) => candidate.url().includes("apps/desktop/out/renderer/index.html")) ?? pages[0];
  if (!page) {
    await browser.close();
    throw Object.assign(new Error("CDP connected, but no Review renderer page exists."), { code: "PAGE_NOT_FOUND" });
  }
  await page.waitForFunction(() => document.body.textContent?.includes("Pull requests") || document.body.textContent?.includes("Get started with Review"), null, { timeout: 15000 });
  return { browser, page };
}

async function pageSnapshot(page) {
  const components = await visibleComponents(page);
  return {
    url: page.url(),
    title: await page.title(),
    aria: await page.locator("body").ariaSnapshot({ timeout: 5000 }),
    components,
  };
}

async function visibleComponents(page) {
  return page.locator("body *:is(button,a,input,textarea,select,h1,h2,h3,[role])").evaluateAll((elements) => elements
    .filter((element) => {
      const box = element.getBoundingClientRect();
      return box.width > 0 && box.height > 0;
    })
    .map((element, index) => {
      const box = element.getBoundingClientRect();
      const ref = `e${index + 1}`;
      element.setAttribute("data-control-ref", ref);
      return {
        ref,
        tag: element.tagName.toLowerCase(),
        role: element.getAttribute("role") ?? element.tagName.toLowerCase(),
        name: element.getAttribute("aria-label") ?? element.textContent?.trim().replace(/\s+/g, " ").slice(0, 160) ?? "",
        bounds: { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) },
      };
    }));
}

function locatorFor(page, target) {
  if (!target) throw Object.assign(new Error("A target is required."), { code: "CLI_INVALID_ARGUMENT" });
  if (target.startsWith("@")) return page.locator(`[data-control-ref="${target.slice(1)}"]`);
  if (/^[.#\[]/.test(target)) return page.locator(target);
  return page.getByText(target, { exact: true });
}

async function firstTarget(locator, description) {
  const count = await locator.count();
  if (count === 0) throw Object.assign(new Error(`No ${description} matched.`), { code: "TARGET_NOT_FOUND" });
  if (count > 1) throw Object.assign(new Error(`${count} elements matched ${description}. Use a more specific target.`), { code: "TARGET_AMBIGUOUS" });
  return locator;
}

async function cdpSession(page) {
  return page.context().newCDPSession(page);
}

async function captureEvents(page, type, duration) {
  const session = await cdpSession(page);
  const events = [];
  const eventNames = type === "console"
    ? ["Runtime.consoleAPICalled", "Log.entryAdded"]
    : ["Network.requestWillBeSent", "Network.responseReceived", "Network.loadingFailed"];
  for (const name of eventNames) session.on(name, (event) => events.push({ event: name, timestamp: Date.now(), ...event }));
  if (type === "console") await session.send("Runtime.enable");
  else await session.send("Network.enable");
  await sleep(duration);
  await session.detach();
  return events;
}

async function runReactDoctor() {
  try {
    const response = await runCommand("pnpm", ["dlx", "react-doctor@latest", "--json", "--scope", "changed", "--project", "@review/renderer"]);
    return { ok: true, report: JSON.parse(response.stdout) };
  } catch (error) {
    const report = (() => { try { return JSON.parse(error.stdout); } catch { return null; } })();
    return { ok: false, report, message: error.stderr || error.message };
  }
}

async function cleanupRun(run) {
  if (!run) return { ok: true, cleaned: false };
  for (const processInfo of [run.app, run.server]) {
    if (!processAlive(processInfo?.pid)) continue;
    try { process.kill(processInfo.pid, "SIGTERM"); } catch { /* process exited between checks */ }
  }
  await sleep(500);
  for (const processInfo of [run.app, run.server]) {
    if (processAlive(processInfo?.pid)) {
      try { process.kill(processInfo.pid, "SIGKILL"); } catch { /* process exited between checks */ }
    }
  }
  await writeToon(run.manifestPath, { ...run, status: "cleaned", cleanedAt: new Date().toISOString() });
  await rm(run.runDirectory, { recursive: true, force: true });
  try {
    const active = await readToon(activeRunPath);
    if (active.runId === run.runId) await rm(activeRunPath, { force: true });
  } catch {
    // The active-run pointer may already be absent.
  }
  return { ok: true, cleaned: true, runId: run.runId, artifactsDirectory: run.artifactsDirectory };
}

async function execute(command, positional, options, run) {
  const { browser, page } = run ? await connectPage(run) : { browser: null, page: null };
  try {
    if (command === "inspect.info") return { run, page: { url: page.url(), title: await page.title() } };
    if (command === "inspect.snapshot") return await pageSnapshot(page);
    if (command === "inspect.components") return { components: await visibleComponents(page) };
    if (command === "inspect.screenshot") {
      const path = options.output ?? positional[2] ?? join(run.artifactsDirectory, `screenshot-${Date.now()}.png`);
      await page.screenshot({ path, fullPage: true });
      return { artifacts: [{ type: "screenshot", path }] };
    }
    if (command === "navigate.home") { await page.goto(`${page.url().split("#")[0]}#/`); return await pageSnapshot(page); }
    if (command === "navigate.scroll") {
      const direction = positional[2];
      const amount = Number(options.amount ?? positional[3] ?? 640);
      if (!["up", "down", "left", "right"].includes(direction)) throw new Error("Scroll direction must be up, down, left, or right.");
      await page.mouse.wheel(direction === "left" ? -amount : direction === "right" ? amount : 0, direction === "up" ? -amount : direction === "down" ? amount : 0);
      return { direction, amount, scroll: await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY })) };
    }
    if (command === "interact.click") { await (await firstTarget(locatorFor(page, positional[2]), `target "${positional[2]}"`)).click(); return { target: positional[2], clicked: true }; }
    if (command === "interact.click-xy") { await page.mouse.click(Number(positional[2]), Number(positional[3])); return { x: Number(positional[2]), y: Number(positional[3]), clicked: true }; }
    if (command === "interact.aria-click") { await page.getByRole(positional[2], { name: positional.slice(3).join(" "), exact: true }).click(); return { role: positional[2], name: positional.slice(3).join(" "), clicked: true }; }
    if (command === "interact.type") { await (await firstTarget(locatorFor(page, positional[2]), `target "${positional[2]}"`)).fill(positional.slice(3).join(" ")); return { target: positional[2], typed: true }; }
    if (command === "interact.press") { await page.keyboard.press(positional[2]); return { key: positional[2], pressed: true }; }
    if (command === "interact.eval") {
      if (!options.allowEval) throw Object.assign(new Error("Renderer evaluation is disabled by default."), { code: "EVAL_NOT_ALLOWED" });
      return { value: await page.evaluate((expression) => Function(`return (${expression})`)(), positional.slice(2).join(" ")) };
    }
    if (command === "performance.wait-settle") {
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(Number(options.window ?? 250));
      return { settled: true, url: page.url() };
    }
    if (command === "performance.perf-metrics") {
      const session = await cdpSession(page);
      await session.send("Performance.enable");
      const metrics = await session.send("Performance.getMetrics");
      await session.detach();
      return { metrics: metrics.metrics };
    }
    if (command === "streaming.console" || command === "streaming.network-log") {
      const type = command.endsWith("console") ? "console" : "network";
      const events = await captureEvents(page, type, parseDuration(options.duration, 5000));
      const path = options.output ?? join(run.artifactsDirectory, `${type}-${Date.now()}.toon`);
      await writeToon(path, { type, events });
      return { events, artifacts: [{ type: "toon", path }] };
    }
    if (command === "streaming.network-summary") {
      const events = await captureEvents(page, "network", parseDuration(options.duration, 5000));
      const responses = events.filter((event) => event.event === "Network.responseReceived");
      return { requests: responses.length, statusCodes: responses.reduce((counts, event) => { const code = String(event.response.status); counts[code] = (counts[code] ?? 0) + 1; return counts; }, {}) };
    }
    if (command === "performance.profile") {
      const session = await cdpSession(page);
      await session.send("Profiler.enable");
      await session.send("Profiler.start");
      await sleep(parseDuration(options.duration, 5000));
      const profile = await session.send("Profiler.stop");
      await session.detach();
      const path = options.output ?? join(run.artifactsDirectory, `profile-${Date.now()}.toon`);
      await writeToon(path, profile.profile);
      return { artifacts: [{ type: "cpu-profile", path }] };
    }
    if (command === "performance.trace") {
      const session = await cdpSession(page);
      const chunks = [];
      session.on("Tracing.dataCollected", (event) => chunks.push(...event.value));
      const tracingComplete = new Promise((resolvePromise) => session.once("Tracing.tracingComplete", resolvePromise));
      await session.send("Tracing.start", { categories: "devtools.timeline,v8.execute,disabled-by-default-devtools.timeline" });
      await sleep(parseDuration(options.duration, 5000));
      await session.send("Tracing.end");
      await Promise.race([tracingComplete, sleep(5000)]);
      await session.detach();
      const path = options.output ?? join(run.artifactsDirectory, `trace-${Date.now()}.toon`);
      await writeToon(path, { traceEvents: chunks });
      return { artifacts: [{ type: "trace", path }], eventCount: chunks.length };
    }
    if (command === "performance.record") {
      const events = [];
      await page.exposeFunction("__reviewRecord", (event) => events.push(event));
      await page.evaluate(() => {
        const send = (event) => window.__reviewRecord({ type: event.type, target: event.target instanceof Element ? { tag: event.target.tagName.toLowerCase(), role: event.target.getAttribute("role"), label: event.target.getAttribute("aria-label"), text: event.target.textContent?.trim().slice(0, 120) } : null, at: new Date().toISOString() });
        for (const type of ["click", "input", "keydown"]) document.addEventListener(type, send, true);
      });
      await sleep(parseDuration(options.duration, 5000));
      const path = options.output ?? join(run.artifactsDirectory, `recording-${Date.now()}.toon`);
      await writeToon(path, { recording: { runId: run.runId, actions: events } });
      return { artifacts: [{ type: "interaction-recording", path }], actionCount: events.length };
    }
    throw Object.assign(new Error(`Command ${command} is not implemented.`), { code: "CLI_INVALID_ARGUMENT" });
  } finally {
    await browser?.close();
  }
}

async function main() {
  const { positional, options } = parseArgs(process.argv.slice(2));
  if (options.help || positional.length === 0) return usage();
  const command = commandName(positional);
  if (!command) return fail("unknown", "CLI_INVALID_ARGUMENT", "Use a command group and command.", ["Run --help to list commands."]);
  if (!knownCommands.has(command)) return fail(command, "CLI_INVALID_ARGUMENT", `Command ${command} is not available in the Review control CLI.`, ["Run --help to list supported commands."]);
  if (options.dryRun && mutationCommands.has(command)) {
    return result({ ok: true, dryRun: true, command, plannedAction: { arguments: positional.slice(2), options } });
  }
  let run;
  try {
    if (command === "health.cleanup") {
      run = await loadRun(options.run_id);
      return result(await cleanupRun(run));
    }
    if (command === "health.doctor") {
      run = await ensureRun(options);
      const checks = [];
      const health = await fetch(run.server.origin.replace(/\/$/, "") + "/health");
      checks.push({ name: "app", ok: health.ok, code: health.ok ? "OK" : "APP_NOT_READY" });
      try { await chromium.connectOverCDP(run.cdp.url).then((browser) => browser.close()); checks.push({ name: "cdp", ok: true, code: "OK" }); }
      catch { checks.push({ name: "cdp", ok: false, code: "CDP_UNAVAILABLE" }); }
      const react = await runReactDoctor();
      checks.push({ name: "react", ok: react.ok && (react.report?.reactDetected ?? true), code: react.ok ? "OK" : "REACT_DOCTOR_FINDINGS" });
      return result({ ok: checks.every((check) => check.ok), command, runId: run.runId, checks, react: react.report, next: checks.some((check) => !check.ok) ? ["Inspect the failed check data before completing the task."] : [] });
    }
    run = await ensureRun(options);
    if (command === "health.watch") {
      const duration = parseDuration(options.duration, 30000);
      const startedAt = Date.now();
      const restarts = [];
      while (Date.now() - startedAt < duration) {
        if (!processAlive(run.app.pid) || !processAlive(run.server.pid)) {
          if (!options.restart) throw Object.assign(new Error("An owned Review process stopped and --restart was not supplied."), { code: "RUN_STALE" });
          restarts.push({ at: new Date().toISOString(), reason: "owned process exited" });
          await cleanupRun(run);
          run = await createRun();
        }
        await sleep(500);
      }
      return result({ ok: true, command, runId: run.runId, restarts });
    }
    const data = await execute(command, positional, options, run);
    return result({ ok: true, command, runId: run.runId, data });
  } catch (error) {
    const code = errorCodes.has(error.code) ? error.code : "CLI_INVALID_ARGUMENT";
    return fail(command, code, error.message, [
      command.startsWith("inspect") ? "Run inspect.info to check the active run." : "Run inspect.snapshot to inspect the current Review UI.",
      "Use --help to check the command arguments.",
    ]);
  }
}

await main();
