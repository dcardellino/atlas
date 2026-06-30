import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Nav from "./Nav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/today",
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("Nav", () => {
  it("renders all six nav destinations", () => {
    render(<Nav />);
    for (const label of [
      "Today",
      "Tasks",
      "Areas",
      "Routines",
      "Journal",
      "Settings",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("marks the active route with aria-current", () => {
    render(<Nav />);
    expect(screen.getByText("Today").closest("a")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
