import type { AnalyzeSegmentDto } from "shared";
import { uiClass } from "../../../shared/ui/styles";

interface DiagnosticsPanelProps {
  showDiagnostics: boolean;
  segments: AnalyzeSegmentDto[];
  onToggle: () => void;
}

export function DiagnosticsPanel({ showDiagnostics, segments, onToggle }: DiagnosticsPanelProps) {
  return (
    <section className={uiClass.card}>
      <button type="button" className={uiClass.secondaryButton} onClick={onToggle}>
        {showDiagnostics ? "Hide diagnostics" : "Show diagnostics"}
      </button>

      {showDiagnostics ? (
        segments.length > 0 ? (
          <ul className="mt-4 grid gap-3">
            {segments.map((segment, index) => (
              <li
                key={`${segment.text}-${index}`}
                className="rounded-xl border border-stone-200 bg-stone-50 p-3"
              >
                <p className="mb-2 font-semibold text-stone-800">{segment.text}</p>
                <div className="flex flex-wrap gap-3 text-sm text-stone-600">
                  <span>emotion: {segment.emotion}</span>
                  <span>intensity: {segment.intensity}</span>
                  <span>pause: {segment.pauseAfterMs ?? 0}ms</span>
                </div>

                {(segment.emoji?.length || segment.punctuation?.length) && (
                  <div className="mt-2 flex flex-wrap gap-3 text-sm text-stone-600">
                    {segment.emoji?.length ? <span>emoji: {segment.emoji.join(" ")}</span> : null}
                    {segment.punctuation?.length ? (
                      <span>punctuation: {segment.punctuation.join(" ")}</span>
                    ) : null}
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-stone-500">No segments to display yet.</p>
        )
      ) : null}
    </section>
  );
}
