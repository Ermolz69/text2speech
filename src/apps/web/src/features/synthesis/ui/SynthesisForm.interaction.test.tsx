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
    const onLengthScaleChange = vi.fn();
    const onNoiseScaleChange = vi.fn();
    const onIntensityBoostChange = vi.fn();

    render(
      <SynthesisForm
        formState={{
          text: "Hello",
          voiceId: "voice-1",
          mode: "expressive",
          outputFormat: "mp3",
          lengthScale: 1,
          noiseScale: 0.667,
          intensityBoost: 0,
        }}
        requestState="idle"
        loadingStage={null}
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
        onLengthScaleChange={onLengthScaleChange}
        onNoiseScaleChange={onNoiseScaleChange}
        onIntensityBoostChange={onIntensityBoostChange}
      />
    );

    fireEvent.change(screen.getByLabelText("Text"), {
      target: { value: "Updated text" },
    });
    fireEvent.change(screen.getByLabelText("Voice"), { target: { value: "voice-2" } });
    fireEvent.change(screen.getByLabelText("Format"), { target: { value: "wav" } });
    fireEvent.change(screen.getByLabelText("length_scale"), { target: { value: "1.2" } });
    fireEvent.change(screen.getByLabelText("noise_scale"), { target: { value: "0.9" } });
    fireEvent.click(screen.getByRole("button", { name: "Strong" }));
    fireEvent.change(screen.getByLabelText("Mode"), { target: { value: "neutral" } });
    fireEvent.submit(screen.getByRole("button", { name: "Run synthesis" }).closest("form")!);

    expect(onTextChange).toHaveBeenCalledWith("Updated text");
    expect(onVoiceChange).toHaveBeenCalledWith("voice-2");
    expect(onModeChange).toHaveBeenCalledWith("neutral");
    expect(onFormatChange).toHaveBeenCalledWith("wav");
    expect(onLengthScaleChange).toHaveBeenCalledWith(1.2);
    expect(onNoiseScaleChange).toHaveBeenCalledWith(0.9);
    expect(onIntensityBoostChange).toHaveBeenCalledWith(3);
    expect(onSubmit).toHaveBeenCalled();
  });
});
