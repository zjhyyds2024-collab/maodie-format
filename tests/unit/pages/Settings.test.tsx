import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { APP_VERSION } from "../../../src/appInfo";
import Settings from "../../../src/pages/Settings";
import { useAppStore } from "../../../src/store";
import "../../../src/i18n";

describe("Settings page", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = vi.fn(function(this:HTMLDialogElement){this.open=true;});
    HTMLDialogElement.prototype.close = vi.fn(function(this:HTMLDialogElement){this.open=false;});
    useAppStore.getState().updateSettings({
      theme: "system",
      language: "en",
      defaultImageFormat: "png",
      quality: 92,
      audioBitrate: 192,
      preserveMetadata: true,
      useDefaultsAutomatically: false,
    });
  });

  it("renders the settings title", () => {
    render(<Settings />);
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
  });

  it("introduces the app, privacy and attribution", () => {
    render(<Settings />);
    expect(screen.queryByRole("heading", { name: "About this app" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"About this app"}));
    expect(screen.getByRole("heading", { name: "About this app" })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`v${APP_VERSION.replaceAll(".", "\\.")}`))).toBeInTheDocument();
    expect(screen.getByText(/Sikander RAVATE/)).toBeInTheDocument();
    expect(screen.getByText(/unsaved temporary files/)).toBeInTheDocument();
  });

  it("reflects the current theme", () => {
    render(<Settings />);
    expect(screen.getByDisplayValue("System")).toBeInTheDocument();
  });

  it("updates the theme when changed", () => {
    render(<Settings />);
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "dark" } });
    expect(useAppStore.getState().settings.theme).toBe("dark");
  });

  it("updates the language when changed", () => {
    render(<Settings />);
    fireEvent.change(screen.getAllByRole("combobox")[1], { target: { value: "fr" } });
    expect(useAppStore.getState().settings.language).toBe("fr");
  });

  it("updates the default image format when changed", () => {
    render(<Settings />);
    fireEvent.change(screen.getAllByRole("combobox")[2], { target: { value: "webp" } });
    expect(useAppStore.getState().settings.defaultImageFormat).toBe("webp");
  });

  it("updates the image quality via the slider", () => {
    render(<Settings />);
    fireEvent.change(screen.getByRole("slider"), { target: { value: "50" } });
    expect(useAppStore.getState().settings.quality).toBe(50);
  });

  it("displays the current quality percentage", () => {
    render(<Settings />);
    expect(screen.getByText("92%")).toBeInTheDocument();
  });

  it("toggles preserveMetadata via its switch", () => {
    render(<Settings />);
    const before = useAppStore.getState().settings.preserveMetadata;
    fireEvent.click(screen.getAllByRole("switch")[0]);
    expect(useAppStore.getState().settings.preserveMetadata).toBe(!before);
  });

  it("toggles useDefaultsAutomatically via its switch", () => {
    render(<Settings />);
    const before = useAppStore.getState().settings.useDefaultsAutomatically;
    fireEvent.click(screen.getAllByRole("switch")[1]);
    expect(useAppStore.getState().settings.useDefaultsAutomatically).toBe(!before);
  });
});
