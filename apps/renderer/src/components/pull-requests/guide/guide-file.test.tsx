// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { GuideFile } from "./guide-file";

test("generated files start closed and open on request", () => {
  render(<GuideFile generated file={{ path: "pnpm-lock.yaml", previousPath: null, status: "modified", additions: 1, deletions: 1, patch: null }} />);
  const header = screen.getByRole("button", { name: /pnpm-lock.yaml/ });
  expect(header.getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByText("No text diff is available for this file.")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Show diff" }));
  expect(header.getAttribute("aria-expanded")).toBe("true");
  expect(screen.getByText("No text diff is available for this file.")).toBeDefined();
});
