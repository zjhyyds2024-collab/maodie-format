import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import Uploader from "../../../src/components/Uploader";
import { useAppStore } from "../../../src/store";
import "../../../src/i18n";

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

function renderUploader() {
  return render(
    <MemoryRouter>
      <Uploader />
    </MemoryRouter>,
  );
}

describe("Uploader", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    vi.mocked(open).mockReset();
    useAppStore.setState({ files: [], toasts: [], batchRunning: false });
    vi.mocked(listen).mockImplementation(() => Promise.resolve(() => {}));
  });

  it("renders the drop zone prompt", () => {
    renderUploader();
    expect(screen.getByText("Drop files here")).toBeInTheDocument();
  });

  it("opens the native file picker and adds selected files on click", async () => {
    vi.mocked(open).mockResolvedValue(["/a.png", "/b.mp3"]);
    renderUploader();

    fireEvent.click(screen.getByText("Drop files here"));

    await waitFor(() => expect(useAppStore.getState().files).toHaveLength(2));
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("wraps a single selected path into an array", async () => {
    vi.mocked(open).mockResolvedValue("/a.png");
    renderUploader();

    fireEvent.click(screen.getByText("Drop files here"));

    await waitFor(() => expect(useAppStore.getState().files).toHaveLength(1));
  });

  it("does nothing when the picker returns an empty selection", async () => {
    vi.mocked(open).mockResolvedValue([]);
    renderUploader();

    fireEvent.click(screen.getByText("Drop files here"));

    await waitFor(() => expect(open).toHaveBeenCalled());
    expect(useAppStore.getState().files).toHaveLength(0);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("does nothing when the picker is cancelled", async () => {
    vi.mocked(open).mockResolvedValue(null);
    renderUploader();

    fireEvent.click(screen.getByText("Drop files here"));

    await waitFor(() => expect(open).toHaveBeenCalled());
    expect(useAppStore.getState().files).toHaveLength(0);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("adds files and navigates on a native tauri drag-drop event", async () => {
    const handlers: Record<string, (event: unknown) => void> = {};
    vi.mocked(listen).mockImplementation((event, cb) => {
      handlers[event as string] = cb as (event: unknown) => void;
      return Promise.resolve(() => {});
    });

    renderUploader();
    await waitFor(() => expect(handlers["tauri://drag-drop"]).toBeDefined());

    await act(async () => {
      handlers["tauri://drag-drop"]({ payload: { paths: ["/a.png"], position: { x: 0, y: 0 } } });
    });

    await waitFor(() => expect(useAppStore.getState().files).toHaveLength(1));
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("ignores a drag-drop event with no paths", async () => {
    const handlers: Record<string, (event: unknown) => void> = {};
    vi.mocked(listen).mockImplementation((event, cb) => {
      handlers[event as string] = cb as (event: unknown) => void;
      return Promise.resolve(() => {});
    });

    renderUploader();
    await waitFor(() => expect(handlers["tauri://drag-drop"]).toBeDefined());

    await act(async () => {
      handlers["tauri://drag-drop"]({ payload: { paths: [], position: { x: 0, y: 0 } } });
    });

    expect(useAppStore.getState().files).toHaveLength(0);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("shows the dragging state while a native drag is over the drop zone", async () => {
    const handlers: Record<string, () => void> = {};
    vi.mocked(listen).mockImplementation((event, cb) => {
      handlers[event as string] = cb as () => void;
      return Promise.resolve(() => {});
    });

    const { container } = renderUploader();
    await waitFor(() => expect(handlers["tauri://drag-enter"]).toBeDefined());

    await act(async () => {
      handlers["tauri://drag-enter"]();
    });
    expect(container.firstChild).toHaveClass("border-brand-500");

    await act(async () => {
      handlers["tauri://drag-leave"]();
    });
    expect(container.firstChild).not.toHaveClass("border-brand-500");
  });
  it("rejects new native drops while a batch is running", async () => {
    const handlers: Record<string, (event: unknown) => void> = {};
    vi.mocked(listen).mockImplementation((event, cb) => {
      handlers[event as string] = cb as (event: unknown) => void;
      return Promise.resolve(() => {});
    });
    useAppStore.setState({batchRunning:true});
    renderUploader();
    expect(screen.getByRole("button",{name:/Drop files here/})).toBeDisabled();
    expect(screen.getByRole("button",{name:/Add folder/})).toBeDisabled();
    await waitFor(() => expect(handlers["tauri://drag-drop"]).toBeDefined());
    await act(async () => handlers["tauri://drag-drop"]({payload:{paths:["/blocked.png"]}}));
    expect(useAppStore.getState().files).toHaveLength(0);
  });

  it("reports a native picker failure without an unhandled rejection", async () => {
    vi.mocked(open).mockRejectedValue(new Error("Picker unavailable"));
    renderUploader();
    fireEvent.click(screen.getByText("Drop files here"));
    await waitFor(() => expect(useAppStore.getState().toasts[0]?.message).toContain("Picker unavailable"));
  });

});
