import { describe, expect, it, vi } from "vitest";
import { startTelemetry } from "../src/lib/telemetry";

describe("telemetry", () => {
  it("does nothing, and loads nothing, without a connection string", async () => {
    const load = vi.fn();
    expect(await startTelemetry({}, load)).toBe(false);
    expect(
      await startTelemetry({ APPLICATIONINSIGHTS_CONNECTION_STRING: "" }, load),
    ).toBe(false);
    expect(load).not.toHaveBeenCalled();
  });

  it("starts Azure Monitor with the connection string and no live metrics", async () => {
    const useAzureMonitor = vi.fn();
    const started = await startTelemetry(
      { APPLICATIONINSIGHTS_CONNECTION_STRING: "InstrumentationKey=test" },
      async () => ({ useAzureMonitor }),
    );
    expect(started).toBe(true);
    expect(useAzureMonitor).toHaveBeenCalledWith({
      azureMonitorExporterOptions: {
        connectionString: "InstrumentationKey=test",
      },
      samplingRatio: 1,
      enableLiveMetrics: false,
    });
  });

  it("names the service for Application Insights unless one is set", async () => {
    const env: Record<string, string> = {
      APPLICATIONINSIGHTS_CONNECTION_STRING: "InstrumentationKey=test",
    };
    await startTelemetry(env, async () => ({ useAzureMonitor: () => {} }));
    expect(env.OTEL_SERVICE_NAME).toBe("between-the-lines");
    env.OTEL_SERVICE_NAME = "custom";
    await startTelemetry(env, async () => ({ useAzureMonitor: () => {} }));
    expect(env.OTEL_SERVICE_NAME).toBe("custom");
  });

  it("never throws into startup, whether loading or starting fails", async () => {
    const env = {
      APPLICATIONINSIGHTS_CONNECTION_STRING: "InstrumentationKey=test",
    };
    expect(
      await startTelemetry(env, async () => {
        throw new Error("cannot load");
      }),
    ).toBe(false);
    expect(
      await startTelemetry(env, async () => ({
        useAzureMonitor: () => {
          throw new Error("cannot start");
        },
      })),
    ).toBe(false);
  });
});
