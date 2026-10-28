import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Navbar from "../../../src/components/Navbar";
import "../../../src/i18n";

describe("Navbar", () => {
  it("renders the workspace navigation links", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Navbar />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("link", { name: /^home$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /conversion workspace/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /settings/i })).toBeInTheDocument();
  });

  it("marks the current route's link as active", () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <Navbar />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: /settings/i })).toHaveClass("nav-active");
    expect(screen.getByRole("link", { name: /conversion workspace/i })).not.toHaveClass("nav-active");
  });

  it("offers only one entry for the workspace", () => {
    render(<MemoryRouter><Navbar /></MemoryRouter>);
    expect(screen.getByRole("link", { name: /conversion workspace/i })).toHaveAttribute("href", "/");
    expect(screen.getAllByRole("link")).toHaveLength(4);
  });

  it("renders the 耄耋格式 brand", () => {
    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    );
    expect(screen.getByText("耄耋格式")).toBeInTheDocument();
    expect(screen.getByText("Local file converter")).toBeInTheDocument();
  });
});
