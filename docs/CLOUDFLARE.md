# Cloudflare deployment

Between the Lines runs on Cloudflare Workers through OpenNext, retaining the existing Next.js application and Azure standalone deployment. OpenAI is the selected provider. Paid inference is disabled, all narration quotas are zero, and no provider key or Redis secret is uploaded with the application.

## Submission read-only check — October 11, 2026

No deployment was performed. A public status GET with curl reported offline; a later Python HTTP client received 403 from both homepage and status. Access is client-dependent and current commit parity is unknown. [Saved observations](submission-preparation/public-status.json) retain both outcomes. Do not advertise this as a verified current judge build until a signed-out browser and exact release check pass.

## Build and verify

```sh
npm ci
npm run typecheck
npm test
npm run cloudflare:build
npx wrangler deploy --dry-run
npx playwright test --config playwright.cloudflare.config.ts
```

The build script creates an isolated temporary source copy, installs the lockfile, builds, verifies that the adapter's embedded environment map is empty, copies `.open-next` back and removes the temporary directory. It never copies or changes `.env.local`. This matters because OpenNext normally embeds `.env` files in its server bundle. Credentials belong in runtime Worker secrets, never build inputs.

The public metadata origin defaults to `https://second-look.sybgm6dkhk.workers.dev`. Set `NEXT_PUBLIC_SITE_URL` to another HTTPS origin before rebuilding if the host changes.

OpenNext 1.20.10 omits Next.js 16.4's `preview-props.json` from its manifest matcher. The build script makes one guarded change inside the disposable adapter installation to include the actual generated manifest. It does not change Next.js or invent preview keys. Remove this workaround once the adapter supports that manifest upstream. Both Node production and Workers runtime browser suites run in CI.

## Publish on the existing Free plan

The owner specified the existing Workers Free plan only. Do not upgrade or create paid services. The API's `standard` usage-model setting is not sufficient evidence of a paid subscription; subscription inspection was unavailable to the CLI. The upload is approximately 1.3 MiB gzip, below the documented 3 MiB Free limit. Use the platform's Free CPU and daily-request limits; no paid CPU override is configured. If the Free limits prevent a working deployment, stop and report the constraint rather than upgrading. No database, R2 bucket, Durable Object, image service or domain purchase is needed for the disabled-inference release.

After tests and CI pass, authenticate the intended account and run:

```sh
npx wrangler whoami
npx wrangler deploy
```

This uploads the already verified bundle. `npm run cloudflare:deploy` rebuilds before publishing. The Worker name is `second-look`; the self-reference binding must match it. Keep deployment manual. Azure's workflow remains available.

Verify HTTPS, the main page, `/api/insights`, `/api/recap` with a valid timestamp, branding images, manifest and icons. With this configuration the status endpoint must report offline, and recap POSTs must return deterministic evidence. Recheck seeking, both modes and mobile layout. Do not infer live OpenAI verification from successful hosting.

## Enable OpenAI later

Before public inference, configure an existing persistent TLS Redis store with no eviction, verify shared quotas and failure behavior in the actual Worker runtime, record the human semantic review, and approve a finite narration allowance. Use `wrangler secret put OPENAI_API_KEY` and `wrangler secret put AI_REDIS_URL` interactively; never put values into this repository or commands saved in chat. Then explicitly set nonzero quotas and `AI_ENABLED=true` and redeploy. Zero quotas are a second guard while the integration is disabled.

The current global Redis client was tested in Node; its Cloudflare TCP/TLS behavior still needs verification with an approved store before enabling inference. If a Workers-native store is chosen later, it must preserve atomic reservations, deduplication, the persistent total allowance and fail-closed behavior. In-memory limits are prohibited in production.

Cloudflare deployment does not authorize OpenAI API calls. The previous eight-request live test allowance is exhausted. Foundry remains an optional adapter; historical Azure access/results do not authorize a new call.

## References

- [Cloudflare OpenNext adapter](https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/)
- [OpenNext setup](https://opennext.js.org/cloudflare/get-started)
- [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
