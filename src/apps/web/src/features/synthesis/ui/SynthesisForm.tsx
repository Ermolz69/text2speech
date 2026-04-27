import { useId, type FormEvent } from "react";

import type {
  FormState,
  LoadingStage,
  RequestState,
  SynthesisMode,
} from "@features/synthesis/model/types";
import { uiClass } from "@shared/ui/styles";

export interface VoiceOption {
  value: string;
  label: string;
}

interface SynthesisFormProps {
  formState: FormState;
  requestState: RequestState;
  loadingStage: LoadingStage;
  errorMessage: string | null;
  voiceOptions: VoiceOption[];
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTextChange: (text: string) => void;
  onVoiceChange: (voiceId: string) => void;
  onModeChange: (mode: SynthesisMode) => void;
  onFormatChange: (format: FormState["outputFormat"]) => void;
}

const stageLabel: Record<NonNullable<LoadingStage>, string> = {
  analyzing: "Analysing text…",
  synthesizing: "Synthesising speech…",
};

export function SynthesisForm({
  formState,
  requestState,
  loadingStage,
  errorMessage,
  voiceOptions,
  onSubmit,
  onTextChange,
  onVoiceChange,
  onModeChange,
  onFormatChange,
}: SynthesisFormProps) {
  const isLoading = requestState === "loading";
  const textId = useId();
  const voiceId = useId();
  const modeId = useId();
  const formatId = useId();
  const loadingStatusId = useId();
  const errorMessageId = useId();
  const textHintId = useId();
  const loadingAnnouncement = isLoading
    ? loadingStage
      ? stageLabel[loadingStage]
      : "Generating…"
    : "Idle";

  return (
    <form
      className={uiClass.card}
      onSubmit={onSubmit}
      aria-busy={isLoading}
      aria-describedby={`${loadingStatusId}${errorMessage ? ` ${errorMessageId}` : ""}`}
    >
      <h2 className="mb-4 text-xl font-semibold text-stone-800">Synthesis</h2>

      <p
        id={loadingStatusId}
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {`Synthesis status: ${loadingAnnouncement}`}
      </p>

      <div className="mb-4 block">
        <label htmlFor={textId} className="mb-2 block text-sm text-stone-600">
          Text
        </label>
        <p id={textHintId} className="mb-2 text-xs text-stone-500">
          Enter the sentence you want to convert to speech.
        </p>
        <textarea
          id={textId}
          className={`min-h-36 resize-y transition-opacity ${uiClass.input} ${isLoading ? "cursor-not-allowed opacity-50" : ""}`}
          value={formState.text}
          onChange={(event) => onTextChange(event.target.value)}
          placeholder="Paste text to synthesize"
          disabled={isLoading}
          aria-disabled={isLoading}
          aria-describedby={textHintId}
          required
        />
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <div className="block">
          <label htmlFor={voiceId} className="mb-2 block text-sm text-stone-600">
            Voice
          </label>
          <select
            id={voiceId}
            className={uiClass.input}
            value={formState.voiceId}
            onChange={(event) => onVoiceChange(event.target.value)}
            disabled={isLoading}
          >
            {voiceOptions.map((voice) => (
              <option key={voice.value} value={voice.value}>
                {voice.label}
              </option>
            ))}
          </select>
        </div>

        <div className="block">
          <label htmlFor={modeId} className="mb-2 block text-sm text-stone-600">
            Mode
          </label>
          <select
            id={modeId}
            className={uiClass.input}
            value={formState.mode}
            onChange={(event) => onModeChange(event.target.value as SynthesisMode)}
            disabled={isLoading}
          >
            <option value="neutral">neutral</option>
            <option value="expressive">expressive</option>
          </select>
        </div>

        <div className="block">
          <label htmlFor={formatId} className="mb-2 block text-sm text-stone-600">
            Format
          </label>
          <select
            id={formatId}
            className={uiClass.input}
            value={formState.outputFormat}
            onChange={(event) => onFormatChange(event.target.value as FormState["outputFormat"])}
            disabled={isLoading}
          >
            <option value="mp3">mp3</option>
            <option value="wav">wav</option>
          </select>
        </div>
      </div>

      <button
        type="submit"
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 font-medium text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isLoading}
        aria-busy={isLoading}
        aria-describedby={loadingStatusId}
      >
        {isLoading ? (
          <>
            <Spinner />
            {loadingAnnouncement}
          </>
        ) : (
          "Run synthesis"
        )}
      </button>

      {/* Progress steps — only visible during loading */}
      {isLoading && (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <ProgressStep
            label="Analysing text"
            done={loadingStage === "synthesizing"}
            active={loadingStage === "analyzing"}
          />
          <StepDivider />
          <ProgressStep
            label="Synthesising speech"
            done={false}
            active={loadingStage === "synthesizing"}
          />
        </div>
      )}

      {/* Error message */}
      {errorMessage ? (
        <p
          id={errorMessageId}
          role="alert"
          aria-live="assertive"
          className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          <ErrorIcon />
          {errorMessage}
        </p>
      ) : null}
    </form>
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg
      className="mt-0.5 h-4 w-4 shrink-0"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function ProgressStep({ label, done, active }: { label: string; done: boolean; active: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`flex h-4 w-4 items-center justify-center rounded-full text-xs transition-all ${
          done
            ? "bg-emerald-600 text-white"
            : active
              ? "border-2 border-emerald-600 bg-white"
              : "border border-stone-300 bg-white"
        }`}
        aria-hidden="true"
      >
        {done ? (
          <svg
            className="h-2.5 w-2.5"
            viewBox="0 0 10 10"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <polyline points="1.5,5 4,7.5 8.5,2.5" />
          </svg>
        ) : active ? (
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-600" />
        ) : null}
      </span>
      <span
        className={`text-xs font-medium ${
          done ? "text-emerald-700" : active ? "text-emerald-700" : "text-stone-400"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

function StepDivider() {
  return <div className="h-px flex-1 bg-stone-200" aria-hidden="true" />;
}
