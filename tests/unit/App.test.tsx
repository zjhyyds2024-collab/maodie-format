import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import App from "../../src/App";
import { useAppStore } from "../../src/store";

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

describe("App", () => {
  beforeEach(() => {
    useAppStore.setState({ files: [], toasts: [] });
    useAppStore.getState().updateSettings({ theme: "system", language: "en" });
    document.documentElement.classList.remove("dark");
    mockMatchMedia(false);
  });

  it("renders the home page by default", () => {
    render(<App />);
    expect(screen.getByRole("heading",{name:"Conversion workspace"})).toBeInTheDocument();
  });

  it("applies the dark class when theme is dark", () => {
    useAppStore.getState().updateSettings({ theme: "dark" });
    render(<App />);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("removes the dark class when theme is light", () => {
    document.documentElement.classList.add("dark");
    useAppStore.getState().updateSettings({ theme: "light" });
    render(<App />);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("follows the OS preference when theme is system and it prefers dark", () => {
    mockMatchMedia(true);
    useAppStore.getState().updateSettings({ theme: "system" });
    render(<App />);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("does not apply dark when theme is system and the OS prefers light", () => {
    mockMatchMedia(false);
    useAppStore.getState().updateSettings({ theme: "system" });
    render(<App />);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("reacts live to an OS theme change while in system mode", () => {
    let changeHandler: ((e: MediaQueryListEvent) => void) | undefined;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: (_: string, handler: (e: MediaQueryListEvent) => void) => {
        changeHandler = handler;
      },
      removeEventListener: vi.fn(),
    }));
    useAppStore.getState().updateSettings({ theme: "system" });
    render(<App />);

    expect(document.documentElement.classList.contains("dark")).toBe(false);
    act(() => {
      changeHandler?.({ matches: true } as MediaQueryListEvent);
    });
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("switches the i18n language to match the stored settings", async () => {
    render(<App />);
    await act(async () => {
      useAppStore.getState().updateSettings({ language: "fr" });
    });
    expect(screen.getByRole("link",{name:"Paramètres",exact:true})).toBeInTheDocument();
  });
});
