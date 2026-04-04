/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { analyzeTextMock, synthesizeTextMock } = vi.hoisted(() => ({
  analyzeTextMock: vi.fn(),
  synthesizeTextMock: vi.fn(),
}));

vi.mock("@shared/api", () => ({
  analyzeText: analyzeTextMock,
  synthesizeText: synthesizeTextMock,
}));

import { HomePage } from "./HomePage";

describe("HomePage interactions", () => {
  beforeEach(() => {
    analyzeTextMock.mockReset();
    synthesizeTextMock.mockReset();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("handles an empty submission locally without calling the API", async () => {
    render(<HomePage />);

    fireEvent.change(screen.getByPlaceholderText("Paste text to synthesize"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Run synthesis" }));

    expect(await screen.findByText("Enter text to synthesize.")).toBeTruthy();
    expect(analyzeTextMock).not.toHaveBeenCalled();
    expect(synthesizeTextMock).not.toHaveBeenCalled();
    expect(screen.getByText("error")).toBeTruthy();
  });

  it("submits successfully and renders synthesis results", async () => {
    analyzeTextMock.mockResolvedValue({
      segments: [
        {
          text: "Hello! :)",
          emotion: "happy",
          intensity: 2,
          pauseAfterMs: 180,
          emoji: [":)"],
          punctuation: ["!"],
        },
      ],
    });
    synthesizeTextMock.mockResolvedValue({
      audioUrl: "/audio/generated.wav",
    });

    render(<HomePage />);

    fireEvent.change(screen.getByPlaceholderText("Paste text to synthesize"), {
      target: { value: "Hello! :)" },
    });
    fireEvent.change(screen.getByDisplayValue("expressive"), { target: { value: "neutral" } });
    fireEvent.change(screen.getByDisplayValue("Voice 1"), { target: { value: "voice-2" } });
    fireEvent.change(screen.getByDisplayValue("mp3"), { target: { value: "wav" } });
    fireEvent.click(screen.getByRole("button", { name: "Hide diagnostics" }));
    fireEvent.click(screen.getByRole("button", { name: "Run synthesis" }));

    await waitFor(() => {
      expect(analyzeTextMock).toHaveBeenCalledWith({ text: "Hello! :)" });
    });

    expect(synthesizeTextMock).toHaveBeenCalledWith({
      text: "Hello! :)",
      voiceId: "voice-2",
      metadata: {
        format: "wav",
        emotion: "neutral",
        intensity: 0,
      },
    });

    expect(await screen.findByText("success")).toBeTruthy();
    expect(screen.getAllByText("happy").length).toBeGreaterThan(0);
    expect(screen.getByText((content) => /\d+ ms/.test(content))).toBeTruthy();
    expect(screen.getByRole("link", { name: "Download audio" }).getAttribute("href")).toBe(
      "/audio/generated.wav"
    );
    expect(screen.getByText("Show diagnostics")).toBeTruthy();
  });

  it("sends expressive synthesis metadata without forcing neutral emotion", async () => {
    analyzeTextMock.mockResolvedValue({
      segments: [
        {
          text: "Hello again!",
          emotion: "happy",
          intensity: 1,
          pauseAfterMs: 120,
          emoji: [],
          punctuation: ["!"],
        },
      ],
    });
    synthesizeTextMock.mockResolvedValue({
      audioUrl: "/audio/expressive.wav",
    });

    render(<HomePage />);

    fireEvent.change(screen.getByPlaceholderText("Paste text to synthesize"), {
      target: { value: "Hello again!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Run synthesis" }));

    await waitFor(() => {
      expect(synthesizeTextMock).toHaveBeenCalledWith({
        text: "Hello again!",
        voiceId: "voice-1",
        metadata: {
          format: "mp3",
        },
      });
    });
  });

  it("surfaces upstream errors from synthesis", async () => {
    analyzeTextMock.mockResolvedValue({
      segments: [
        {
          text: "Hello",
          emotion: "neutral",
          intensity: 0,
          pauseAfterMs: 0,
          emoji: [],
          punctuation: [],
        },
      ],
    });
    synthesizeTextMock.mockRejectedValue(new Error("Gateway request failed with status 502"));

    render(<HomePage />);

    fireEvent.change(screen.getByPlaceholderText("Paste text to synthesize"), {
      target: { value: "Hello" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Run synthesis" }));

    expect(await screen.findByText("Gateway request failed with status 502")).toBeTruthy();
    expect(screen.getByText("error")).toBeTruthy();
  });

  it("falls back to a generic error message for unknown failures", async () => {
    analyzeTextMock.mockRejectedValue("unexpected");

    render(<HomePage />);

    fireEvent.change(screen.getByPlaceholderText("Paste text to synthesize"), {
      target: { value: "Hello" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Run synthesis" }));

    expect(await screen.findByText("Synthesis failed. Please try again.")).toBeTruthy();
    expect(screen.getByText("error")).toBeTruthy();
  });
});
