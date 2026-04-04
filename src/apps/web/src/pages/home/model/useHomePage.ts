import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { AnalyzeSegmentDto } from "shared";

import type { FormState, RequestState } from "@features/synthesis";
import { analyzeText, synthesizeText } from "@shared/api";

import { DEFAULT_TEXT, voiceOptions } from "./constants";
import { getSummaryState } from "./summary";

export function useHomePage() {
  const [formState, setFormState] = useState<FormState>({
    text: DEFAULT_TEXT,
    voiceId: voiceOptions[0].value,
    mode: "expressive",
    outputFormat: "mp3",
  });
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [segments, setSegments] = useState<AnalyzeSegmentDto[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [generationMs, setGenerationMs] = useState<number | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(true);

  const summary = useMemo(() => getSummaryState(segments), [segments]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (formState.text.trim().length === 0) {
      setRequestState("error");
      setErrorMessage("Enter text to synthesize.");
      return;
    }

    setRequestState("loading");
    setErrorMessage(null);
    setAudioUrl(null);
    setGenerationMs(null);

    const startedAt = performance.now();

    try {
      const analysis = await analyzeText({ text: formState.text });
      setSegments(analysis.segments);

      const synthesis = await synthesizeText({
        text: formState.text,
        voiceId: formState.voiceId,
        metadata: {
          format: formState.outputFormat,
          ...(formState.mode === "neutral"
            ? { emotion: "neutral" as const, intensity: 0 as const }
            : {}),
        },
      });

      setAudioUrl(synthesis.audioUrl);
      setGenerationMs(Math.round(performance.now() - startedAt));
      setRequestState("success");
    } catch (error) {
      setRequestState("error");
      setErrorMessage(
        error instanceof Error && error.message
          ? error.message
          : "Synthesis failed. Please try again."
      );
    }
  }

  function handleTextChange(text: string) {
    setFormState((prev) => ({ ...prev, text }));
  }

  function handleVoiceChange(voiceId: string) {
    setFormState((prev) => ({ ...prev, voiceId }));
  }

  function handleModeChange(mode: FormState["mode"]) {
    setFormState((prev) => ({ ...prev, mode }));
  }

  function handleFormatChange(outputFormat: FormState["outputFormat"]) {
    setFormState((prev) => ({ ...prev, outputFormat }));
  }

  function toggleDiagnostics() {
    setShowDiagnostics((prev) => !prev);
  }

  return {
    formState,
    requestState,
    errorMessage,
    segments,
    summary,
    audioUrl,
    generationMs,
    showDiagnostics,
    voiceOptions,
    handleSubmit,
    handleTextChange,
    handleVoiceChange,
    handleModeChange,
    handleFormatChange,
    toggleDiagnostics,
  };
}
