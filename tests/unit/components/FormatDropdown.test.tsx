import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FormatDropdown from "../../../src/components/FormatDropdown";
import { getOutputFormats } from "../../../src/converters/formats";

describe("FormatDropdown", () => {
  it("renders one option per output-capable format in the category", () => {
    render(<FormatDropdown category="image" value="png" onChange={() => {}} />);
    expect(screen.getAllByRole("option")).toHaveLength(getOutputFormats("image").length);
  });

  it("only lists output-capable formats (e.g. excludes SVG for images)", () => {
    render(<FormatDropdown category="image" value="png" onChange={() => {}} />);
    expect(screen.queryByRole("option", { name: "SVG" })).not.toBeInTheDocument();
  });

  it("selects the current value", () => {
    render(<FormatDropdown category="audio" value="flac" onChange={() => {}} />);
    expect(screen.getByRole("combobox")).toHaveValue("flac");
  });

  it("calls onChange with the newly selected format", () => {
    const onChange = vi.fn();
    render(<FormatDropdown category="video" value="mp4" onChange={onChange} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "webm" } });
    expect(onChange).toHaveBeenCalledWith("webm");
  });

  it("disables the select when disabled is true", () => {
    render(<FormatDropdown category="document" value="docx" onChange={() => {}} disabled />);
    expect(screen.getByRole("combobox")).toBeDisabled();
  });

  it("is enabled by default", () => {
    render(<FormatDropdown category="document" value="docx" onChange={() => {}} />);
    expect(screen.getByRole("combobox")).toBeEnabled();
  });
});
