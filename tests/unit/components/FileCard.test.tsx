import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import FileCard from "../../../src/components/FileCard";
import { useAppStore } from "../../../src/store";
import type { ConvertFile } from "../../../src/converters/types";
import "../../../src/i18n";

const baseFile: ConvertFile = {
  id: "1",
  filePath: "/home/user/photo.png",
  name: "photo.png",
  sizeBytes: 2048,
  extension: "png",
  category: "image",
  targetFormat: "webp",
  status: "idle",
  progress: 0,
};

describe("FileCard", () => {
  beforeEach(() => {
    useAppStore.setState({ files: [baseFile], toasts: [] });
    vi.mocked(save).mockReset();
    vi.mocked(invoke).mockReset();
  });

  it("shows the file name, size and category", () => {
    render(<FileCard file={baseFile} />);
    expect(screen.getByText("photo.png")).toBeInTheDocument();
    expect(screen.getByText(/2\.0 KB/)).toBeInTheDocument();
    expect(screen.getByText(/image/)).toBeInTheDocument();
  });

  it("formats zero-byte files as —", () => {
    render(<FileCard file={{ ...baseFile, sizeBytes: 0 }} />);
    expect(screen.getByText(/—/)).toBeInTheDocument();
  });

  it("formats large files in megabytes", () => {
    render(<FileCard file={{ ...baseFile, sizeBytes: 5 * 1024 * 1024 }} />);
    expect(screen.getByText(/5\.0 MB/)).toBeInTheDocument();
  });

  it("shows a format dropdown while idle", () => {
    render(<FileCard file={baseFile} />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("hides the format dropdown while converting", () => {
    render(<FileCard file={{ ...baseFile, status: "converting", progress: 40 }} />);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("shows a progress bar while converting", () => {
    const { container } = render(
      <FileCard file={{ ...baseFile, status: "converting", progress: 40 }} />,
    );
    expect(container.querySelector(".rounded-full")).toBeInTheDocument();
  });

  it("shows the error message when the conversion failed", () => {
    render(<FileCard file={{ ...baseFile, status: "error", error: "boom" }} />);
    expect(screen.getByText("boom")).toBeInTheDocument();
  });

  it("shows a download button once done", () => {
    render(<FileCard file={{ ...baseFile, status: "done", outputPath: "/tmp/out.webp" }} />);
    expect(screen.getByText("Download")).toBeInTheDocument();
  });

  it("disables the format dropdown once done", () => {
    render(<FileCard file={{ ...baseFile, status: "done", outputPath: "/tmp/out.webp" }} />);
    expect(screen.getByRole("combobox")).toBeDisabled();
  });

  it("changing the format calls setTargetFormat", () => {
    render(<FileCard file={baseFile} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "avif" } });
    expect(useAppStore.getState().files[0].targetFormat).toBe("avif");
  });

  it("removing the file calls removeFile", () => {
    render(<FileCard file={baseFile} />);
    fireEvent.click(screen.getByTitle("Remove"));
    expect(useAppStore.getState().files).toHaveLength(0);
  });

  it("shows a cancel button (not remove) while converting", () => {
    render(<FileCard file={{ ...baseFile, status: "converting", progress: 10 }} />);
    expect(screen.getByTitle("Cancel")).toBeInTheDocument();
    expect(screen.queryByTitle("Remove")).not.toBeInTheDocument();
  });

  it("downloads the converted file when a save path is chosen", async () => {
    vi.mocked(save).mockResolvedValue("/home/user/photo.webp");
    vi.mocked(invoke).mockResolvedValue(undefined);
    const doneFile = { ...baseFile, status: "done" as const, outputPath: "/tmp/out.webp" };

    render(<FileCard file={doneFile} />);
    fireEvent.click(screen.getByText("Download"));

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("save_file", {
        from: "/tmp/out.webp",
        to: "/home/user/photo.webp",
      }),
    );
    expect(useAppStore.getState().toasts[0].message).toContain("saved");
  });

  it("does nothing when the save dialog is cancelled", async () => {
    vi.mocked(save).mockResolvedValue(null);
    const doneFile = { ...baseFile, status: "done" as const, outputPath: "/tmp/out.webp" };

    render(<FileCard file={doneFile} />);
    fireEvent.click(screen.getByText("Download"));

    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(invoke).not.toHaveBeenCalled();
  });

  it("shows an error toast when saving fails", async () => {
    vi.mocked(save).mockRejectedValue(new Error("nope"));
    const doneFile = { ...baseFile, status: "done" as const, outputPath: "/tmp/out.webp" };

    render(<FileCard file={doneFile} />);
    fireEvent.click(screen.getByText("Download"));

    await waitFor(() =>
      expect(useAppStore.getState().toasts.some((t) => t.type === "error")).toBe(true),
    );
  });

  it("does not open the save dialog when there is no output path yet", () => {
    render(<FileCard file={{ ...baseFile, status: "done", outputPath: undefined }} />);
    fireEvent.click(screen.getByText("Download"));
    expect(save).not.toHaveBeenCalled();
  });
});

it("uses the actual ZIP extension for slide page exports",async()=>{
  useAppStore.setState({files:[],toasts:[]});vi.mocked(save).mockReset();vi.mocked(save).mockResolvedValue(null);
  render(<FileCard file={{...baseFile,name:"slides.pptx",extension:"pptx",category:"document",targetFormat:"png",status:"done",outputPath:"/tmp/result.zip",outputExtension:"zip"}}/>);
  fireEvent.click(screen.getByText("Download"));
  await waitFor(()=>expect(save).toHaveBeenCalledWith(expect.objectContaining({defaultPath:"slides.zip",filters:[{name:"ZIP",extensions:["zip"]}]})));
});
