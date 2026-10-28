import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { SUPPORTED_LANGUAGES } from "../../../src/i18n";

const LOCALES_DIR = path.resolve(__dirname, "../../../src/i18n/locales");

type JsonRecord = Record<string, unknown>;

function flattenKeys(obj: JsonRecord, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return flattenKeys(value as JsonRecord, fullKey);
    }
    return [fullKey];
  });
}

function loadLocale(file: string): JsonRecord {
  return JSON.parse(readFileSync(path.join(LOCALES_DIR, file), "utf-8"));
}

const localeFiles = readdirSync(LOCALES_DIR).filter((f) => f.endsWith(".json"));
const enKeys = flattenKeys(loadLocale("en.json")).sort();

describe("locale files", () => {
  it("finds the reference en.json file", () => {
    expect(localeFiles).toContain("en.json");
    expect(enKeys.length).toBeGreaterThan(0);
  });

  it.each(localeFiles.filter((f) => f !== "en.json"))(
    "%s has exactly the same keys as en.json",
    (file) => {
      const keys = flattenKeys(loadLocale(file)).sort();
      expect(keys).toEqual(enKeys);
    },
  );

  it.each(localeFiles)("%s only contains non-empty string values", (file) => {
    const content = loadLocale(file);
    for (const key of flattenKeys(content)) {
      const value = key
        .split(".")
        .reduce<unknown>((o, k) => (o as JsonRecord)[k], content);
      expect(typeof value).toBe("string");
      expect((value as string).length).toBeGreaterThan(0);
    }
  });
});

describe("SUPPORTED_LANGUAGES", () => {
  it("has exactly one entry per locale file", () => {
    const codes = SUPPORTED_LANGUAGES.map((l) => l.code).sort();
    const fileCodes = localeFiles.map((f) => f.replace(/\.json$/, "")).sort();
    expect(codes).toEqual(fileCodes);
  });

  it("gives every language a non-empty label", () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(lang.label.length).toBeGreaterThan(0);
    }
  });

  it("has no duplicate language codes", () => {
    const codes = SUPPORTED_LANGUAGES.map((l) => l.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
