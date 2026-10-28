import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Toasts from "../../../src/components/Toasts";
import { useAppStore } from "../../../src/store";

describe("Toasts", () => {
  beforeEach(() => {
    useAppStore.setState({ toasts: [] });
  });

  it("renders nothing when there are no toasts", () => {
    const { container } = render(<Toasts />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a toast message", () => {
    useAppStore.setState({ toasts: [{ id: "1", message: "Saved!", type: "success" }] });
    render(<Toasts />);
    expect(screen.getByText("Saved!")).toBeInTheDocument();
  });

  it("renders every toast in the list", () => {
    useAppStore.setState({
      toasts: [
        { id: "1", message: "First", type: "info" },
        { id: "2", message: "Second", type: "error" },
      ],
    });
    render(<Toasts />);
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
  });

  it("removes a toast when its close button is clicked", () => {
    useAppStore.setState({ toasts: [{ id: "1", message: "Bye", type: "info" }] });
    render(<Toasts />);
    fireEvent.click(screen.getByRole("button"));
    expect(useAppStore.getState().toasts).toHaveLength(0);
  });

  it("removes only the clicked toast when several are shown", () => {
    useAppStore.setState({
      toasts: [
        { id: "1", message: "First", type: "info" },
        { id: "2", message: "Second", type: "error" },
      ],
    });
    render(<Toasts />);
    fireEvent.click(screen.getAllByRole("button")[0]);
    const remaining = useAppStore.getState().toasts;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].message).toBe("Second");
  });
});
