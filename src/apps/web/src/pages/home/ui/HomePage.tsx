import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { AnalyzeSegmentDto, EmotionIntensity, EmotionLabel } from "shared";

import {
  SynthesisForm,
  type VoiceOption,
  type FormState,
  type RequestState,
  type SummaryState,
} from "../../../features/synthesis";
import { analyzeText, synthesizeText } from "../../../shared/api";
import { uiClass } from "../../../shared/ui/styles";
import { ResultPanel } from "../../../widgets/synthesis-result";
import { DiagnosticsPanel } from "../../../widgets/diagnostics-panel";

const DEFAULT_TEXT = "Hi 😊 Today feels like a great day!!!";

const voiceOptions: VoiceOption[] = [
  { value: "voice-1", label: "Voice 1" },
  { value: "voice-2", label: "Voice 2" },
];

function inferSummaryEmotion(segments: AnalyzeSegmentDto[]): EmotionLabel {
  if (segments.length === 0) {
    return "neutral";
  }

  const scoreByEmotion = new Map<EmotionLabel, number>();

  for (const segment of segments) {
    const currentScore = scoreByEmotion.get(segment.emotion) ?? 0;
    scoreByEmotion.set(segment.emotion, currentScore + 1 + segment.intensity * 0.25);
  }

  let bestEmotion: EmotionLabel = "neutral";
  let bestScore = -1;

  for (const [emotion, score] of scoreByEmotion.entries()) {
    if (score > bestScore) {
      bestEmotion = emotion;
      bestScore = score;
    }
  }

  return bestEmotion;
}

function inferSummaryIntensity(segments: AnalyzeSegmentDto[]): EmotionIntensity {
  if (segments.length === 0) {
    return 0;
  }

  const avgIntensity =
    segments.reduce((sum, segment) => sum + segment.intensity, 0) / segments.length;

  if (avgIntensity < 0.5) return 0;
  if (avgIntensity < 1.5) return 1;
  if (avgIntensity < 2.5) return 2;

  return 3;
}

export function HomePage() {
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

  const summary = useMemo<SummaryState>(() => {
    if (segments.length === 0) {
      return { emotion: "neutral", intensity: 0 };
    }

    return {
      emotion: inferSummaryEmotion(segments),
      intensity: inferSummaryIntensity(segments),
    };
  }, [segments]);

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

  return (
    <main className="relative mx-auto min-h-screen w-full max-w-6xl px-4 pb-10 pt-6">
      <div className="pointer-events-none absolute -left-16 top-8 h-44 w-44 rounded-full bg-emerald-300/35 blur-sm" />
      <div className="pointer-events-none absolute -right-20 top-24 h-56 w-56 rounded-full bg-orange-300/35 blur-sm" />

      <section
        className={`relative z-10 mb-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between ${uiClass.card}`}
      >
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-800 md:text-4xl">
            Emotional TTS Playground
          </h1>
          <p className="mt-2 max-w-2xl text-stone-600">
            Enter text, choose a voice and mode, then generate speech with an emotional segment
            preview.
          </p>
        </div>
      </section>

      <section className="relative z-10 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <SynthesisForm
          formState={formState}
          requestState={requestState}
          errorMessage={errorMessage}
          voiceOptions={voiceOptions}
          onSubmit={handleSubmit}
          onTextChange={(text) => setFormState((prev) => ({ ...prev, text }))}
          onVoiceChange={(voiceId) => setFormState((prev) => ({ ...prev, voiceId }))}
          onModeChange={(mode) => setFormState((prev) => ({ ...prev, mode }))}
          onFormatChange={(outputFormat) => setFormState((prev) => ({ ...prev, outputFormat }))}
        />

        <ResultPanel
          requestState={requestState}
          summary={summary}
          outputFormat={formState.outputFormat}
          generationMs={generationMs}
          audioUrl={audioUrl}
        />
      </section>

      <section className="relative z-10 mt-4">
        <DiagnosticsPanel
          showDiagnostics={showDiagnostics}
          segments={segments}
          onToggle={() => setShowDiagnostics((prev) => !prev)}
        />
      </section>
    </main>
  );
}
