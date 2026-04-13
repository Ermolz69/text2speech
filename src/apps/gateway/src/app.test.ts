import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  AnalyzeRequestDto,
  AnalyzeResponseDto,
  SynthesizeRequestDto,
  SynthesizeResponseDto,
} from "shared";

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
    fetchAudio: vi.fn(),
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
    const analyzeResponse: AnalyzeResponseDto = {
      segments: [
        {
          text: "Hello! :)",
          emotion: "joy",
          intensity: 2,
          punctuation: ["exclamation"],
          pauseAfterMs: 150,
        },
      ],
    };

    const textAnalysisClient = createTextAnalysisClientMock({
      analyze: vi.fn().mockResolvedValue(analyzeResponse),
    });

    app = createApp({ textAnalysisClient });

    const payload: AnalyzeRequestDto = {
      text: "Hello! :)",
    };

    const response = await app.inject({
      method: "POST",
      url: "/api/analyze",
      payload,
    });

    expect(response.statusCode).toBe(200);
    expect(textAnalysisClient.analyze).toHaveBeenCalledWith(payload);
    expect(response.json()).toEqual(analyzeResponse);
  });

  it("returns the shared validation error envelope when text is missing", async () => {
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

  it("fails fast when analyze text is blank or whitespace", async () => {
    const textAnalysisClient = createTextAnalysisClientMock();
    app = createApp({ textAnalysisClient });

    const response = await app.inject({
      method: "POST",
      url: "/api/analyze",
      payload: {
        text: "   ",
      },
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
            message: 'must match pattern "\\S"',
            code: "pattern",
          },
        ],
      },
    });
  });

  it("fails fast when analyze payload contains unexpected fields", async () => {
    const textAnalysisClient = createTextAnalysisClientMock();
    app = createApp({ textAnalysisClient });

    const response = await app.inject({
      method: "POST",
      url: "/api/analyze",
      payload: {
        text: "Hello",
        debug: true,
      },
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
            location: "body",
            message: "must NOT have additional properties",
            code: "additionalProperties",
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

describe("gateway tts debug route", () => {
  let app = createApp();

  afterEach(async () => {
    await app.close();
    app = createApp();
  });

  it("returns text-analysis metadata without running synthesis", async () => {
    const analyzeResponse: AnalyzeResponseDto = {
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
    };

    const textAnalysisClient = createTextAnalysisClientMock({
      analyze: vi.fn().mockResolvedValue(analyzeResponse),
    });

    const ttsAdapterClient = createTtsAdapterClientMock();
    app = createApp({ textAnalysisClient, ttsAdapterClient });

    const payload: AnalyzeRequestDto = {
      text: "Hello! :)",
    };

    const response = await app.inject({
      method: "POST",
      url: "/api/tts/debug",
      payload,
    });

    expect(response.statusCode).toBe(200);
    expect(textAnalysisClient.analyze).toHaveBeenCalledWith(payload);
    expect(ttsAdapterClient.synthesize).not.toHaveBeenCalled();
    expect(response.json()).toEqual(analyzeResponse);
  });

  it("returns a shared validation error when text is missing", async () => {
    const textAnalysisClient = createTextAnalysisClientMock();
    const ttsAdapterClient = createTtsAdapterClientMock();
    app = createApp({ textAnalysisClient, ttsAdapterClient });

    const response = await app.inject({
      method: "POST",
      url: "/api/tts/debug",
      payload: {},
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
        path: "/api/tts/debug",
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

  it("returns a shared timeout error when text-analysis times out", async () => {
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
      url: "/api/tts/debug",
      payload: {
        text: "Hello",
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
        path: "/api/tts/debug",
      },
    });
  });

  it("returns a shared upstream error when text-analysis fails", async () => {
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
      url: "/api/tts/debug",
      payload: {
        text: "Hello",
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
        path: "/api/tts/debug",
      },
    });
  });

  it("returns the shared runtime error envelope for unexpected failures", async () => {
    const textAnalysisClient = createTextAnalysisClientMock({
      analyze: vi.fn().mockRejectedValue(new Error("Boom")),
    });

    const ttsAdapterClient = createTtsAdapterClientMock();
    app = createApp({ textAnalysisClient, ttsAdapterClient });

    const response = await app.inject({
      method: "POST",
      url: "/api/tts/debug",
      payload: {
        text: "Hello there",
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
        path: "/api/tts/debug",
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
    const analyzeResponse: AnalyzeResponseDto = {
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
    };

    const textAnalysisClient = createTextAnalysisClientMock({
      analyze: vi.fn().mockResolvedValue(analyzeResponse),
    });

    const synthesizeResponse: SynthesizeResponseDto = {
      audioUrl: "/audio/voice.wav",
      metadata: {
        format: "wav",
        emotion: "anger",
        intensity: 3,
        segments: analyzeResponse.segments,
      },
    };

    const ttsAdapterClient = createTtsAdapterClientMock({
      synthesize: vi.fn().mockResolvedValue(synthesizeResponse),
    });

    app = createApp({ textAnalysisClient, ttsAdapterClient });

    const payload: SynthesizeRequestDto = {
      text: "Hello! :)",
      voiceId: "voice-1",
      metadata: {
        format: "wav",
      },
    };

    const expectedSynthesizeRequest: SynthesizeRequestDto = {
      text: "Hello! :)",
      voiceId: "voice-1",
      metadata: {
        format: "wav",
        segments: analyzeResponse.segments,
      },
    };

    const response = await app.inject({
      method: "POST",
      url: "/api/tts",
      payload,
    });

    expect(response.statusCode).toBe(200);
    expect(textAnalysisClient.analyze).toHaveBeenCalledWith({ text: payload.text });
    expect(ttsAdapterClient.synthesize).toHaveBeenCalledWith(expectedSynthesizeRequest);
    expect(response.json()).toEqual({
      ...synthesizeResponse,
      audioUrl: "/api/audio/voice.wav",
    });
  });

  it("uses analyze-generated segments when caller provides only allowed metadata fields", async () => {
    const analyzeResponse: AnalyzeResponseDto = {
      segments: [{ text: "Analyzed", emotion: "neutral", intensity: 1, pauseAfterMs: 100 }],
    };

    const textAnalysisClient = createTextAnalysisClientMock({
      analyze: vi.fn().mockResolvedValue(analyzeResponse),
    });

    const ttsAdapterClient = createTtsAdapterClientMock({
      synthesize: vi.fn().mockResolvedValue({
        audioUrl: "/audio/voice.wav",
        metadata: {
          segments: analyzeResponse.segments,
        },
      }),
    });

    app = createApp({ textAnalysisClient, ttsAdapterClient });

    const payload: SynthesizeRequestDto = {
      text: "Original",
      voiceId: "voice-1",
      metadata: {
        format: "wav",
        emotion: "anger",
        intensity: 3,
      },
    };

    const response = await app.inject({
      method: "POST",
      url: "/api/tts",
      payload,
    });

    expect(response.statusCode).toBe(200);
    expect(ttsAdapterClient.synthesize).toHaveBeenCalledWith({
      text: "Original",
      voiceId: "voice-1",
      metadata: {
        format: "wav",
        emotion: "anger",
        intensity: 3,
        segments: analyzeResponse.segments,
      },
    });
    expect(response.json()).toEqual({
      audioUrl: "/api/audio/voice.wav",
      metadata: {
        segments: analyzeResponse.segments,
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

  it("fails fast when tts text is blank or whitespace", async () => {
    const textAnalysisClient = createTextAnalysisClientMock();
    const ttsAdapterClient = createTtsAdapterClientMock();
    app = createApp({ textAnalysisClient, ttsAdapterClient });

    const response = await app.inject({
      method: "POST",
      url: "/api/tts",
      payload: {
        text: "   ",
        voiceId: "voice-1",
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
            location: "body.text",
            message: 'must match pattern "\\S"',
            code: "pattern",
          },
        ],
      },
    });
  });

  it("fails fast when tts voiceId is blank or whitespace", async () => {
    const textAnalysisClient = createTextAnalysisClientMock();
    const ttsAdapterClient = createTtsAdapterClientMock();
    app = createApp({ textAnalysisClient, ttsAdapterClient });

    const response = await app.inject({
      method: "POST",
      url: "/api/tts",
      payload: {
        text: "Hello",
        voiceId: "   ",
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
            message: 'must match pattern "\\S"',
            code: "pattern",
          },
        ],
      },
    });
  });

  it("fails fast when tts payload contains unexpected fields", async () => {
    const textAnalysisClient = createTextAnalysisClientMock();
    const ttsAdapterClient = createTtsAdapterClientMock();
    app = createApp({ textAnalysisClient, ttsAdapterClient });

    const response = await app.inject({
      method: "POST",
      url: "/api/tts",
      payload: {
        text: "Hello",
        voiceId: "voice-1",
        debug: true,
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
            location: "body",
            message: "must NOT have additional properties",
            code: "additionalProperties",
          },
        ],
      },
    });
  });

  it("fails fast when tts metadata.format is invalid", async () => {
    const textAnalysisClient = createTextAnalysisClientMock();
    const ttsAdapterClient = createTtsAdapterClientMock();
    app = createApp({ textAnalysisClient, ttsAdapterClient });

    const response = await app.inject({
      method: "POST",
      url: "/api/tts",
      payload: {
        text: "Hello",
        voiceId: "voice-1",
        metadata: {
          format: "flac",
        },
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
            location: "body.metadata.format",
            message: "must be equal to one of the allowed values",
            code: "enum",
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

  it("rewrites adapter audio url into a gateway-owned audio url", async () => {
    const textAnalysisClient = createTextAnalysisClientMock({
      analyze: vi.fn().mockResolvedValue({
        segments: [{ text: "Hello", emotion: "neutral", intensity: 0 }],
      }),
    });
    const ttsAdapterClient = createTtsAdapterClientMock({
      synthesize: vi.fn().mockResolvedValue({
        audioUrl: "/audio/sample.wav",
        metadata: {
          segments: [{ text: "Hello", emotion: "neutral", intensity: 0 }],
        },
      }),
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

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      audioUrl: "/api/audio/sample.wav",
      metadata: {
        segments: [{ text: "Hello", emotion: "neutral", intensity: 0 }],
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

describe("gateway audio proxy route", () => {
  let app = createApp();

  afterEach(async () => {
    await app.close();
    app = createApp();
  });

  it("proxies playable audio from tts-adapter and preserves headers", async () => {
    const ttsAdapterClient = createTtsAdapterClientMock({
      fetchAudio: vi.fn().mockResolvedValue({
        body: Buffer.from([1, 2, 3]),
        contentType: "audio/wav",
        contentDisposition: 'inline; filename="sample.wav"',
      }),
    });

    app = createApp({
      textAnalysisClient: createTextAnalysisClientMock(),
      ttsAdapterClient,
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/audio/sample.wav",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("audio/wav");
    expect(response.headers["content-disposition"]).toBe('inline; filename="sample.wav"');
    expect(response.rawPayload).toEqual(Buffer.from([1, 2, 3]));
    expect(ttsAdapterClient.fetchAudio).toHaveBeenCalledWith("sample.wav");
  });

  it("returns 404 when the adapter audio file is missing", async () => {
    const ttsAdapterClient = createTtsAdapterClientMock({
      fetchAudio: vi
        .fn()
        .mockRejectedValue(
          new TtsAdapterClientError("upstream", "response_status", "missing", { statusCode: 404 })
        ),
    });

    app = createApp({
      textAnalysisClient: createTextAnalysisClientMock(),
      ttsAdapterClient,
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/audio/missing.wav",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: {
        code: "upstream_error",
        message: "Audio file was not found",
        status: 404,
        path: "/api/audio/missing.wav",
      },
    });
  });

  it("returns 504 when the adapter audio request times out", async () => {
    const ttsAdapterClient = createTtsAdapterClientMock({
      fetchAudio: vi
        .fn()
        .mockRejectedValue(
          new TtsAdapterClientError("timeout", "timeout", "TTS adapter audio request timed out")
        ),
    });

    app = createApp({
      textAnalysisClient: createTextAnalysisClientMock(),
      ttsAdapterClient,
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/audio/sample.wav",
    });

    expect(response.statusCode).toBe(504);
    expect(response.json()).toEqual({
      error: {
        code: "upstream_timeout",
        message: "TTS adapter service timed out",
        status: 504,
        path: "/api/audio/sample.wav",
      },
    });
  });
});
