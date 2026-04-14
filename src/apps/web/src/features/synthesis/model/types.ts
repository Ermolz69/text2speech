import type { AnalyzeSegmentDto, EmotionIntensity, EmotionLabel } from "shared";

export type RequestState = "idle" | "loading" | "success" | "error";
export type LoadingStage = "analyzing" | "synthesizing" | null;
export type SynthesisMode = "neutral" | "expressive";
export type OutputFormat = "wav" | "mp3";

export interface FormState {
  text: string;
  voiceId: string;
  mode: SynthesisMode;
  outputFormat: OutputFormat;
}

export interface SummaryState {
  emotion: EmotionLabel;
  intensity: EmotionIntensity;
}

export interface ResultState {
  audioUrl: string | null;
  generationMs: number | null;
  segments: AnalyzeSegmentDto[];
}
