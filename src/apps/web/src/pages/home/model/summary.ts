import type { AnalyzeSegmentDto, EmotionIntensity, EmotionLabel } from "shared";

import type { SummaryState } from "@features/synthesis";

export function inferSummaryEmotion(segments: AnalyzeSegmentDto[]): EmotionLabel {
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

export function inferSummaryIntensity(segments: AnalyzeSegmentDto[]): EmotionIntensity {
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

export function getSummaryState(segments: AnalyzeSegmentDto[]): SummaryState {
  if (segments.length === 0) {
    return { emotion: "neutral", intensity: 0 };
  }

  return {
    emotion: inferSummaryEmotion(segments),
    intensity: inferSummaryIntensity(segments),
  };
}
