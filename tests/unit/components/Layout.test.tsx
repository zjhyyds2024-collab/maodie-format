import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Layout from "../../../src/components/Layout";
import { useAppStore } from "../../../src/store";
import "../../../src/i18n";

describe("Layout", () => {
  beforeEach(() => {
    useAppStore.setState({ toasts: [] });
  });

  it("renders the navbar and the page content", () => {
    render(
      <MemoryRouter>
        <Layout>
          <p>page content</p>
        </Layout>
      </MemoryRouter>,
    );
    expect(screen.getByText("耄耋格式")).toBeInTheDocument();
    expect(screen.getByText("page content")).toBeInTheDocument();
  });

  it("renders active toasts alongside the content", () => {
    useAppStore.setState({ toasts: [{ id: "1", message: "Hello", type: "info" }] });
    render(
      <MemoryRouter>
        <Layout>
          <p>page content</p>
        </Layout>
      </MemoryRouter>,
    );
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });
});
