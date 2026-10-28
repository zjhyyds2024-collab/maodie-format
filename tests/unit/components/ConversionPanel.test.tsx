import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import ConversionPanel from "../../../src/components/ConversionPanel";
import { useAppStore } from "../../../src/store";
import type { ConvertFile } from "../../../src/converters/types";
import "../../../src/i18n";

let nextId = 0;
function makeFile(overrides: Partial<ConvertFile> = {}): ConvertFile {
  nextId += 1;
  return {
    id: `file-${nextId}`,
    filePath: "/a.png",
    name: "a.png",
    sizeBytes: 100,
    extension: "png",
    category: "image",
    targetFormat: "webp",
    status: "idle",
    progress: 0,
    ...overrides,
  };
}

describe("ConversionPanel", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
    useAppStore.setState({ files: [], toasts: [] });
  });

  it("disables Convert All when there are no idle files", () => {
    useAppStore.setState({ files: [makeFile({ status: "done" })] });
    render(<ConversionPanel />);
    expect(screen.getByText("Convert All").closest("button")).toBeDisabled();
  });

  it("enables Convert All when idle files are present", () => {
    useAppStore.setState({ files: [makeFile()] });
    render(<ConversionPanel />);
    expect(screen.getByText("Convert All").closest("button")).toBeEnabled();
  });

  it("hides Download All when no file is done", () => {
    useAppStore.setState({ files: [makeFile()] });
    render(<ConversionPanel />);
    expect(screen.queryByText("Download All")).not.toBeInTheDocument();
  });

  it("shows Download All once a file is done", () => {
    useAppStore.setState({ files: [makeFile({ status: "done" })] });
    render(<ConversionPanel />);
    expect(screen.getByText("Download All")).toBeInTheDocument();
  });

  it("converts all idle files and marks them done on success", async () => {
    useAppStore.setState({ files: [makeFile()] });
    vi.mocked(invoke).mockResolvedValue({ output_path: "/tmp/out.webp", size_bytes: 10 });

    render(<ConversionPanel />);
    fireEvent.click(screen.getByText("Convert All"));

    await waitFor(() => expect(useAppStore.getState().files[0].status).toBe("done"));
    expect(useAppStore.getState().files[0].outputPath).toBe("/tmp/out.webp");
  });

  it("marks a file as errored and shows a toast when conversion fails", async () => {
    useAppStore.setState({ files: [makeFile()] });
    vi.mocked(invoke).mockRejectedValue(new Error("ffmpeg exploded"));

    render(<ConversionPanel />);
    fireEvent.click(screen.getByText("Convert All"));

    await waitFor(() => expect(useAppStore.getState().files[0].status).toBe("error"));
    expect(useAppStore.getState().files[0].error).toBe("ffmpeg exploded");
    expect(useAppStore.getState().toasts.some((t) => t.type === "error")).toBe(true);
  });

  it("falls back to the error kind when no message is present", async () => {
    useAppStore.setState({ files: [makeFile()] });
    vi.mocked(invoke).mockRejectedValue({ kind: "ProcessError" });

    render(<ConversionPanel />);
    fireEvent.click(screen.getByText("Convert All"));

    await waitFor(() => expect(useAppStore.getState().files[0].status).toBe("error"));
    expect(useAppStore.getState().files[0].error).toBe("ProcessError");
  });

  it("stringifies primitive rejection reasons", async () => {
    useAppStore.setState({ files: [makeFile()] });
    vi.mocked(invoke).mockRejectedValue("boom");

    render(<ConversionPanel />);
    fireEvent.click(screen.getByText("Convert All"));

    await waitFor(() => expect(useAppStore.getState().files[0].status).toBe("error"));
    expect(useAppStore.getState().files[0].error).toBe("boom");
  });

  it("JSON-stringifies an error object with neither message nor kind", async () => {
    useAppStore.setState({ files: [makeFile()] });
    vi.mocked(invoke).mockRejectedValue({ foo: "bar" });

    render(<ConversionPanel />);
    fireEvent.click(screen.getByText("Convert All"));

    await waitFor(() => expect(useAppStore.getState().files[0].status).toBe("error"));
    expect(useAppStore.getState().files[0].error).toBe('{"foo":"bar"}');
  });

  it("saves all completed files to the chosen directory without overwriting names", async () => {
    useAppStore.setState({ files: [makeFile({ status: "done", outputPath: "/tmp/converted.webp" })] });
    vi.mocked(open).mockResolvedValue("/output folder");
    vi.mocked(invoke).mockResolvedValue("/output folder/a.webp");
    render(<ConversionPanel />);
    fireEvent.click(screen.getByText("Download All"));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("save_to_directory", {from:"/tmp/converted.webp",directory:"/output folder",filename:"a.webp"}));
    await waitFor(() => expect(useAppStore.getState().files[0].savedPath).toBe("/output folder/a.webp"));
  });

  it("clears all files when Remove All is clicked", () => {
    useAppStore.setState({ files: [makeFile(), makeFile()] });
    render(<ConversionPanel />);
    fireEvent.click(screen.getByText("Remove All"));
    expect(useAppStore.getState().files).toHaveLength(0);
  });
});
