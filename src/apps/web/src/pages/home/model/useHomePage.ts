import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { AnalyzeSegmentDto } from "shared";

import type { FormState, LoadingStage, RequestState } from "@features/synthesis";
import { analyzeText, getTtsVoices, synthesizeText } from "@shared/api";

import { DEFAULT_TEXT, defaultVoiceOptions } from "./constants";
import { getSummaryState } from "./summary";

export function useHomePage() {
  const [voiceOptions, setVoiceOptions] = useState(defaultVoiceOptions);
  const [formState, setFormState] = useState<FormState>({
    text: DEFAULT_TEXT,
    voiceId: defaultVoiceOptions[0].value,
    mode: "expressive",
    outputFormat: "mp3",
    lengthScale: 1,
    noiseScale: 0.667,
    intensityBoost: 0,
  });
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const [loadingStage, setLoadingStage] = useState<LoadingStage>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [segments, setSegments] = useState<AnalyzeSegmentDto[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [generationMs, setGenerationMs] = useState<number | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(true);

  const summary = useMemo(() => getSummaryState(segments), [segments]);

  useEffect(() => {
    let isMounted = true;

    async function loadVoices() {
      try {
        const response = await getTtsVoices();
        if (!isMounted || response.voices.length === 0) {
          return;
        }

        const options = response.voices.map((voice) => ({
          value: voice.id,
          label: voice.label,
        }));

        setVoiceOptions(options);
        setFormState((prev) => {
          const hasSelectedVoice = options.some((option) => option.value === prev.voiceId);
          return hasSelectedVoice ? prev : { ...prev, voiceId: options[0].value };
        });
      } catch {
        // Keep fallback voices when catalog loading fails.
      }
    }

    void loadVoices();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (formState.text.trim().length === 0) {
      setRequestState("error");
      setErrorMessage("Enter text to synthesize.");
      return;
    }

    setRequestState("loading");
    setLoadingStage("analyzing");
    setErrorMessage(null);
    setAudioUrl(null);
    setGenerationMs(null);

    const startedAt = performance.now();

    try {
      const analysis = await analyzeText({ text: formState.text });
      setSegments(analysis.segments);

      setLoadingStage("synthesizing");

      const synthesis = await synthesizeText({
        text: formState.text,
        voiceId: formState.voiceId,
        metadata: {
          format: formState.outputFormat,
          lengthScale: formState.lengthScale,
          noiseScale: formState.noiseScale,
          ...(formState.mode === "neutral"
            ? { emotion: "neutral" as const, intensity: 0 as const }
            : formState.intensityBoost > 0
              ? { intensityBoost: formState.intensityBoost }
              : {}),
        },
      });

      setAudioUrl(synthesis.audioUrl);
      setGenerationMs(Math.round(performance.now() - startedAt));
      setRequestState("success");
      setLoadingStage(null);
    } catch (error) {
      setRequestState("error");
      setLoadingStage(null);
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

  function handleLengthScaleChange(lengthScale: number) {
    setFormState((prev) => ({ ...prev, lengthScale }));
  }

  function handleNoiseScaleChange(noiseScale: number) {
    setFormState((prev) => ({ ...prev, noiseScale }));
  }

  function handleIntensityBoostChange(intensityBoost: FormState["intensityBoost"]) {
    setFormState((prev) => ({ ...prev, intensityBoost }));
  }

  function toggleDiagnostics() {
    setShowDiagnostics((prev) => !prev);
  }

  return {
    formState,
    requestState,
    loadingStage,
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
    handleLengthScaleChange,
    handleNoiseScaleChange,
    handleIntensityBoostChange,
    toggleDiagnostics,
  };
}
