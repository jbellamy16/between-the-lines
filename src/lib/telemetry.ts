import "server-only";
import type { AzureMonitorOpenTelemetryOptions } from "@azure/monitor-opentelemetry";

type Env = Record<string, string | undefined>;
type Loader = () => Promise<{
  useAzureMonitor: (options?: AzureMonitorOpenTelemetryOptions) => void;
}>;

/**
 * Sends request, error and timing telemetry to Azure Application Insights.
 * It does nothing unless APPLICATIONINSIGHTS_CONNECTION_STRING is set, and a
 * failure here never reaches startup: the app runs the same without it.
 * Only the automatic HTTP traces are collected; question text is never
 * recorded.
 */
export async function startTelemetry(
  env: Env = process.env,
  load: Loader = () => import("@azure/monitor-opentelemetry"),
): Promise<boolean> {
  const connectionString = env.APPLICATIONINSIGHTS_CONNECTION_STRING;
  if (!connectionString) return false;
  try {
    // The name Application Insights shows for this app.
    env.OTEL_SERVICE_NAME ??= "between-the-lines";
    const { useAzureMonitor } = await load();
    useAzureMonitor({
      azureMonitorExporterOptions: { connectionString },
      samplingRatio: 1,
      enableLiveMetrics: false,
    });
    return true;
  } catch {
    return false;
  }
}
