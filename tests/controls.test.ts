import { afterEach, expect, it, vi } from "vitest";
import type { NarrationResult } from "../src/lib/ai/narration";
const value = { provider: "openai" } as NarrationResult;
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
async function fresh() {
  vi.resetModules();
  vi.stubEnv("AI_REDIS_URL", "");
  vi.stubEnv("AI_USAGE_STORE", "memory");
  return import("../src/lib/ai/controls");
}
it("reserves globally across keys and never refunds potentially billed failures", async () => {
  const { controlledNarration } = await fresh();
  vi.stubEnv("AI_MINUTE_LIMIT", "1");
  await expect(
    controlledNarration("a", async () => {
      throw new Error("failed");
    }),
  ).rejects.toThrow();
  const generate = vi.fn().mockResolvedValue(value);
  await expect(controlledNarration("b", generate)).rejects.toThrow("limit");
  expect(generate).not.toHaveBeenCalled();
});
it("failure cooldown is short and concurrent duplicates cannot generate twice", async () => {
  vi.useFakeTimers();
  const { controlledNarration } = await fresh();
  await expect(
    controlledNarration("fail", async () => {
      throw new Error("failed");
    }),
  ).rejects.toThrow();
  const generate = vi.fn().mockResolvedValue(value);
  await expect(controlledNarration("fail", generate)).rejects.toThrow(
    "progress",
  );
  vi.advanceTimersByTime(5001);
  await controlledNarration("fail", generate);
  expect(generate).toHaveBeenCalledTimes(1);
  expect((await controlledNarration("fail", generate)).cached).toBe(true);
  expect(generate).toHaveBeenCalledTimes(1);
});
it("zero and invalid quotas fail closed; lifetime budget survives rolling windows", async () => {
  vi.useFakeTimers();
  const { controlledNarration } = await fresh();
  vi.stubEnv("AI_TOTAL_LIMIT", "1");
  await controlledNarration("first", async () => value);
  vi.advanceTimersByTime(86400001);
  await expect(
    controlledNarration("second", async () => value),
  ).rejects.toThrow("limit");
  vi.stubEnv("AI_TOTAL_LIMIT", "nonsense");
  await expect(controlledNarration("third", async () => value)).rejects.toThrow(
    "limit",
  );
});
it("lets the hourly cap reach judging-week levels, up to 1000", async () => {
  const { limits } = await fresh();
  vi.stubEnv("AI_HOURLY_LIMIT", "300");
  expect(limits()[1]).toBe(300);
  vi.stubEnv("AI_HOURLY_LIMIT", "5000");
  expect(limits()[1]).toBe(1000);
});
