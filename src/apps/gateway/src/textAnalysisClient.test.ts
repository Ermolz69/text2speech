import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTextAnalysisClient, mapAnalyzeResponse } from "./textAnalysisClient";

describe("textAnalysisClient", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("passes through a shared analyze response from Python", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          segments: [
            {
              text: "Hello! :)",
              emotion: "joy",
              intensity: 2,
              emoji: ["positive"],
              punctuation: ["exclamation"],
              pauseAfterMs: 250,
              rate: 1.1,
              pitchHint: 2,
              hesitationMarkers: ["uh"],
              stressedWords: ["REALLY"],
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }
      )
    );

    const client = createTextAnalysisClient({
      baseUrl: "http://text-analysis:8001",
      timeoutMs: 3000,
      fetchFn,
    });

    await expect(client.analyze({ text: "Hello! :)" }, { requestId: "req-123" })).resolves.toEqual({
      segments: [
        {
          text: "Hello! :)",
          emotion: "joy",
          intensity: 2,
          emoji: ["positive"],
          punctuation: ["exclamation"],
          pauseAfterMs: 250,
          rate: 1.1,
          pitchHint: 2,
          hesitationMarkers: ["uh"],
          stressedWords: ["REALLY"],
        },
      ],
    });

    expect(fetchFn).toHaveBeenCalledWith(
      "http://text-analysis:8001/analyze",
      expect.objectContaining({
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": "req-123",
        },
      })
    );
  });

  it("surfaces timeout failures cleanly", async () => {
    vi.useFakeTimers();

    const fetchFn = vi.fn().mockImplementation((_url, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });
    });

    const client = createTextAnalysisClient({
      baseUrl: "http://text-analysis:8001",
      timeoutMs: 25,
      fetchFn,
    });

    const promise = client.analyze({ text: "Hello" });
    const expectation = expect(promise).rejects.toMatchObject({
      name: "TextAnalysisClientError",
      kind: "timeout",
      message: "Text analysis service request timed out",
    });

    await vi.advanceTimersByTimeAsync(25);
    await expectation;
  });

  it("surfaces non-ok upstream responses cleanly", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("bad gateway", { status: 503 }));

    const client = createTextAnalysisClient({
      baseUrl: "http://text-analysis:8001",
      timeoutMs: 3000,
      fetchFn,
    });

    await expect(client.analyze({ text: "Hello" })).rejects.toMatchObject({
      name: "TextAnalysisClientError",
      kind: "upstream",
    });
  });

  it("surfaces malformed upstream payloads cleanly", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ invalid: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      })
    );

    const client = createTextAnalysisClient({
      baseUrl: "http://text-analysis:8001",
      timeoutMs: 3000,
      fetchFn,
    });

    await expect(client.analyze({ text: "Hello" })).rejects.toMatchObject({
      name: "TextAnalysisClientError",
      kind: "upstream",
      message: "Text analysis service returned an unexpected payload",
    });
  });
});

describe("mapAnalyzeResponse", () => {
  it("passes through the shared analyze DTO shape", () => {
    expect(
      mapAnalyzeResponse({
        segments: [
          {
            text: "Hello",
            emotion: "neutral",
            intensity: 0,
            pauseAfterMs: 150,
            rate: 1,
            pitchHint: 0,
            hesitationMarkers: ["um"],
            stressedWords: ["really"],
          },
        ],
      })
    ).toEqual({
      segments: [
        {
          text: "Hello",
          emotion: "neutral",
          intensity: 0,
          pauseAfterMs: 150,
          rate: 1,
          pitchHint: 0,
          hesitationMarkers: ["um"],
          stressedWords: ["really"],
        },
      ],
    });
  });
});
