import { retryAfter } from "../../src/lib/ai/providers";
import { untilAborted } from "../../src/lib/ai/wait";
import { StudyLedger, usageSchema } from "./ledger";
import { responseReceipt } from "./response-receipt";

/** Install only in the isolated evaluation process, beneath providerResponse.
 * Retries, pacing, timeouts, shared quotas and cache stay in the real runtime. */
export function studyTransport(
  ledger: StudyLedger,
  destination: string,
  transport: typeof fetch,
  checkAllowance?: () => Promise<unknown>,
) {
  let pending = 0;
  const underlying = new Set<Promise<unknown>>();
  function track<T>(promise: Promise<T>) {
    underlying.add(promise);
    void promise.then(
      () => underlying.delete(promise),
      () => underlying.delete(promise),
    );
    return promise;
  }
  const guarded: typeof fetch = async (url, init) => {
    if (
      String(url) !== destination ||
      init?.method !== "POST" ||
      init.redirect !== "error" ||
      init.cache !== "no-store" ||
      typeof init.body !== "string" ||
      !init.signal
    )
      ledger.refuse("accounting");
    const signal = init!.signal!;
    if (checkAllowance) {
      try {
        await untilAborted(checkAllowance(), signal);
      } catch {
        ledger.refuse(signal.aborted ? "cancelled" : "accounting");
      }
    }
    if (signal.aborted) ledger.refuse("cancelled");
    const startedAt = Date.now();
    const reserved = ledger.reserve(init!.body as string);
    // No await between durable reservation, dispatch marker and actual fetch.
    ledger.dispatch(reserved.id);
    pending++;
    let settled = false;
    try {
      const response = await untilAborted(track(transport(url, init)), signal);
      // Read just once within the runtime transport signal. Return the original
      // decoded body to the adapter; persist only allow-listed numeric metadata.
      const value = await untilAborted(track(response.json()), signal).catch(
        () => null,
      );
      const parsed =
        value?.usage === undefined ? null : usageSchema.safeParse(value.usage);
      const usage = parsed?.success ? parsed.data : undefined;
      const responseStatus =
        value?.status === "completed"
          ? "completed"
          : value?.status === "incomplete"
            ? "incomplete"
            : value
              ? "other"
              : "unavailable";
      ledger.settle(reserved.id, {
        status: response.status,
        retryAfterMs: retryAfter(response.headers),
        responseStatus,
        usage,
        latencyMs: Date.now() - startedAt,
        editorial: responseReceipt(value),
      });
      settled = true;
      if (signal.aborted)
        ledger.refuse(
          signal.reason?.name === "TimeoutError" ? "timeout" : "cancelled",
        );
      if (!usage || (parsed && !parsed.success)) ledger.refuse("accounting");
      if (response.ok && (!usage || responseStatus !== "completed"))
        ledger.refuse(!usage ? "accounting" : "invalid_response");
      if (
        !response.ok &&
        (response.status !== 429 ||
          ["insufficient_quota", "billing_hard_limit_reached"].includes(
            value?.error?.code,
          ))
      )
        ledger.stop("terminal_http");
      // Actual response data may contain reasoning items required by Responses;
      // they are passed through in memory and never put in a receipt or log.
      return new Response(JSON.stringify(value), {
        status: response.status,
        headers: response.headers,
      });
    } catch (error) {
      if (!settled)
        ledger.settle(reserved.id, {
          responseStatus: "unavailable",
          latencyMs: Date.now() - startedAt,
        });
      ledger.stop(
        signal.aborted
          ? signal.reason?.name === "TimeoutError"
            ? "timeout"
            : "cancelled"
          : "transport",
      );
      throw error;
    } finally {
      pending--;
    }
  };
  return { fetch: guarded, pending: () => pending + underlying.size };
}
