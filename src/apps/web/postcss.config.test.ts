import { describe, expect, it } from "vitest";

const postcssConfig = require("./postcss.config.cjs");

describe("postcss config", () => {
  it("enables tailwindcss and autoprefixer plugins", () => {
    expect(postcssConfig.plugins.tailwindcss).toEqual({});
    expect(postcssConfig.plugins.autoprefixer).toEqual({});
  });
});
