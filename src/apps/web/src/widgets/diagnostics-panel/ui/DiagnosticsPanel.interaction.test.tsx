/** @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DiagnosticsPanel } from "./DiagnosticsPanel";

describe("DiagnosticsPanel interactions", () => {
  it("calls onToggle when the diagnostics button is clicked", () => {
    const onToggle = vi.fn();

    render(<DiagnosticsPanel showDiagnostics={true} segments={[]} onToggle={onToggle} />);

    fireEvent.click(screen.getByRole("button", { name: "Hide diagnostics" }));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
