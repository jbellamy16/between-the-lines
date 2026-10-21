export async function register() {
  // Telemetry needs Node APIs, so skip the edge runtime.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startTelemetry } = await import("./lib/telemetry");
  await startTelemetry();
}
