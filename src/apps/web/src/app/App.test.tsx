import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { App } from "./App";

describe("App", () => {
  it("renders the home page shell", () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain("Emotional TTS Playground");
    expect(html).toContain("Run synthesis");
  });
});
