import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { SynthesisForm } from "./SynthesisForm";

describe("SynthesisForm", () => {
  const baseProps = {
    formState: {
      text: "Hello there",
      voiceId: "voice-1",
      mode: "expressive" as const,
      outputFormat: "wav" as const,
    },
    requestState: "idle" as const,
    loadingStage: null,
    errorMessage: null,
    voiceOptions: [
      { value: "voice-1", label: "Voice 1" },
      { value: "voice-2", label: "Voice 2" },
    ],
    onSubmit: vi.fn(),
    onTextChange: vi.fn(),
    onVoiceChange: vi.fn(),
    onModeChange: vi.fn(),
    onFormatChange: vi.fn(),
  };

  it("renders form controls with the provided values", () => {
    const html = renderToStaticMarkup(<SynthesisForm {...baseProps} />);

    expect(html).toContain("Synthesis");
    expect(html).toContain("Hello there");
    expect(html).toContain("Voice 1");
    expect(html).toContain("Voice 2");
    expect(html).toContain("neutral");
    expect(html).toContain("expressive");
    expect(html).toContain("wav");
    expect(html).toContain("mp3");
    expect(html).toContain("Run synthesis");
    expect(html).not.toContain("Generating...");
  });

  it("renders loading and error states", () => {
    const html = renderToStaticMarkup(
      <SynthesisForm
        {...baseProps}
        requestState="loading"
        errorMessage="Gateway request failed with status 502"
      />
    );

    expect(html).toContain("Generating...");
    expect(html).toContain("disabled");
    expect(html).toContain("Gateway request failed with status 502");
  });
});
