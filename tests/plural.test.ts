import { describe, expect, it } from "vitest";
import { singularCounts } from "../src/lib/plural";

describe("singularCounts", () => {
  it("makes a count of one singular for measured labels", () => {
    expect(singularCounts("its latest half: 1 shots, after 3")).toBe(
      "its latest half: 1 shot, after 3",
    );
    expect(singularCounts("1 ball wins in the attacking third")).toBe(
      "1 ball win in the attacking third",
    );
    expect(singularCounts("1 pass attempts in its second half")).toBe(
      "1 pass attempt in its second half",
    );
  });
  it("leaves other counts and decimals alone", () => {
    for (const text of ["21 shots", "0.1 shots", "11 pass attempts", "4 shots"])
      expect(singularCounts(text)).toBe(text);
  });
});
