import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { DiagnosticsPanel } from "./DiagnosticsPanel";

describe("DiagnosticsPanel", () => {
  it("renders an empty diagnostics state when there are no segments", () => {
    const html = renderToStaticMarkup(
      <DiagnosticsPanel showDiagnostics={true} segments={[]} onToggle={vi.fn()} />
    );

    expect(html).toContain("Hide diagnostics");
    expect(html).toContain("No segments to display yet.");
  });

  it("renders segment metadata including emoji and punctuation", () => {
    const html = renderToStaticMarkup(
      <DiagnosticsPanel
        showDiagnostics={true}
        onToggle={vi.fn()}
        segments={[
          {
            text: "Hello! :)",
            emotion: "happy",
            intensity: 1,
            pauseAfterMs: 180,
            emoji: [":)"],
            punctuation: ["!"],
          },
        ]}
      />
    );

    expect(html).toContain("Hello! :)");
    expect(html).toContain("emotion: happy");
    expect(html).toContain("intensity: 1");
    expect(html).toContain("pause: 180ms");
    expect(html).toContain("emoji: :)");
    expect(html).toContain("punctuation: !");
  });

  it("hides the panel body when diagnostics are collapsed", () => {
    const html = renderToStaticMarkup(
      <DiagnosticsPanel
        showDiagnostics={false}
        onToggle={vi.fn()}
        segments={[
          {
            text: "Hidden",
            emotion: "neutral",
            intensity: 0,
            pauseAfterMs: 0,
            emoji: [],
            punctuation: [],
          },
        ]}
      />
    );

    expect(html).toContain("Show diagnostics");
    expect(html).not.toContain("Hide diagnostics");
    expect(html).not.toContain("Hidden");
  });
});
