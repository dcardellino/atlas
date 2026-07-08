import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SettingsTabs from "./SettingsTabs";

vi.mock("next/navigation", () => ({
  usePathname: () => "/settings/tokens",
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

describe("SettingsTabs", () => {
  it("renders all five settings tabs", () => {
    render(<SettingsTabs />);
    for (const label of [
      "Integrationen",
      "Tokens",
      "Insights",
      "Erinnerungen",
      "Areas",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("marks the current route's tab with aria-current", () => {
    render(<SettingsTabs />);
    expect(screen.getByText("Tokens").closest("a")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByText("Integrationen").closest("a"),
    ).not.toHaveAttribute("aria-current");
  });
});
