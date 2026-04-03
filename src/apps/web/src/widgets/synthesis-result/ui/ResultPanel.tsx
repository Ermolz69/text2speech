import type { SummaryState } from "../../../features/synthesis";
import { uiClass } from "../../../shared/ui/styles";

interface ResultPanelProps {
  requestState: "idle" | "loading" | "success" | "error";
  summary: SummaryState;
  outputFormat: "wav" | "mp3";
  generationMs: number | null;
  audioUrl: string | null;
}

export function ResultPanel({
  requestState,
  summary,
  outputFormat,
  generationMs,
  audioUrl,
}: ResultPanelProps) {
  return (
    <section className={uiClass.card}>
      <h2 className="mb-4 text-xl font-semibold text-stone-800">Result</h2>

      <div className="mb-3 flex items-center gap-2 text-sm text-stone-700">
        <span className="font-semibold">Status:</span>
        <span>{requestState}</span>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
          <p className="text-xs uppercase tracking-wide text-stone-500">Emotion</p>
          <p className="mt-1 font-semibold text-stone-800">{summary.emotion}</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
          <p className="text-xs uppercase tracking-wide text-stone-500">Intensity</p>
          <p className="mt-1 font-semibold text-stone-800">{summary.intensity}</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
          <p className="text-xs uppercase tracking-wide text-stone-500">Format</p>
          <p className="mt-1 font-semibold text-stone-800">{outputFormat}</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
          <p className="text-xs uppercase tracking-wide text-stone-500">Generation time</p>
          <p className="mt-1 font-semibold text-stone-800">
            {generationMs !== null ? `${generationMs} ms` : "-"}
          </p>
        </div>
      </div>

      {audioUrl ? (
        <div className="space-y-3">
          <audio controls src={audioUrl} className="w-full" />
          <a className={`inline-flex ${uiClass.secondaryButton}`} href={audioUrl} download>
            Download audio
          </a>
        </div>
      ) : (
        <p className="text-sm text-stone-500">Audio will appear here after a successful request.</p>
      )}
    </section>
  );
}
