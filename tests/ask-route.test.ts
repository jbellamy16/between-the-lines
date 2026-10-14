import { afterEach, expect, it, vi } from "vitest";

vi.mock("../src/lib/ai/analyst/service", async (original) => ({
  ...(await original<typeof import("../src/lib/ai/analyst/service")>()),
  analystEnabled: () => true,
  askAnalyst: vi.fn(async () => ({ status: "answered" })),
}));

const { POST } = await import("../src/app/api/ask/route");
const { askAnalyst } = await import("../src/lib/ai/analyst/service");

afterEach(() => {
  vi.unstubAllEnvs();
});

async function ask(xff: string) {
  const res = await POST(
    new Request("http://localhost/api/ask", {
      method: "POST",
      headers: { "x-forwarded-for": xff },
      body: JSON.stringify({
        scenario: "pressure",
        time: 3804,
        question: "What changed?",
      }),
    }),
  );
  const lines = (await res.text())
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));
  return lines.at(-1).result as { status: string; message?: string };
}

it("limits each client by the address the platform appended, not one it sent", async () => {
  vi.stubEnv("AI_ASK_PER_CLIENT_LIMIT", "1");
  expect((await ask("1.1.1.1, 203.0.113.20:5001")).status).toBe("answered");
  // A new spoofed first entry from the same caller is still the same client.
  expect((await ask("2.2.2.2, 203.0.113.20:5002")).status).toBe("unavailable");
  expect(askAnalyst).toHaveBeenCalledTimes(1);
  // Another caller behind the same spoofed entry is a different client.
  expect((await ask("1.1.1.1, 203.0.113.21:5003")).status).toBe("answered");
  expect(askAnalyst).toHaveBeenCalledTimes(2);
});
