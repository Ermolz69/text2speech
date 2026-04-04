import { describe, expect, it } from "vitest";

const tailwindConfig = require("./tailwind.config.cjs");

describe("tailwind config", () => {
  it("targets the app source files and keeps an empty plugin list", () => {
    expect(tailwindConfig.content).toContain("./index.html");
    expect(tailwindConfig.content).toContain("./src/**/*.{ts,tsx}");
    expect(tailwindConfig.theme.extend).toEqual({});
    expect(tailwindConfig.plugins).toEqual([]);
  });
});
