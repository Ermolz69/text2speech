import { afterEach, describe, expect, it } from "vitest";

import { createApp } from "./app";

describe("gateway API errors", () => {
  let app = createApp();

  afterEach(async () => {
    await app.close();
    app = createApp();
  });

  it("returns the shared validation error envelope", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/analyze",
      payload: {},
    });

    expect(response.statusCode).toBe(422);
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

  it("returns the shared runtime error envelope", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/analyze",
      headers: {
        "x-force-error": "1",
      },
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
