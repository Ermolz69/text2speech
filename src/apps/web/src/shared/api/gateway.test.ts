import { afterEach, describe, expect, it, vi } from "vitest";

import { analyzeText, getHealth, synthesizeText } from "./gateway";

describe("gateway api client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("posts analyze requests to the gateway", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ segments: [{ text: "Hello!", emotion: "happy", intensity: 1 }] }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );

    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzeText({ text: "Hello!" });

    expect(fetchMock).toHaveBeenCalledWith("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: "Hello!" }),
    });
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]?.text).toBe("Hello!");
  });

  it("posts synthesis requests to the gateway", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ audioUrl: "/api/audio/test.wav" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    vi.stubGlobal("fetch", fetchMock);

    const payload = {
      text: "Hello!",
      voiceId: "voice-1",
      metadata: {
        format: "wav" as const,
        emotion: "neutral" as const,
        intensity: 0 as const,
      },
    };

    const result = await synthesizeText(payload);

    expect(fetchMock).toHaveBeenCalledWith("/api/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    expect(result.audioUrl).toBe("/api/audio/test.wav");
  });

  it("loads health status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "ok", service: "gateway" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(getHealth()).resolves.toEqual({ status: "ok", service: "gateway" });
    expect(fetchMock).toHaveBeenCalledWith("/health", { method: "GET" });
  });

  it("throws a helpful error when the gateway responds with a failure status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "boom" }), { status: 502 }))
    );

    await expect(analyzeText({ text: "Hello" })).rejects.toThrow(
      "Gateway request failed with status 502"
    );
  });
});
