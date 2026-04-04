import { describe, expect, it } from "vitest";

import { HomePage as ExportedHomePage } from "./index";
import { HomePage as DirectHomePage } from "./ui/HomePage";

describe("home page barrel export", () => {
  it("re-exports HomePage from the ui module", () => {
    expect(ExportedHomePage).toBe(DirectHomePage);
  });
});
