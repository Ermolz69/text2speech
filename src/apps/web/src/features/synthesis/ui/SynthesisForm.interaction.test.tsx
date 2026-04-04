/** @vitest-environment jsdom */

import type { FormEvent } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SynthesisForm } from "./SynthesisForm";

describe("SynthesisForm interactions", () => {
  it("calls all field change handlers and submit", () => {
    const onSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => event.preventDefault());
    const onTextChange = vi.fn();
    const onVoiceChange = vi.fn();
    const onModeChange = vi.fn();
    const onFormatChange = vi.fn();

    render(
      <SynthesisForm
        formState={{
          text: "Hello",
          voiceId: "voice-1",
          mode: "expressive",
          outputFormat: "mp3",
        }}
        requestState="idle"
        errorMessage={null}
        voiceOptions={[
          { value: "voice-1", label: "Voice 1" },
          { value: "voice-2", label: "Voice 2" },
        ]}
        onSubmit={onSubmit}
        onTextChange={onTextChange}
        onVoiceChange={onVoiceChange}
        onModeChange={onModeChange}
        onFormatChange={onFormatChange}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Paste text to synthesize"), {
      target: { value: "Updated text" },
    });
    fireEvent.change(screen.getByDisplayValue("Voice 1"), { target: { value: "voice-2" } });
    fireEvent.change(screen.getByDisplayValue("expressive"), { target: { value: "neutral" } });
    fireEvent.change(screen.getByDisplayValue("mp3"), { target: { value: "wav" } });
    fireEvent.submit(screen.getByRole("button", { name: "Run synthesis" }).closest("form")!);

    expect(onTextChange).toHaveBeenCalledWith("Updated text");
    expect(onVoiceChange).toHaveBeenCalledWith("voice-2");
    expect(onModeChange).toHaveBeenCalledWith("neutral");
    expect(onFormatChange).toHaveBeenCalledWith("wav");
    expect(onSubmit).toHaveBeenCalled();
  });
});
