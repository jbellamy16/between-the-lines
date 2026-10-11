import { beforeEach, expect, it, vi } from "vitest";
vi.mock("../src/lib/foundry", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/foundry")>()),
  foundryConfigured: () => false,
}));
// Alias resolved explicitly by Vitest config.
import { POST } from "../src/app/api/insights/route";
const request = (data: unknown) =>
  new Request("http://localhost/api/insights", {
    method: "POST",
    body: JSON.stringify(data),
  });
it("rejects invalid or unbounded playback input", async () => {
  expect(
    (
      await POST(
        request({
          scenario: "pressure",
          time: 999999,
          mode: "fan",
          team: "harbor",
          category: "pressure",
        }),
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await POST(
        request({
          scenario: "real-match",
          time: 3804,
          mode: "fan",
          team: "harbor",
          category: "pressure",
        }),
      )
    ).status,
  ).toBe(400);
});
it("returns a truthful offline response with server-derived evidence", async () => {
  const res = await POST(
    request({
      scenario: "pressure",
      time: 3804,
      mode: "fan",
      team: "harbor",
      category: "pressure",
    }),
  );
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data.source).toBe("offline");
  expect(data.narrative).toBeNull();
  expect(data.insight.end).toBe(3804);
});
it("does not produce an insight at kickoff", async () => {
  expect(
    (
      await POST(
        request({
          scenario: "pressure",
          time: 0,
          mode: "fan",
          team: "harbor",
          category: "pressure",
        }),
      )
    ).status,
  ).toBe(404);
});
it("uses the requested balanced profile rather than silently narrating the curated demo", async () => {
  const { SyntheticMatchSource } = await import("../src/lib/sources/synthetic");
  const { historicalInsights } =
    await import("../src/lib/sources/intelligence");
  const match = new SyntheticMatchSource().read("pressure", {
    profile: "balanced",
  });
  const time = [1800, 2400, 4200, 4800].find(
    (t) => historicalInsights(match, t).length,
  )!;
  const insight = historicalInsights(match, time)[0];
  expect(insight).toBeDefined();
  const response = await POST(
    request({
      scenario: "pressure",
      profile: "balanced",
      time,
      mode: "fan",
      team: insight.team,
      category: insight.category,
    }),
  );
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.insight.evidenceIds).toEqual(insight.evidenceIds);
  expect(
    data.insight.evidenceIds.every((id: string) =>
      id.startsWith("synthetic-pressure-"),
    ),
  ).toBe(true);
  expect(
    (
      await POST(
        request({
          scenario: "pressure",
          profile: "invented",
          time,
          mode: "fan",
          team: "harbor",
          category: "pressure",
        }),
      )
    ).status,
  ).toBe(400);
});
