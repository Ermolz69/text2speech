import type { FormEvent } from "react";

import type { FormState, RequestState, SynthesisMode } from "../model/types";
import { uiClass } from "../../../shared/ui/styles";

export interface VoiceOption {
  value: string;
  label: string;
}

interface SynthesisFormProps {
  formState: FormState;
  requestState: RequestState;
  errorMessage: string | null;
  voiceOptions: VoiceOption[];
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTextChange: (text: string) => void;
  onVoiceChange: (voiceId: string) => void;
  onModeChange: (mode: SynthesisMode) => void;
  onFormatChange: (format: FormState["outputFormat"]) => void;
}

export function SynthesisForm({
  formState,
  requestState,
  errorMessage,
  voiceOptions,
  onSubmit,
  onTextChange,
  onVoiceChange,
  onModeChange,
  onFormatChange,
}: SynthesisFormProps) {
  return (
    <form className={uiClass.card} onSubmit={onSubmit}>
      <h2 className="mb-4 text-xl font-semibold text-stone-800">Synthesis</h2>

      <label className="mb-4 block">
        <span className="mb-2 block text-sm text-stone-600">Text</span>
        <textarea
          className={`min-h-36 resize-y ${uiClass.input}`}
          value={formState.text}
          onChange={(event) => onTextChange(event.target.value)}
          placeholder="Paste text to synthesize"
        />
      </label>

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <label className="block">
          <span className="mb-2 block text-sm text-stone-600">Voice</span>
          <select
            className={uiClass.input}
            value={formState.voiceId}
            onChange={(event) => onVoiceChange(event.target.value)}
          >
            {voiceOptions.map((voice) => (
              <option key={voice.value} value={voice.value}>
                {voice.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm text-stone-600">Mode</span>
          <select
            className={uiClass.input}
            value={formState.mode}
            onChange={(event) => onModeChange(event.target.value as SynthesisMode)}
          >
            <option value="neutral">neutral</option>
            <option value="expressive">expressive</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm text-stone-600">Format</span>
          <select
            className={uiClass.input}
            value={formState.outputFormat}
            onChange={(event) => onFormatChange(event.target.value as FormState["outputFormat"])}
          >
            <option value="mp3">mp3</option>
            <option value="wav">wav</option>
          </select>
        </label>
      </div>

      <button
        type="submit"
        className="w-full rounded-xl bg-emerald-700 px-4 py-2 font-medium text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={requestState === "loading"}
      >
        {requestState === "loading" ? "Generating..." : "Run synthesis"}
      </button>

      {errorMessage ? (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}
    </form>
  );
}
