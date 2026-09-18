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

type PendingGeneration = {
  text: string;
  resolve(text: string): void;
  reject(error: Error): void;
  timeout: ReturnType<typeof setTimeout>;
};

const notificationSchema = z.object({
  method: z.string(),
  params: z.object({ threadId: z.string() }).passthrough(),
});
const completedItemSchema = z.object({
  item: z.object({ type: z.literal("agentMessage"), text: z.string(), phase: z.string().nullish() }),
});
const completedTurnSchema = z.object({
  turn: z.object({
    status: z.enum(["completed", "failed", "interrupted"]),
    error: z.object({ message: z.string() }).nullish(),
  }),
});

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
  private readonly pendingGenerations = new Map<string, PendingGeneration>();

  async start(): Promise<void> {
    if (this.startPromise) {
      await this.startPromise;
      return;
    }

    if (this.process) {
      return;
    }

    this.startPromise = this.startProcess();
    try {
      await this.startPromise;
    } catch (error) {
      this.stop();
      throw error;
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
    process.once("exit", () => {
      if (this.process === process) this.handleExit();
    });

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

  async generateStructuredText(input: {
    cwd: string;
    instructions: string;
    prompt: string;
    outputSchema: JsonValue;
  }): Promise<string> {
    await this.start();
    const models = z.object({
      data: z.array(z.object({ model: z.string(), isDefault: z.boolean() })),
    }).parse(await this.request("model/list", { includeHidden: false }));
    const model = models.data.find((candidate) => candidate.isDefault) ?? models.data[0];
    if (!model) throw new Error("Codex has no available model for guide generation.");
    const result = await this.request("thread/start", {
      model: model.model,
      cwd: input.cwd,
      ephemeral: true,
      approvalPolicy: "never",
      sandbox: "read-only",
      baseInstructions: input.instructions,
      config: {
        "features.shell_tool": false,
        "features.unified_exec": false,
        "features.apply_patch_freeform": false,
        web_search: "disabled",
      },
    });
    const { thread } = z.object({ thread: z.object({ id: z.string() }) }).parse(result);
    const completion = Promise.withResolvers<string>();
    let turnId: string | null = null;
    const timeout = setTimeout(() => {
      if (turnId) {
        void this.request("turn/interrupt", { threadId: thread.id, turnId }).catch(() => undefined);
      }
      completion.reject(new Error("Guide generation timed out. Try again."));
    }, 300_000);
    this.pendingGenerations.set(thread.id, { ...completion, text: "", timeout });
    // Register completion before starting the turn because notifications can arrive first.
    const started = this.request("turn/start", {
      threadId: thread.id,
      input: [{ type: "text", text: input.prompt }],
      outputSchema: input.outputSchema,
    }).then((response) => {
      turnId = z.object({ turn: z.object({ id: z.string() }) }).parse(response).turn.id;
    });
    try {
      const [, text] = await Promise.all([started, completion.promise]);
      return text;
    } finally {
      clearTimeout(timeout);
      this.pendingGenerations.delete(thread.id);
      void this.request("thread/unsubscribe", { threadId: thread.id }).catch(() => undefined);
    }
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
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      return;
    }
    const notification = notificationSchema.safeParse(value);
    if (notification.success) {
      const { method, params } = notification.data;
      const generation = this.pendingGenerations.get(params.threadId);
      if (!generation) {
        return;
      }
      if (method === "item/completed") {
        const item = completedItemSchema.safeParse(params);
        if (item.success && item.data.item.phase !== "commentary") {
          generation.text = item.data.item.text;
        }
      }
      if (method === "turn/completed") {
        const turn = completedTurnSchema.safeParse(params);
        if (turn.success) {
          if (turn.data.turn.status === "completed" && generation.text) {
            generation.resolve(generation.text);
          } else {
            generation.reject(new Error(turn.data.turn.error?.message ?? "Codex did not finish the guide. Try again."));
          }
        }
      }
      return;
    }
    const parsed = jsonRpcResponseSchema.safeParse(value);
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
    for (const generation of this.pendingGenerations.values()) {
      clearTimeout(generation.timeout);
      generation.reject(error);
    }
    this.pendingGenerations.clear();
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }
}
