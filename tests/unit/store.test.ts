import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAppStore } from "../../src/store";

// Mock invoke to return a fake file info
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue({ size_bytes: 1024 }),
}));

describe("useAppStore", () => {
  beforeEach(() => {
    useAppStore.setState({
      files: [],
      toasts: [],
      settings: useAppStore.getState().settings,
    });
  });

  describe("addFilePaths", () => {
    it("adds supported files by path", async () => {
      const { addFilePaths } = useAppStore.getState();
      await addFilePaths(["/home/user/photo.png", "/home/user/song.mp3"]);
      expect(useAppStore.getState().files).toHaveLength(2);
    });

    it("skips unsupported file extensions", async () => {
      const { addFilePaths } = useAppStore.getState();
      await addFilePaths(["/home/user/archive.unknown", "/home/user/photo.png"]);
      expect(useAppStore.getState().files).toHaveLength(1);
    });

    it("assigns correct category from extension", async () => {
      const { addFilePaths } = useAppStore.getState();
      await addFilePaths(["/path/photo.png", "/path/song.mp3", "/path/movie.mp4"]);
      const files = useAppStore.getState().files;
      expect(files.find((f) => f.name === "photo.png")?.category).toBe("image");
      expect(files.find((f) => f.name === "song.mp3")?.category).toBe("audio");
      expect(files.find((f) => f.name === "movie.mp4")?.category).toBe("video");
    });

    it("extracts file name from full path", async () => {
      const { addFilePaths } = useAppStore.getState();
      await addFilePaths(["/home/user/documents/report.docx"]);
      expect(useAppStore.getState().files[0].name).toBe("report.docx");
    });

    it("assigns unique ids", async () => {
      const { addFilePaths } = useAppStore.getState();
      await addFilePaths(["/a.png", "/b.png", "/c.png"]);
      const ids = useAppStore.getState().files.map((f) => f.id);
      expect(new Set(ids).size).toBe(3);
    });

    it("stores the full file path", async () => {
      const { addFilePaths } = useAppStore.getState();
      await addFilePaths(["/home/user/photo.png"]);
      expect(useAppStore.getState().files[0].filePath).toBe("/home/user/photo.png");
    });

    it("uses the configured default format when useDefaultsAutomatically is on", async () => {
      useAppStore.setState({
        settings: {
          ...useAppStore.getState().settings,
          useDefaultsAutomatically: true,
          defaultImageFormat: "avif",
        },
      });
      const { addFilePaths } = useAppStore.getState();
      await addFilePaths(["/home/user/photo.png"]);
      expect(useAppStore.getState().files[0].targetFormat).toBe("avif");
    });

    it("defaults size to 0 when get_file_info fails", async () => {
      const { invoke } = await import("@tauri-apps/api/core");
      vi.mocked(invoke).mockResolvedValueOnce(["/home/user/photo.png"]).mockRejectedValueOnce(new Error("no such file"));
      const { addFilePaths } = useAppStore.getState();
      await addFilePaths(["/home/user/photo.png"]);
      expect(useAppStore.getState().files[0].sizeBytes).toBe(0);
    });
  });

  describe("removeFile", () => {
    it("removes a file by id", async () => {
      const { addFilePaths, removeFile } = useAppStore.getState();
      await addFilePaths(["/photo.png"]);
      const { files } = useAppStore.getState();
      removeFile(files[0].id);
      expect(useAppStore.getState().files).toHaveLength(0);
    });
  });

  describe("clearFiles", () => {
    it("removes all files", async () => {
      const { addFilePaths, clearFiles } = useAppStore.getState();
      await addFilePaths(["/a.png", "/b.mp3"]);
      clearFiles();
      expect(useAppStore.getState().files).toHaveLength(0);
    });
  });

  describe("updateFile", () => {
    it("updates specific fields", async () => {
      const { addFilePaths, updateFile } = useAppStore.getState();
      await addFilePaths(["/photo.png"]);
      const id = useAppStore.getState().files[0].id;
      updateFile(id, { status: "converting", progress: 42 });
      const file = useAppStore.getState().files[0];
      expect(file.status).toBe("converting");
      expect(file.progress).toBe(42);
    });

    it("leaves other files untouched", async () => {
      const { addFilePaths, updateFile } = useAppStore.getState();
      await addFilePaths(["/a.png", "/b.png"]);
      const [first, second] = useAppStore.getState().files;
      updateFile(first.id, { status: "done" });
      const files = useAppStore.getState().files;
      expect(files.find((f) => f.id === second.id)?.status).toBe("idle");
    });
  });

  describe("setTargetFormat", () => {
    it("changes the target format", async () => {
      const { addFilePaths, setTargetFormat } = useAppStore.getState();
      await addFilePaths(["/photo.png"]);
      const id = useAppStore.getState().files[0].id;
      setTargetFormat(id, "webp");
      expect(useAppStore.getState().files[0].targetFormat).toBe("webp");
    });

    it("leaves other files' target format untouched", async () => {
      const { addFilePaths, setTargetFormat } = useAppStore.getState();
      await addFilePaths(["/a.png", "/b.png"]);
      const [first, second] = useAppStore.getState().files;
      const originalFormat = second.targetFormat;
      setTargetFormat(first.id, "avif");
      const files = useAppStore.getState().files;
      expect(files.find((f) => f.id === second.id)?.targetFormat).toBe(originalFormat);
    });
  });

  describe("addToast", () => {
    it("adds a toast with correct fields", () => {
      const { addToast } = useAppStore.getState();
      addToast("Test message", "success");
      const toasts = useAppStore.getState().toasts;
      expect(toasts).toHaveLength(1);
      expect(toasts[0].message).toBe("Test message");
      expect(toasts[0].type).toBe("success");
      expect(toasts[0].id).toBeTruthy();
    });

    it("automatically removes the toast after 4 seconds", () => {
      vi.useFakeTimers();
      try {
        const { addToast } = useAppStore.getState();
        addToast("Fading toast", "info");
        expect(useAppStore.getState().toasts).toHaveLength(1);
        vi.advanceTimersByTime(4000);
        expect(useAppStore.getState().toasts).toHaveLength(0);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("updateSettings", () => {
    it("merges settings", () => {
      const { updateSettings } = useAppStore.getState();
      updateSettings({ theme: "dark", quality: 80 });
      const { settings } = useAppStore.getState();
      expect(settings.theme).toBe("dark");
      expect(settings.quality).toBe(80);
    });
  });
});
