import { describe, it, expect } from "vitest";
import {
  detectCategory,
  getOutputFormats,
  getDefaultOutputFormat,
  IMAGE_FORMATS,
  AUDIO_FORMATS,
  VIDEO_FORMATS,
  DOCUMENT_FORMATS,
} from "../../src/converters/formats";

describe("detectCategory", () => {
  it("detects image files", () => {
    expect(detectCategory("photo.png")).toBe("image");
    expect(detectCategory("image.jpg")).toBe("image");
    expect(detectCategory("icon.webp")).toBe("image");
    expect(detectCategory("banner.gif")).toBe("image");
  });

  it("detects audio files", () => {
    expect(detectCategory("song.mp3")).toBe("audio");
    expect(detectCategory("track.flac")).toBe("audio");
    expect(detectCategory("audio.wav")).toBe("audio");
    expect(detectCategory("podcast.ogg")).toBe("audio");
  });

  it("detects video files", () => {
    expect(detectCategory("movie.mp4")).toBe("video");
    expect(detectCategory("clip.mkv")).toBe("video");
    expect(detectCategory("video.webm")).toBe("video");
    expect(detectCategory("film.avi")).toBe("video");
  });

  it("detects document files", () => {
    expect(detectCategory("report.docx")).toBe("document");
    expect(detectCategory("readme.md")).toBe("document");
    expect(detectCategory("page.html")).toBe("document");
    expect(detectCategory("book.epub")).toBe("document");
  });

  it("returns null for unknown extensions", () => {
    expect(detectCategory("file.xyz123")).toBeNull();
    expect(detectCategory("noextension")).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(detectCategory("photo.PNG")).toBe("image");
    expect(detectCategory("song.MP3")).toBe("audio");
    expect(detectCategory("movie.MP4")).toBe("video");
  });
});

describe("getOutputFormats", () => {
  it("returns only output-capable formats", () => {
    const imageFormats = getOutputFormats("image");
    expect(imageFormats.every((f) => f.canOutput)).toBe(true);
  });

  it("returns formats for each category", () => {
    expect(getOutputFormats("image").length).toBeGreaterThan(0);
    expect(getOutputFormats("audio").length).toBeGreaterThan(0);
    expect(getOutputFormats("video").length).toBeGreaterThan(0);
    expect(getOutputFormats("document").length).toBeGreaterThan(0);
  });
});

describe("getDefaultOutputFormat", () => {
  it("returns valid defaults", () => {
    expect(getDefaultOutputFormat("image")).toBe("png");
    expect(getDefaultOutputFormat("audio")).toBe("mp3");
    expect(getDefaultOutputFormat("video")).toBe("mp4");
    expect(getDefaultOutputFormat("document")).toBe("docx");
  });

  it("defaults are in the output format list", () => {
    const check = (cat: Parameters<typeof getDefaultOutputFormat>[0]) => {
      const def = getDefaultOutputFormat(cat);
      const formats = getOutputFormats(cat);
      return formats.some((f) => f.ext === def);
    };
    expect(check("image")).toBe(true);
    expect(check("audio")).toBe(true);
    expect(check("video")).toBe(true);
    expect(check("document")).toBe(true);
  });
});

describe("format lists integrity", () => {
  it("all format lists have required fields", () => {
    const allFormats = [
      ...IMAGE_FORMATS,
      ...AUDIO_FORMATS,
      ...VIDEO_FORMATS,
      ...DOCUMENT_FORMATS,
    ];
    for (const f of allFormats) {
      expect(f.ext).toBeTruthy();
      expect(f.label).toBeTruthy();
      expect(typeof f.canInput).toBe("boolean");
      expect(typeof f.canOutput).toBe("boolean");
    }
  });

  it("no duplicate extensions within a category", () => {
    const check = (formats: typeof IMAGE_FORMATS) => {
      const exts = formats.map((f) => f.ext);
      const unique = new Set(exts);
      return exts.length === unique.size;
    };
    expect(check(IMAGE_FORMATS)).toBe(true);
    expect(check(AUDIO_FORMATS)).toBe(true);
    expect(check(VIDEO_FORMATS)).toBe(true);
    expect(check(DOCUMENT_FORMATS)).toBe(true);
  });
});
