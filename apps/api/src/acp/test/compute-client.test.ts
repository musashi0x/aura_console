import { afterEach, describe, expect, it, vi } from "vitest";

import { ComputeClient } from "../compute/client.js";
import { DEFAULT_COMPUTE_BASE_URL } from "../compute/env.js";

const env = {
  ACP_API_KEY: "acp-db745c76c907b33680cd",
  ACP_COMPUTE_BASE_URL: DEFAULT_COMPUTE_BASE_URL,
};

function stubFetch(status: number, body: unknown): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), { status }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const completionBody = {
  model: "anthropic/claude-fable-5",
  provider: "Azure",
  choices: [{ finish_reason: "stop", message: { content: "ok" } }],
  usage: {
    prompt_tokens: 9,
    completion_tokens: 11,
    total_tokens: 20,
    cost: 0.00036,
    completion_tokens_details: { reasoning_tokens: 5 },
  },
};

const request = {
  model: "anthropic-claude-fable-5",
  messages: [{ role: "user" as const, content: "say ok" }],
  maxTokens: 200,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ComputeClient.complete", () => {
  /**
   * The gateway answers a completion with 201. An equality check on 200 would
   * report a request that succeeded, and was billed, as a failure.
   */
  it("treats 201 as success", async () => {
    stubFetch(201, completionBody);

    const result = await new ComputeClient(env).complete(request);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.content).toBe("ok");
    expect(result.value.finishReason).toBe("stop");
    expect(result.value.provider).toBe("Azure");
  });

  it("carries the key as a bearer token and nothing else", async () => {
    const fetchMock = stubFetch(201, completionBody);

    await new ComputeClient(env).complete(request);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${DEFAULT_COMPUTE_BASE_URL}/chat/completions`);
    expect((init.headers as Record<string, string>).authorization).toBe(`Bearer ${env.ACP_API_KEY}`);
  });

  it("keeps cost as a six-decimal string, never a float", async () => {
    stubFetch(201, completionBody);

    const result = await new ComputeClient(env).complete(request);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.usage.costUsdc).toBe("0.000360");
    expect(typeof result.value.usage.costUsdc).toBe("string");
  });

  /**
   * A reasoning model whose budget is consumed before it writes anything
   * returns no content and is charged in full. Null has to survive to the
   * caller, or an empty string gets recorded as an answer.
   */
  it("surfaces a billed completion that produced no content", async () => {
    stubFetch(201, {
      ...completionBody,
      choices: [{ finish_reason: "length", message: { content: null } }],
      usage: { ...completionBody.usage, cost: 0.00034, completion_tokens_details: { reasoning_tokens: 5 } },
    });

    const result = await new ComputeClient(env).complete(request);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.content).toBeNull();
    expect(result.value.finishReason).toBe("length");
    expect(result.value.usage.reasoningTokens).toBe(5);
    expect(result.value.usage.costUsdc).toBe("0.000340");
  });

  it("returns a coded failure for a non-2xx, without throwing", async () => {
    stubFetch(402, { message: "insufficient compute balance" });

    const result = await new ComputeClient(env).complete(request);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("compute_http_402");
    expect(result.message).toContain("insufficient compute balance");
  });

  it("never puts the key in an error message", async () => {
    stubFetch(401, { message: "unauthorized" });

    const result = await new ComputeClient(env).complete(request);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).not.toContain(env.ACP_API_KEY);
  });

  it("reports an unreachable endpoint instead of rejecting", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("getaddrinfo ENOTFOUND");
      }),
    );

    const result = await new ComputeClient(env).complete(request);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("compute_unreachable");
  });

  it("reports a body that is not the documented shape", async () => {
    stubFetch(201, { choices: [] });

    const result = await new ComputeClient(env).complete(request);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("compute_malformed_response");
  });
});

describe("ComputeClient.listModels", () => {
  it("maps the catalog and tolerates a missing context length", async () => {
    stubFetch(200, {
      data: [
        { id: "anthropic-claude-fable-5", name: "Claude Fable 5", description: "d", contextLength: 200_000 },
        { id: "some-model" },
      ],
    });

    const result = await new ComputeClient(env).listModels();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(2);
    expect(result.value[0]?.contextLength).toBe(200_000);
    expect(result.value[1]).toMatchObject({ id: "some-model", name: null, contextLength: null });
  });

  it("strips a trailing slash from the configured endpoint", async () => {
    const fetchMock = stubFetch(200, { data: [] });

    await new ComputeClient({ ...env, ACP_COMPUTE_BASE_URL: `${DEFAULT_COMPUTE_BASE_URL}/` }).listModels();

    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${DEFAULT_COMPUTE_BASE_URL}/models`);
  });
});
