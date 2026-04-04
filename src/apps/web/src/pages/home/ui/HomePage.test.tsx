import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { HomePage } from "./HomePage";

describe("HomePage", () => {
  it("renders the main synthesis workspace with default content", () => {
    const html = renderToStaticMarkup(<HomePage />);

    expect(html).toContain("Emotional TTS Playground");
    expect(html).toContain("Run synthesis");
    expect(html).toContain("Voice 1");
    expect(html).toContain("Voice 2");
    expect(html).toContain("idle");
    expect(html).toContain("Audio will appear here after a successful request.");
    expect(html).toContain("No segments to display yet.");
    expect(html).toContain("Hi");
  });

  it("shows diagnostics expanded by default", () => {
    const html = renderToStaticMarkup(<HomePage />);

    expect(html).toContain("Hide diagnostics");
    expect(html).not.toContain("Show diagnostics");
  });
});
