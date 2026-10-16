import { describe, expect, it } from "vitest";
import { slugFromName, validSlug } from "@/lib/carta";

describe("Restaurant slug", () => {
  it("normalizes accents, spaces and punctuation", () => {
    expect(slugFromName("  Trattoria È Bella!  ")).toBe("trattoria-e-bella");
  });
  it("enforces the requested format and length", () => {
    expect(validSlug("carta-123")).toBe(true);
    for (const slug of ["ab", "Carta", "a b", "a_b", "a".repeat(41)]) expect(validSlug(slug)).toBe(false);
    expect(validSlug("a".repeat(40))).toBe(true);
  });
});