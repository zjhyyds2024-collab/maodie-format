import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import ProgressBar from "../../../src/components/ProgressBar";

function getFill(container: HTMLElement): HTMLElement {
  return (container.firstChild as HTMLElement).firstChild as HTMLElement;
}

describe("ProgressBar", () => {
  it("renders width proportional to value", () => {
    const { container } = render(<ProgressBar value={42} />);
    expect(getFill(container).style.width).toBe("42%");
  });

  it("clamps values above 100 to 100%", () => {
    const { container } = render(<ProgressBar value={150} />);
    expect(getFill(container).style.width).toBe("100%");
  });

  it("clamps negative values to 0%", () => {
    const { container } = render(<ProgressBar value={-20} />);
    expect(getFill(container).style.width).toBe("0%");
  });

  it("uses the default variant color by default", () => {
    const { container } = render(<ProgressBar value={50} />);
    expect(getFill(container).className).toContain("bg-brand-500");
  });

  it("applies the success variant color", () => {
    const { container } = render(<ProgressBar value={50} variant="success" />);
    expect(getFill(container).className).toContain("bg-green-500");
  });

  it("applies the error variant color", () => {
    const { container } = render(<ProgressBar value={50} variant="error" />);
    expect(getFill(container).className).toContain("bg-red-500");
  });

  it("merges a custom className onto the track", () => {
    const { container } = render(<ProgressBar value={10} className="my-track" />);
    expect(container.firstChild).toHaveClass("my-track");
  });
});
