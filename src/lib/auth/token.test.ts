import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bearerFromHeader, generateToken, hashToken } from "./token";

// TASK-015 verify: hashing is deterministic + pepper-dependent; bearer parsing
// and token generation behave.
describe("token helpers", () => {
  const OLD = process.env.CAPTURE_PEPPER;
  beforeEach(() => {
    process.env.CAPTURE_PEPPER = "test-pepper";
  });
  afterEach(() => {
    process.env.CAPTURE_PEPPER = OLD;
    vi.restoreAllMocks();
  });

  it("hashes deterministically", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
  });

  it("changes the hash when the pepper changes", () => {
    const a = hashToken("abc");
    process.env.CAPTURE_PEPPER = "other-pepper";
    expect(hashToken("abc")).not.toBe(a);
  });

  it("generates prefixed, unique tokens", () => {
    const t1 = generateToken();
    const t2 = generateToken();
    expect(t1).toMatch(/^atls_/);
    expect(t1).not.toBe(t2);
  });

  it("parses a Bearer header (case-insensitive)", () => {
    expect(bearerFromHeader("Bearer xyz")).toBe("xyz");
    expect(bearerFromHeader("bearer  xyz ")).toBe("xyz");
    expect(bearerFromHeader("Basic xyz")).toBeNull();
    expect(bearerFromHeader(null)).toBeNull();
  });
});
