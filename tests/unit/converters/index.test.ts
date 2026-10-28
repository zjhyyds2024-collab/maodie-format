import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { convertFile } from "../../../src/converters";
import type { ConvertFile, ConvertOptions } from "../../../src/converters/types";

const file: ConvertFile = {
  id: "1",
  filePath: "/home/user/photo.png",
  name: "photo.png",
  sizeBytes: 100,
  extension: "png",
  category: "image",
  targetFormat: "webp",
  status: "idle",
  progress: 0,
};

const options: ConvertOptions = {
  quality: 80,
  audioBitrate: 192,
  sampleRate: 44100,
  preserveMetadata: true,
};

describe("convertFile", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
    vi.mocked(invoke).mockResolvedValue({ output_path: "/tmp/out.webp", size_bytes: 42 });
  });

  it("invokes the convert_file command", async () => {
    await convertFile(file, options);
    expect(invoke).toHaveBeenCalledWith("convert_file", expect.any(Object));
  });

  it("maps camelCase fields to the backend's snake_case request shape", async () => {
    await convertFile(file, options);
    const [, args] = vi.mocked(invoke).mock.calls[0];
    expect(args).toEqual({
      request: {
        input_path: "/home/user/photo.png",
        output_format: "webp",
        options: {
          quality: 80,
          audio_bitrate: 192,
          sample_rate: 44100,
          preserve_metadata: true,
        },
      },
    });
  });

  it("returns the result resolved by invoke", async () => {
    const result = await convertFile(file, options);
    expect(result).toEqual({ output_path: "/tmp/out.webp", size_bytes: 42 });
  });

  it("passes through missing options as undefined rather than defaulting them", async () => {
    await convertFile(file, {});
    const [, args] = vi.mocked(invoke).mock.calls[0];
    expect(args.request.options).toEqual({
      quality: undefined,
      audio_bitrate: undefined,
      sample_rate: undefined,
      preserve_metadata: undefined,
    });
  });

  it("propagates invoke errors", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("sidecar not found"));
    await expect(convertFile(file, options)).rejects.toThrow("sidecar not found");
  });
});
