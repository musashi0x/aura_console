import { usdcString } from "../domain/usdc.js";

import type { ComputeEnv } from "./env.js";

/**
 * A client for EconomyOS Agent Compute.
 *
 * Compute is an economic action wearing an HTTP request: every completion is
 * drawn from the agent's compute balance, which auto-top-up refills from the
 * same wallet that funds ACP jobs. So this module holds to the same two rules
 * the marketplace side does. Money is a string, never a float. And nothing
 * here decides to spend — a caller has to ask for a completion, exactly as an
 * operator has to author a fund authorization.
 *
 * https://os.virtuals.io/agent-identity/compute/overview
 */

/** One entry from `/models`. `contextLength` is absent on some models. */
export type ComputeModel = {
  id: string;
  name: string | null;
  description: string | null;
  contextLength: number | null;
};

/**
 * What a completion cost, in tokens and in money.
 *
 * `reasoningTokens` is broken out because it is billed and invisible: on a
 * reasoning model it is spent before any assistant text exists, so a request
 * can be charged in full and still return no content.
 */
export type ComputeUsage = {
  promptTokens: number;
  completionTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  costUsdc: string;
};

/**
 * `content` is nullable on purpose, and it is not a defensive maybe.
 *
 * A reasoning model whose `max_tokens` is consumed by its own reasoning
 * returns `content: null` with `finish_reason: "length"` — a request that was
 * charged, succeeded at the protocol level, and produced nothing to read.
 * Making that representable stops a caller writing an empty string into
 * history and calling it an answer.
 */
export type ComputeCompletion = {
  model: string;
  provider: string | null;
  content: string | null;
  finishReason: string;
  usage: ComputeUsage;
};

export type ComputeRequest = {
  model: string;
  messages: ReadonlyArray<{ role: "system" | "user" | "assistant"; content: string }>;
  maxTokens: number;
};

/**
 * Never throws, so a caller cannot forget to handle a failed call. The same
 * discipline the web app's `ApiResult` applies to its own fetches, for the
 * same reason: an unhandled reject here would surface as a crashed worker.
 */
export type ComputeResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: string; message: string };

const REQUEST_TIMEOUT_MS = 60_000;

function asFiniteNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export class ComputeClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(env: ComputeEnv) {
    this.baseUrl = env.ACP_COMPUTE_BASE_URL.replace(/\/$/, "");
    this.apiKey = env.ACP_API_KEY;
  }

  /**
   * The catalog changes, so it is fetched rather than hardcoded — the docs say
   * so explicitly, and a stale model id fails at request time with nothing
   * useful to say about why.
   */
  async listModels(): Promise<ComputeResult<ComputeModel[]>> {
    const response = await this.send("/models", { method: "GET" });
    if (!response.ok) return response;

    const data = (response.value as { data?: unknown }).data;
    if (!Array.isArray(data)) {
      return { ok: false, code: "compute_malformed_response", message: "/models returned no data array" };
    }

    return {
      ok: true,
      value: data.map((entry) => {
        const model = entry as Record<string, unknown>;
        return {
          id: String(model.id ?? ""),
          name: asNullableString(model.name),
          description: asNullableString(model.description),
          contextLength:
            typeof model.contextLength === "number" ? model.contextLength : null,
        };
      }),
    };
  }

  /**
   * One chat completion. Costs money on success and on a truncated answer
   * alike, which is why the usage block is returned rather than summarised
   * away: the caller needs the spend even when there is no content.
   */
  async complete(request: ComputeRequest): Promise<ComputeResult<ComputeCompletion>> {
    const response = await this.send("/chat/completions", {
      method: "POST",
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        max_tokens: request.maxTokens,
      }),
    });
    if (!response.ok) return response;

    const body = response.value as Record<string, unknown>;
    const choice = (body.choices as Array<Record<string, unknown>> | undefined)?.[0];
    if (!choice) {
      return {
        ok: false,
        code: "compute_malformed_response",
        message: "chat completion returned no choices",
      };
    }

    const usage = (body.usage ?? {}) as Record<string, unknown>;
    const completionDetails = (usage.completion_tokens_details ?? {}) as Record<string, unknown>;
    const message = (choice.message ?? {}) as Record<string, unknown>;

    return {
      ok: true,
      value: {
        model: String(body.model ?? request.model),
        provider: asNullableString(body.provider),
        content: asNullableString(message.content),
        finishReason: String(choice.finish_reason ?? "unknown"),
        usage: {
          promptTokens: asFiniteNumber(usage.prompt_tokens),
          completionTokens: asFiniteNumber(usage.completion_tokens),
          reasoningTokens: asFiniteNumber(completionDetails.reasoning_tokens),
          totalTokens: asFiniteNumber(usage.total_tokens),
          // The gateway sends cost as a JSON number, so the float has already
          // happened. Converting once here is the same boundary trade
          // `usdcString` documents for the SDK's `number` amounts.
          costUsdc: usdcString(asFiniteNumber(usage.cost)),
        },
      },
    };
  }

  /**
   * The one place a compute HTTP call is made.
   *
   * Success is any 2xx, not 200: the gateway answers a chat completion with
   * 201, and an equality check on 200 would report a completed, billed request
   * as a failure.
   */
  private async send(path: string, init: RequestInit): Promise<ComputeResult<unknown>> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      return {
        ok: false,
        code: "compute_unreachable",
        message: `${this.baseUrl}${path}: ${String(error)}`,
      };
    }

    const text = await response.text();

    if (!response.ok) {
      // The key is never echoed, and neither is the request body: an error
      // from this endpoint is about the account, so the status and the
      // server's own message are the whole of what is useful.
      return {
        ok: false,
        code: `compute_http_${response.status}`,
        message: text.slice(0, 300),
      };
    }

    try {
      return { ok: true, value: JSON.parse(text) as unknown };
    } catch {
      return {
        ok: false,
        code: "compute_malformed_response",
        message: `${path} returned a non-JSON body`,
      };
    }
  }
}
