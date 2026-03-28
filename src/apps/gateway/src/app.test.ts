import { afterEach, describe, expect, it, vi } from "vitest";

import { createApp } from "./app";
import { TextAnalysisClientError, type TextAnalysisClient } from "./textAnalysisClient";

function createTextAnalysisClientMock(
  overrides: Partial<TextAnalysisClient> = {}
): TextAnalysisClient {
  return {
    analyze: vi.fn(),
    ...overrides,
  };
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
