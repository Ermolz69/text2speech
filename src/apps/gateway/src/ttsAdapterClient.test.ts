import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTtsAdapterClient,
  mapSynthesizeRequest,
  mapSynthesizeResponse,
} from "./ttsAdapterClient";

describe("ttsAdapterClient", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("passes through a shared synthesize request and response", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          audioUrl: "/audio/placeholder.wav",
          metadata: {
            format: "wav",
            segments: [
              {
                text: "Hello! :)",
                emotion: "joy",
                intensity: 2,
                emoji: ["positive"],
                punctuation: ["exclamation"],
                pauseAfterMs: 250,
                rate: 1.1,
                pitchHint: 2.0,
              },
            ],
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }
      )
    );

    const payload = {
      text: "Hello! :)",
      voiceId: "voice-1",
      metadata: {
        format: "wav" as const,
        segments: [
          {
            text: "Hello! :)",
            emotion: "joy" as const,
            intensity: 2 as const,
            emoji: ["positive"],
            punctuation: ["exclamation"],
            pauseAfterMs: 250,
            rate: 1.1,
            pitchHint: 2.0,
          },
        ],
      },
    };

    const client = createTtsAdapterClient({
      baseUrl: "http://tts-adapter:8002",
      timeoutMs: 3000,
      fetchFn,
    });

    await expect(client.synthesize(payload, { requestId: "req-456" })).resolves.toEqual({
      audioUrl: "/audio/placeholder.wav",
      metadata: payload.metadata,
    });

    expect(fetchFn).toHaveBeenCalledWith(
      "http://tts-adapter:8002/synthesize",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": "req-456",
        },
        body: JSON.stringify(payload),
      })
    );
  });

  it("fetches adapter audio and preserves response headers", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: {
          "Content-Type": "audio/wav",
          "Content-Disposition": 'inline; filename="sample.wav"',
        },
      })
    );

    const client = createTtsAdapterClient({
      baseUrl: "http://tts-adapter:8002",
      timeoutMs: 3000,
      fetchFn,
    });

    await expect(client.fetchAudio("sample.wav", { requestId: "req-audio" })).resolves.toEqual({
      body: Buffer.from([1, 2, 3]),
      contentType: "audio/wav",
      contentDisposition: 'inline; filename="sample.wav"',
    });

    expect(fetchFn).toHaveBeenCalledWith(
      "http://tts-adapter:8002/audio/sample.wav",
      expect.objectContaining({
        method: "GET",
        headers: {
          "X-Request-Id": "req-audio",
        },
        signal: expect.any(AbortSignal),
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

    const client = createTtsAdapterClient({
      baseUrl: "http://tts-adapter:8002",
      timeoutMs: 25,
      fetchFn,
    });

    const promise = client.synthesize({
      text: "Hello",
      voiceId: "voice-1",
      metadata: {
        segments: [{ text: "Hello", emotion: "neutral", intensity: 0 }],
      },
    });
    const expectation = expect(promise).rejects.toMatchObject({
      name: "TtsAdapterClientError",
      kind: "timeout",
      reason: "timeout",
      message: "TTS adapter service request timed out",
    });

    await vi.advanceTimersByTimeAsync(25);
    await expectation;
  });

  it("surfaces non-ok upstream responses cleanly", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("bad gateway", { status: 503 }));

    const client = createTtsAdapterClient({
      baseUrl: "http://tts-adapter:8002",
      timeoutMs: 3000,
      fetchFn,
    });

    await expect(
      client.synthesize({
        text: "Hello",
        voiceId: "voice-1",
        metadata: {
          segments: [{ text: "Hello", emotion: "neutral", intensity: 0 }],
        },
      })
    ).rejects.toMatchObject({
      name: "TtsAdapterClientError",
      kind: "upstream",
      reason: "response_status",
      statusCode: 503,
    });
  });

  it("surfaces non-ok audio responses cleanly", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("missing", { status: 404 }));

    const client = createTtsAdapterClient({
      baseUrl: "http://tts-adapter:8002",
      timeoutMs: 3000,
      fetchFn,
    });

    await expect(client.fetchAudio("missing.wav")).rejects.toMatchObject({
      name: "TtsAdapterClientError",
      kind: "upstream",
      reason: "response_status",
      statusCode: 404,
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

    const client = createTtsAdapterClient({
      baseUrl: "http://tts-adapter:8002",
      timeoutMs: 3000,
      fetchFn,
    });

    await expect(
      client.synthesize({
        text: "Hello",
        voiceId: "voice-1",
        metadata: {
          segments: [{ text: "Hello", emotion: "neutral", intensity: 0 }],
        },
      })
    ).rejects.toMatchObject({
      name: "TtsAdapterClientError",
      kind: "upstream",
      reason: "invalid_payload",
      message: "TTS adapter service returned an unexpected payload",
    });
  });

  it("surfaces network failures distinctly from upstream status errors", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError("fetch failed"));

    const client = createTtsAdapterClient({
      baseUrl: "http://tts-adapter:8002",
      timeoutMs: 3000,
      fetchFn,
    });

    await expect(
      client.synthesize({
        text: "Hello",
        voiceId: "voice-1",
        metadata: {
          segments: [{ text: "Hello", emotion: "neutral", intensity: 0 }],
        },
      })
    ).rejects.toMatchObject({
      name: "TtsAdapterClientError",
      kind: "upstream",
      reason: "network",
      message: "TTS adapter service request failed",
    });
  });
});

describe("ttsAdapterClient mappers", () => {
  it("passes through the shared synthesis request shape", () => {
    expect(
      mapSynthesizeRequest({
        text: "Hello",
        voiceId: "voice-1",
        metadata: {
          segments: [
            {
              text: "Hello",
              emotion: "playful",
              intensity: 2,
              emoji: ["smile"],
              punctuation: ["question"],
              pauseAfterMs: 150,
              rate: 0.9,
              pitchHint: -1.0,
            },
          ],
        },
      })
    ).toEqual({
      text: "Hello",
      voiceId: "voice-1",
      metadata: {
        segments: [
          {
            text: "Hello",
            emotion: "playful",
            intensity: 2,
            emoji: ["smile"],
            punctuation: ["question"],
            pauseAfterMs: 150,
            rate: 0.9,
            pitchHint: -1.0,
          },
        ],
      },
    });
  });

  it("passes through the shared synthesis response shape", () => {
    expect(
      mapSynthesizeResponse({
        audioUrl: "/audio/voice.wav",
        metadata: {
          segments: [{ text: "Hello", emotion: "neutral", intensity: 0 }],
          format: "wav",
        },
      })
    ).toEqual({
      audioUrl: "/audio/voice.wav",
      metadata: {
        segments: [{ text: "Hello", emotion: "neutral", intensity: 0 }],
        format: "wav",
      },
    });
  });
});
