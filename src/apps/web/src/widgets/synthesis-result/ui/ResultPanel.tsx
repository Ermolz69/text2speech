import type { SummaryState } from "@features/synthesis";
import { uiClass } from "@shared/ui/styles";

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
    <section className={uiClass.card} aria-live="polite" aria-label="Synthesis result">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-stone-800">Result</h2>
        <StatusBadge requestState={requestState} />
      </div>

      {requestState === "loading" && <LoadingSkeleton />}

      {requestState === "error" && <ErrorState />}

      {(requestState === "idle" || requestState === "success") && (
        <>
          <div className="mb-4 grid gap-2 sm:grid-cols-2">
            <MetaCard label="Emotion" value={summary.emotion} />
            <MetaCard label="Intensity" value={String(summary.intensity)} />
            <MetaCard label="Format" value={outputFormat} />
            <MetaCard
              label="Generation time"
              value={generationMs !== null ? `${generationMs} ms` : "—"}
            />
          </div>

          {audioUrl ? (
            <div className="space-y-3">
              <audio
                controls
                src={audioUrl}
                className="w-full"
                aria-label="Synthesised audio output"
              />
              <a className={`inline-flex ${uiClass.secondaryButton}`} href={audioUrl} download>
                Download audio
              </a>
            </div>
          ) : (
            <p className="text-sm text-stone-500">
              Audio will appear here after a successful request.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function StatusBadge({ requestState }: { requestState: ResultPanelProps["requestState"] }) {
  const config = {
    idle: { label: "idle", className: "border-stone-200 bg-stone-100 text-stone-500" },
    loading: {
      label: "generating",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
    success: { label: "done", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
    error: { label: "error", className: "border-red-200 bg-red-50 text-red-600" },
  }[requestState];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.className}`}
    >
      {requestState === "loading" && (
        <span
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"
          aria-hidden="true"
        />
      )}
      {requestState === "success" && (
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
      )}
      {requestState === "error" && (
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden="true" />
      )}
      {config.label}
    </span>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
      <p className="text-xs uppercase tracking-wide text-stone-500">{label}</p>
      <p className="mt-1 font-semibold text-stone-800">{value}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div aria-label="Loading result" className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-stone-100" />
        ))}
      </div>
      <div className="h-12 animate-pulse rounded-xl bg-stone-100" />
    </div>
  );
}

function ErrorState() {
  return (
    <div className="rounded-xl border border-red-100 bg-red-50 p-4">
      <div className="flex items-start gap-3">
        <svg
          className="mt-0.5 h-5 w-5 shrink-0 text-red-500"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
        <div>
          <p className="font-medium text-red-700">Synthesis failed</p>
          <p className="mt-1 text-sm text-red-600">
            See the error message in the form on the left for details.
          </p>
        </div>
      </div>
    </div>
  );
}
