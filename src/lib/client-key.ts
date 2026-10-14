/**
 * The client as the platform saw it. App Service appends the caller's
 * address, with its port, as the last X-Forwarded-For entry; earlier
 * entries are whatever the caller sent, so they are ignored.
 */
export function clientKey(req: Request) {
  const last = req.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  const bracketed = last && /^\[(.+)\](?::\d+)?$/.exec(last);
  const address = bracketed
    ? bracketed[1]
    : last && /^[\d.]+:\d+$/.test(last)
      ? last.slice(0, last.lastIndexOf(":"))
      : last;
  return address || req.headers.get("x-client-ip") || "local";
}
