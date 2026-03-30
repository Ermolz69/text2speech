export type EmotionLabel =
  | "neutral"
  | "joy"
  | "playful"
  | "sadness"
  | "anger"
  | "fear"
  | "surprise";

export type EmotionIntensity = 0 | 1 | 2 | 3;

export interface AnalyzeRequestDto {
  text: string;
}

export interface AnalyzeSegmentDto {
  text: string;
  emotion: EmotionLabel;
  intensity: EmotionIntensity;
  emoji?: string[];
  punctuation?: string[];
  pauseAfterMs?: number;
  rate?: number;
  pitchHint?: number;
}

export interface AnalyzeResponseDto {
  segments: AnalyzeSegmentDto[];
}

export interface SynthesisMetadataDto {
  segments?: AnalyzeSegmentDto[];
  emotion?: EmotionLabel;
  intensity?: EmotionIntensity;
  format?: "wav" | "mp3" | "ogg";
}

export interface SynthesizeRequestDto {
  text: string;
  voiceId: string;
  metadata?: SynthesisMetadataDto;
}

export interface SynthesizeResponseDto {
  audioUrl: string;
  metadata?: SynthesisMetadataDto;
  metricsUrl?: string;
}
