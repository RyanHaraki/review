import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface, type Interface as ReadlineInterface } from "node:readline";

import { z } from "zod";

const jsonRpcErrorSchema = z.object({
  code: z.number(),
  message: z.string(),
});

const jsonRpcResponseSchema = z.object({
  id: z.number(),
  result: z.json().optional(),
  error: jsonRpcErrorSchema.optional(),
});

const planTypeSchema = z.enum([
  "free",
  "go",
  "plus",
  "pro",
  "prolite",
  "team",
  "self_serve_business_prolite",
  "self_serve_business_usage_based",
  "business",
  "ent26",
  "enterprise_cbp_automation",
  "enterprise_cbp_usage_based",
  "enterprise",
  "edu",
  "edu_plus",
  "edu_pro",
  "unknown",
]);

const accountSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("apiKey") }),
  z.object({
    type: z.literal("chatgpt"),
    email: z.string().nullable(),
    planType: planTypeSchema,
  }),
  z.object({
    type: z.literal("amazonBedrock"),
    usesCodexManagedCredentials: z.boolean().optional(),
  }),
]);

const accountReadResultSchema = z.object({
  account: accountSchema.nullable().optional(),
  requiresOpenaiAuth: z.boolean(),
});

const loginStartResultSchema = z.object({
  type: z.literal("chatgpt"),
  loginId: z.string(),
  authUrl: z.url(),
});

type JsonValue = z.infer<ReturnType<typeof z.json>>;

type PendingRequest = {
  resolve(value: JsonValue): void;
  reject(error: Error): void;
  timeout: ReturnType<typeof setTimeout>;
};

export type CodexAccount = z.infer<typeof accountSchema>;

export type CodexAccountStatus = {
  account: CodexAccount | null;
  requiresOpenaiAuth: boolean;
};

export type CodexLoginStart = {
  loginId: string;
  authUrl: string;
};

export class CodexAppServerClient {
  private process: ChildProcessWithoutNullStreams | null = null;
  private startPromise: Promise<void> | null = null;
  private lines: ReadlineInterface | null = null;
  private nextRequestId = 1;
  private readonly pendingRequests = new Map<number, PendingRequest>();

  async start(): Promise<void> {
    if (this.process) {
      return;
    }

    if (this.startPromise) {
      await this.startPromise;
      return;
    }

    this.startPromise = this.startProcess();
    try {
      await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  private async startProcess(): Promise<void> {
    const process = spawn("codex", ["app-server", "--stdio"], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    await new Promise<void>((resolve, reject) => {
      process.once("spawn", resolve);
      process.once("error", reject);
    });

    this.process = process;
    this.lines = createInterface({ input: process.stdout });
    this.lines.on("line", (line) => this.handleLine(line));
    process.stderr.resume();
    process.once("exit", () => this.handleExit());

    await this.request("initialize", {
      clientInfo: {
        name: "review_desktop",
        title: "Review",
        version: "0.0.0",
      },
    });
    this.notify("initialized", {});
  }

  async readAccount(): Promise<CodexAccountStatus> {
    await this.start();
    const result = await this.request("account/read", { refreshToken: false });
    const parsed = accountReadResultSchema.parse(result);

    return {
      account: parsed.account ?? null,
      requiresOpenaiAuth: parsed.requiresOpenaiAuth,
    };
  }

  async startChatGptLogin(): Promise<CodexLoginStart> {
    await this.start();
    const result = await this.request("account/login/start", {
      type: "chatgpt",
      useHostedLoginSuccessPage: true,
      appBrand: "chatgpt",
    });
    const parsed = loginStartResultSchema.parse(result);

    return {
      loginId: parsed.loginId,
      authUrl: parsed.authUrl,
    };
  }

  stop(): void {
    this.lines?.close();
    this.lines = null;
    this.process?.kill();
    this.process = null;
    this.rejectPendingRequests(new Error("Codex app-server stopped."));
  }

  private request(method: string, params: JsonValue): Promise<JsonValue> {
    const process = this.process;
    if (!process) {
      return Promise.reject(new Error("Codex app-server is not running."));
    }

    const id = this.nextRequestId;
    this.nextRequestId += 1;

    return new Promise<JsonValue>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Codex app-server timed out while handling ${method}.`));
      }, 10_000);

      this.pendingRequests.set(id, { resolve, reject, timeout });
      process.stdin.write(`${JSON.stringify({ method, id, params })}\n`);
    });
  }

  private notify(method: string, params: JsonValue): void {
    this.process?.stdin.write(`${JSON.stringify({ method, params })}\n`);
  }

  private handleLine(line: string): void {
    const parsed = jsonRpcResponseSchema.safeParse(JSON.parse(line));
    if (!parsed.success) {
      return;
    }

    const pending = this.pendingRequests.get(parsed.data.id);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(parsed.data.id);

    if (parsed.data.error) {
      pending.reject(new Error(parsed.data.error.message));
      return;
    }

    if (parsed.data.result === undefined) {
      pending.reject(new Error("Codex app-server returned no result."));
      return;
    }

    pending.resolve(parsed.data.result);
  }

  private handleExit(): void {
    this.lines?.close();
    this.lines = null;
    this.process = null;
    this.rejectPendingRequests(new Error("Codex app-server exited."));
  }

  private rejectPendingRequests(error: Error): void {
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }
}
