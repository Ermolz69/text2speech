import { describe, expect, it } from "vitest";

import { getSummaryState, inferSummaryEmotion, inferSummaryIntensity } from "./summary";

describe("home summary model", () => {
  it("returns a neutral zero summary for empty segments", () => {
    expect(inferSummaryEmotion([])).toBe("neutral");
    expect(inferSummaryIntensity([])).toBe(0);
    expect(getSummaryState([])).toEqual({ emotion: "neutral", intensity: 0 });
  });

  it("selects the emotion with the strongest weighted score", () => {
    expect(
      inferSummaryEmotion([
        {
          text: "steady",
          emotion: "neutral",
          intensity: 0,
          pauseAfterMs: 0,
          emoji: [],
          punctuation: [],
        },
        {
          text: "yay",
          emotion: "happy",
          intensity: 2,
          pauseAfterMs: 120,
          emoji: [":)"],
          punctuation: ["!"],
        },
      ])
    ).toBe("happy");
  });

  it("maps average intensity into the four summary buckets", () => {
    expect(
      inferSummaryIntensity([
        {
          text: "low",
          emotion: "neutral",
          intensity: 0,
          pauseAfterMs: 0,
          emoji: [],
          punctuation: [],
        },
      ])
    ).toBe(0);

    expect(
      inferSummaryIntensity([
        {
          text: "soft",
          emotion: "sad",
          intensity: 1,
          pauseAfterMs: 200,
          emoji: [],
          punctuation: ["..."],
        },
      ])
    ).toBe(1);

    expect(
      inferSummaryIntensity([
        {
          text: "strong",
          emotion: "happy",
          intensity: 2,
          pauseAfterMs: 180,
          emoji: [":)"],
          punctuation: ["!"],
        },
      ])
    ).toBe(2);

    expect(
      inferSummaryIntensity([
        {
          text: "very strong",
          emotion: "happy",
          intensity: 3,
          pauseAfterMs: 180,
          emoji: [":)"],
          punctuation: ["!!"],
        },
      ])
    ).toBe(3);
  });

  it("builds a combined summary from populated segments", () => {
    expect(
      getSummaryState([
        {
          text: "Hello! :)",
          emotion: "happy",
          intensity: 2,
          pauseAfterMs: 180,
          emoji: [":)"],
          punctuation: ["!"],
        },
        {
          text: "Still good",
          emotion: "happy",
          intensity: 1,
          pauseAfterMs: 80,
          emoji: [],
          punctuation: [],
        },
      ])
    ).toEqual({ emotion: "happy", intensity: 2 });
  });
});
