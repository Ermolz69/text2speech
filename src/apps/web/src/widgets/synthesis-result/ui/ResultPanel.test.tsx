import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { ResultPanel } from "./ResultPanel";

describe("ResultPanel", () => {
  it("renders the waiting state without audio", () => {
    const html = renderToStaticMarkup(
      <ResultPanel
        requestState="idle"
        summary={{ emotion: "neutral", intensity: 0 }}
        outputFormat="mp3"
        generationMs={null}
        audioUrl={null}
      />
    );

    expect(html).toContain("Status:");
    expect(html).toContain("idle");
    expect(html).toContain("neutral");
    expect(html).toContain(">0<");
    expect(html).toContain("mp3");
    expect(html).toContain("Audio will appear here after a successful request.");
    expect(html).not.toContain("Download audio");
  });

  it("renders generated audio details when synthesis succeeds", () => {
    const html = renderToStaticMarkup(
      <ResultPanel
        requestState="success"
        summary={{ emotion: "happy", intensity: 2 }}
        outputFormat="wav"
        generationMs={842}
        audioUrl="/api/audio/sample.wav"
      />
    );

    expect(html).toContain("success");
    expect(html).toContain("happy");
    expect(html).toContain(">2<");
    expect(html).toContain("wav");
    expect(html).toContain("842 ms");
    expect(html).toContain("/api/audio/sample.wav");
    expect(html).toContain("Download audio");
    expect(html).toContain("audio");
  });
});
