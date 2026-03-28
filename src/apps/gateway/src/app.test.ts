import { afterEach, describe, expect, it, vi } from "vitest";

import { createApp } from "./app";
import { TextAnalysisClientError, type TextAnalysisClient } from "./textAnalysisClient";
import { TtsAdapterClientError, type TtsAdapterClient } from "./ttsAdapterClient";

function createTextAnalysisClientMock(
  overrides: Partial<TextAnalysisClient> = {}
): TextAnalysisClient {
  return {
    analyze: vi.fn(),
    ...overrides,
  };
}

function createTtsAdapterClientMock(overrides: Partial<TtsAdapterClient> = {}): TtsAdapterClient {
  return {
    synthesize: vi.fn(),
    ...overrides,
  };
}

function expectTopLevelErrorEnvelope(errorResponse: unknown): void {
  expect(errorResponse).toEqual(
    expect.objectContaining({
      error: expect.objectContaining({
        code: expect.any(String),
        message: expect.any(String),
        status: expect.any(Number),
        path: expect.any(String),
      }),
    })
  );
}

describe("gateway analyze route", () => {
  let app = createApp();

  afterEach(async () => {
    await app.close();
    app = createApp();
  });

  it("returns upstream analyze data on success", async () => {
    const textAnalysisClient = createTextAnalysisClientMock({
      analyze: vi.fn().mockResolvedValue({
        segments: [
          {
            text: "Hello! :)",
            emotion: "joy",
            intensity: 2,
            punctuation: ["exclamation"],
            pauseAfterMs: 150,
          },
        ],
      }),
    });

    app = createApp({ textAnalysisClient });

    const response = await app.inject({
      method: "POST",
      url: "/api/analyze",
      payload: {
        text: "Hello! :)",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(textAnalysisClient.analyze).toHaveBeenCalledWith({ text: "Hello! :)" });
    expect(response.json()).toEqual({
      segments: [
        {
          text: "Hello! :)",
          emotion: "joy",
          intensity: 2,
          punctuation: ["exclamation"],
          pauseAfterMs: 150,
        },
      ],
    });
  });

  it("returns the shared validation error envelope", async () => {
    const textAnalysisClient = createTextAnalysisClientMock();
    app = createApp({ textAnalysisClient });

    const response = await app.inject({
      method: "POST",
      url: "/api/analyze",
      payload: {},
    });

    expect(response.statusCode).toBe(422);
    expect(textAnalysisClient.analyze).not.toHaveBeenCalled();
    expectTopLevelErrorEnvelope(response.json());
    expect(response.json()).toEqual({
      error: {
        code: "validation_error",
        message: "Request validation failed",
        status: 422,
        path: "/api/analyze",
        details: [
          {
            location: "body.text",
            message: "must have required property 'text'",
            code: "required",
          },
        ],
      },
    });
  });

  it("returns a shared timeout error when the upstream request times out", async () => {
    const textAnalysisClient = createTextAnalysisClientMock({
      analyze: vi
        .fn()
        .mockRejectedValue(
          new TextAnalysisClientError("timeout", "Text analysis service request timed out")
        ),
    });

    app = createApp({ textAnalysisClient });

    const response = await app.inject({
      method: "POST",
      url: "/api/analyze",
      payload: {
        text: "Hello",
      },
    });

    expect(response.statusCode).toBe(504);
    expectTopLevelErrorEnvelope(response.json());
    expect(response.json()).toEqual({
      error: {
        code: "upstream_timeout",
        message: "Text analysis service timed out",
        status: 504,
        path: "/api/analyze",
      },
    });
  });

  it("returns a shared upstream error when the service request fails", async () => {
    const textAnalysisClient = createTextAnalysisClientMock({
      analyze: vi
        .fn()
        .mockRejectedValue(
          new TextAnalysisClientError("upstream", "Text analysis service request failed")
        ),
    });

    app = createApp({ textAnalysisClient });

    const response = await app.inject({
      method: "POST",
      url: "/api/analyze",
      payload: {
        text: "Hello",
      },
    });

    expect(response.statusCode).toBe(502);
    expectTopLevelErrorEnvelope(response.json());
    expect(response.json()).toEqual({
      error: {
        code: "upstream_error",
        message: "Text analysis service request failed",
        status: 502,
        path: "/api/analyze",
      },
    });
  });

  it("returns the shared runtime error envelope for unexpected failures", async () => {
    const textAnalysisClient = createTextAnalysisClientMock({
      analyze: vi.fn().mockRejectedValue(new Error("Boom")),
    });

    app = createApp({ textAnalysisClient });

    const response = await app.inject({
      method: "POST",
      url: "/api/analyze",
      payload: {
        text: "Hello there",
      },
    });

    expect(response.statusCode).toBe(500);
    expectTopLevelErrorEnvelope(response.json());
    expect(response.json()).toEqual({
      error: {
        code: "internal_error",
        message: "Internal server error",
        status: 500,
        path: "/api/analyze",
      },
    });
  });
});

describe("gateway tts route", () => {
  let app = createApp();

  afterEach(async () => {
    await app.close();
    app = createApp();
  });

  it("calls analyze first, then synthesizes with the generated segments", async () => {
    const textAnalysisClient = createTextAnalysisClientMock({
      analyze: vi.fn().mockResolvedValue({
        segments: [
          {
            text: "Hello! :)",
            emotion: "joy",
            intensity: 3,
            emoji: ["positive"],
            punctuation: ["exclamation"],
            pauseAfterMs: 250,
          },
        ],
      }),
    });

    const ttsAdapterClient = createTtsAdapterClientMock({
      synthesize: vi.fn().mockResolvedValue({
        audioUrl: "/voice.wav",
        metadata: {
          format: "wav",
          segments: [
            {
              text: "Hello! :)",
              emotion: "joy",
              intensity: 3,
              emoji: ["positive"],
              punctuation: ["exclamation"],
              pauseAfterMs: 250,
            },
          ],
        },
      }),
    });

    app = createApp({ textAnalysisClient, ttsAdapterClient });

    const response = await app.inject({
      method: "POST",
      url: "/api/tts",
      payload: {
        text: "Hello! :)",
        voiceId: "voice-1",
        metadata: {
          format: "wav",
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(textAnalysisClient.analyze).toHaveBeenCalledWith({ text: "Hello! :)" });
    expect(ttsAdapterClient.synthesize).toHaveBeenCalledWith({
      text: "Hello! :)",
      voiceId: "voice-1",
      metadata: {
        format: "wav",
        segments: [
          {
            text: "Hello! :)",
            emotion: "joy",
            intensity: 3,
            emoji: ["positive"],
            punctuation: ["exclamation"],
            pauseAfterMs: 250,
          },
        ],
      },
    });
    expect(response.json()).toEqual({
      audioUrl: "/voice.wav",
      metadata: {
        format: "wav",
        segments: [
          {
            text: "Hello! :)",
            emotion: "joy",
            intensity: 3,
            emoji: ["positive"],
            punctuation: ["exclamation"],
            pauseAfterMs: 250,
          },
        ],
      },
    });
  });

  it("uses analyze-generated segments instead of caller-supplied segments", async () => {
    const textAnalysisClient = createTextAnalysisClientMock({
      analyze: vi.fn().mockResolvedValue({
        segments: [{ text: "Analyzed", emotion: "neutral", intensity: 1, pauseAfterMs: 100 }],
      }),
    });

    const ttsAdapterClient = createTtsAdapterClientMock({
      synthesize: vi.fn().mockResolvedValue({
        audioUrl: "/voice.wav",
        metadata: {
          segments: [{ text: "Analyzed", emotion: "neutral", intensity: 1, pauseAfterMs: 100 }],
        },
      }),
    });

    app = createApp({ textAnalysisClient, ttsAdapterClient });

    const response = await app.inject({
      method: "POST",
      url: "/api/tts",
      payload: {
        text: "Original",
        voiceId: "voice-1",
        metadata: {
          format: "wav",
          segments: [{ text: "Caller", emotion: "anger", intensity: 3 }],
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(ttsAdapterClient.synthesize).toHaveBeenCalledWith({
      text: "Original",
      voiceId: "voice-1",
      metadata: {
        format: "wav",
        segments: [{ text: "Analyzed", emotion: "neutral", intensity: 1, pauseAfterMs: 100 }],
      },
    });
  });

  it("returns a shared validation error when voiceId is missing", async () => {
    const textAnalysisClient = createTextAnalysisClientMock();
    const ttsAdapterClient = createTtsAdapterClientMock();
    app = createApp({ textAnalysisClient, ttsAdapterClient });

    const response = await app.inject({
      method: "POST",
      url: "/api/tts",
      payload: {
        text: "Hello",
      },
    });

    expect(response.statusCode).toBe(422);
    expect(textAnalysisClient.analyze).not.toHaveBeenCalled();
    expect(ttsAdapterClient.synthesize).not.toHaveBeenCalled();
    expectTopLevelErrorEnvelope(response.json());
    expect(response.json()).toEqual({
      error: {
        code: "validation_error",
        message: "Request validation failed",
        status: 422,
        path: "/api/tts",
        details: [
          {
            location: "body.voiceId",
            message: "must have required property 'voiceId'",
            code: "required",
          },
        ],
      },
    });
  });

  it("returns a shared timeout error when analyze times out", async () => {
    const textAnalysisClient = createTextAnalysisClientMock({
      analyze: vi
        .fn()
        .mockRejectedValue(
          new TextAnalysisClientError("timeout", "Text analysis service request timed out")
        ),
    });
    const ttsAdapterClient = createTtsAdapterClientMock();

    app = createApp({ textAnalysisClient, ttsAdapterClient });

    const response = await app.inject({
      method: "POST",
      url: "/api/tts",
      payload: {
        text: "Hello",
        voiceId: "voice-1",
      },
    });

    expect(response.statusCode).toBe(504);
    expect(ttsAdapterClient.synthesize).not.toHaveBeenCalled();
    expectTopLevelErrorEnvelope(response.json());
    expect(response.json()).toEqual({
      error: {
        code: "upstream_timeout",
        message: "Text analysis service timed out",
        status: 504,
        path: "/api/tts",
      },
    });
  });

  it("returns a shared upstream error when analyze fails", async () => {
    const textAnalysisClient = createTextAnalysisClientMock({
      analyze: vi
        .fn()
        .mockRejectedValue(
          new TextAnalysisClientError("upstream", "Text analysis service request failed")
        ),
    });
    const ttsAdapterClient = createTtsAdapterClientMock();

    app = createApp({ textAnalysisClient, ttsAdapterClient });

    const response = await app.inject({
      method: "POST",
      url: "/api/tts",
      payload: {
        text: "Hello",
        voiceId: "voice-1",
      },
    });

    expect(response.statusCode).toBe(502);
    expect(ttsAdapterClient.synthesize).not.toHaveBeenCalled();
    expectTopLevelErrorEnvelope(response.json());
    expect(response.json()).toEqual({
      error: {
        code: "upstream_error",
        message: "Text analysis service request failed",
        status: 502,
        path: "/api/tts",
      },
    });
  });

  it("returns a shared timeout error when synthesize times out after analyze succeeds", async () => {
    const textAnalysisClient = createTextAnalysisClientMock({
      analyze: vi.fn().mockResolvedValue({
        segments: [{ text: "Hello", emotion: "neutral", intensity: 0 }],
      }),
    });
    const ttsAdapterClient = createTtsAdapterClientMock({
      synthesize: vi
        .fn()
        .mockRejectedValue(
          new TtsAdapterClientError("timeout", "timeout", "TTS adapter service request timed out")
        ),
    });

    app = createApp({ textAnalysisClient, ttsAdapterClient });

    const response = await app.inject({
      method: "POST",
      url: "/api/tts",
      payload: {
        text: "Hello",
        voiceId: "voice-1",
      },
    });

    expect(response.statusCode).toBe(504);
    expectTopLevelErrorEnvelope(response.json());
    expect(response.json()).toEqual({
      error: {
        code: "upstream_timeout",
        message: "TTS adapter service timed out",
        status: 504,
        path: "/api/tts",
      },
    });
  });

  it("returns a shared upstream error when synthesize fails after analyze succeeds", async () => {
    const textAnalysisClient = createTextAnalysisClientMock({
      analyze: vi.fn().mockResolvedValue({
        segments: [{ text: "Hello", emotion: "neutral", intensity: 0 }],
      }),
    });
    const ttsAdapterClient = createTtsAdapterClientMock({
      synthesize: vi
        .fn()
        .mockRejectedValue(
          new TtsAdapterClientError(
            "upstream",
            "response_status",
            "TTS adapter service request failed",
            { statusCode: 503 }
          )
        ),
    });

    app = createApp({ textAnalysisClient, ttsAdapterClient });

    const response = await app.inject({
      method: "POST",
      url: "/api/tts",
      payload: {
        text: "Hello",
        voiceId: "voice-1",
      },
    });

    expect(response.statusCode).toBe(502);
    expectTopLevelErrorEnvelope(response.json());
    expect(response.json()).toEqual({
      error: {
        code: "upstream_error",
        message: "TTS adapter service request failed",
        status: 502,
        path: "/api/tts",
      },
    });
  });

  it("returns the shared runtime error envelope for unexpected orchestration failures", async () => {
    const textAnalysisClient = createTextAnalysisClientMock({
      analyze: vi.fn().mockRejectedValue(new Error("Boom")),
    });
    const ttsAdapterClient = createTtsAdapterClientMock();

    app = createApp({ textAnalysisClient, ttsAdapterClient });

    const response = await app.inject({
      method: "POST",
      url: "/api/tts",
      payload: {
        text: "Hello",
        voiceId: "voice-1",
      },
    });

    expect(response.statusCode).toBe(500);
    expect(ttsAdapterClient.synthesize).not.toHaveBeenCalled();
    expectTopLevelErrorEnvelope(response.json());
    expect(response.json()).toEqual({
      error: {
        code: "internal_error",
        message: "Internal server error",
        status: 500,
        path: "/api/tts",
      },
    });
  });
});
