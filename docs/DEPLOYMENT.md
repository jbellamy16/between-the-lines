# Deploy Between the Lines to Azure

The current synthetic release is verified on the existing Azure host. Cloudflare is unchanged; its alternative runbook remains [here](CLOUDFLARE.md).

## Current verified release — October 11, 2026

PR #26 merged as `2014a497c84c799952c218a0229ec0c16bd964b1`. The public [/release.json](https://between-the-lines-jb-f5539b65.azurewebsites.net/release.json) identifies the compiled artifact. Deployment `4d102384-bafe-4d4b-98f1-a71c22bbdad3` completed successfully; the actual signed-out desktop/mobile walkthrough was verified at 2:10 p.m. America/Chicago. [Full release record, checks, screenshots and rollback](release-2026-10-11/RELEASE.md).

AI and proactive inference remain disabled, quotas remain zero, Foundry stays 30 RPM / 30,000 TPM, and hosting remains F1 Free. Build and runtime explicitly set `HISTORICAL_MATCHES_ENABLED=false` and `RECORDED_MATCHES_VISIBLE=false`. This release uses the existing authenticated Azure CLI; it does not enable basic publishing authentication. The following provisioning and older read-only observations are historical, not the current release status.

## Earlier submission read-only check — October 11, 2026

PR #23 merged as `fb108863dae6a69a7af0df0101ca1fbc66ab4be1`; no deployment followed. Public homepage and status GETs returned 200 from Azure, with `mode: offline` and `proactive: false`. They expose no deployed commit; returned HTML lacks the new style labels. Current-release parity is unverified. See [saved observations](submission-preparation/public-status.json). These checks made no model requests and changed no Azure settings. Recheck the exact deployed version after a separately authorized release.

## Historical provisioning status — October 10, 2026

Azure hosting resources were provisioned and an earlier application version deployed on October 10, 2026, under the owner's free-only authorization. Public verification completed at 11:32 a.m. America/Chicago. Normal inference stays disabled. Nothing in this repository provisions resources automatically.

| Resource         | Configuration                                                                                |
| ---------------- | -------------------------------------------------------------------------------------------- |
| Subscription     | Personal `Azure subscription 1` (`f5539b65-3db7-428e-a605-e4c0763c1c5d`)                     |
| Resource group   | `rg-between-the-lines`, West US 3                                                            |
| App Service plan | `asp-between-the-lines-free`, verified SKU `F1`, tier `Free`                                 |
| Web app          | `between-the-lines-jb-f5539b65`, Linux Node 24 LTS, startup `node server.js`                 |
| Live app origin  | `https://between-the-lines-jb-f5539b65.azurewebsites.net`                                    |
| Access           | Public HTTPS, minimum TLS 1.2, FTP and basic publishing authentication disabled              |
| AI               | Foundry selected; AI and proactive inference disabled; minute/hour/day/total quotas all zero |

No paid hosting, Redis, registry, storage or monitoring workspace was added. A pay-per-token model deployment was subsequently authorized and provisioned as described below. The subscription is pay-as-you-go with its spending limit off; the free hosting tier and disabled inference are the scope of this setup, not a subscription-wide billing cap. F1 provides 60 CPU minutes per day, 1 GB memory and 1 GB storage, with no uptime SLA. Do not upgrade automatically if those limits are reached. See [Microsoft's Linux App Service pricing](https://azure.microsoft.com/en-us/pricing/details/app-service/linux/).

### Foundry model deployment

On October 10, 2026, the owner authorized deployment of the app's model. Deployment `between-the-lines-gpt54-mini` was created under the existing Foundry account `josh-5098-resource` in `rg-josh-5843` (West US 3), alongside project `josh-5098`.

- Model: `gpt-5.4-mini`, version `2026-03-17`.
- Deployment type: `GlobalStandard`, pay-per-token; no provisioned throughput was purchased.
- Capacity: **30 units**, increased from 10 under the owner’s explicit October 11 authorization. Azure confirms **30 requests and 30,000 tokens per minute**, state `Succeeded`; [before/after receipt](intelligence/foundry-capacity-2026-10-11.json). The application defaults and hard ceilings match. These are throughput limits, not a spending cap; this allocation remains in place.
- Provisioning state verified: `Succeeded`; the quota allocation succeeded.
- The web app now has `FOUNDRY_ENDPOINT=https://josh-5098-resource.openai.azure.com`, `FOUNDRY_DEPLOYMENT=between-the-lines-gpt54-mini` and the resource key stored only in its server-side settings. `AI_PROVIDER=foundry`, but `AI_ENABLED=false`, legacy `FOUNDRY_ENABLED=false`, proactive inference disabled and all application quotas zero.
- No model inference requests were made during provisioning. Subsequent isolated Foundry evaluation completed 43 HTTP attempts for approximately $0.20 in known token charges; see [the full report](FOUNDRY-EVALUATION.md) for failures, fixes and the unresolved editorial-quality limitation. The evaluation temporarily raised throughput capacity and restored it to 10. The evaluation fixes are included in the current release candidate. A persistent TLS Redis usage store and an approved finite request allowance are still required.

OpenAI Fan narration previously passed a local authorized live check. The revised Fan and Analyst recap composition subsequently passed the isolated Foundry check. Public provider execution and production Redis are still unverified.

A later [editorial/model comparison](EDITORIAL-MODEL-COMPARISON.md) temporarily deployed GPT-5.4, completed 88 model requests for an estimated $0.95456210, then deleted that comparison deployment and restored Mini capacity to 10. Mini remains the selected deployment. The final editorial fixes are included in the current release candidate; public AI flags and quotas remain disabled/zero.

### Historical Director 1.1.2 release candidate

The current release brings the centered scoreboard, favorite stars, Carries metric, improved evidence presentation, and one consistent analyst-detail experience. Mode choices and the duplicate league/date pill have been removed. Saved team/player preferences are preserved. Director 1.1.2 includes bounded query recovery, complete comparison-window retrieval, stricter claim selection and duplicate-story filtering. Public paid inference remains disabled.

Local verification: 308 unit tests passed (2 optional tests skipped), type checking and production build passed, and 111 browser checks passed (36 hidden-source checks skipped). GitHub CI additionally enables recorded fixtures and Redis. The release is packaged without local environment files; deployment results are recorded in the release conversation and ignored artifacts.

### Initial verified Azure release

The release was built from an isolated copy of the current working tree, including the favorite star and Carries card. Local environment files and credentials were excluded. `NEXT_PUBLIC_SITE_URL` was set to the Azure origin before building. Linux x64 Sharp runtime packages were added at the exact versions and SHA-512 integrity values in the lockfile. The standalone ZIP was uploaded with the signed-in Azure CLI; basic publishing authentication remains disabled.

- Deployment ID: `be75ee82-1b67-4873-b01d-85a8c3d09578`.
- ZIP SHA-256: `dad9fd9943fe3b5e092acc20083ac1994198567a29ff090f58a6ce7d970ac1cb`.
- Type checking and production build passed. Unit checks: 301 passed, 2 skipped (optional Redis/research coverage). Production browser checks: 111 passed, 36 skipped for the hidden recorded-match experience.
- Public homepage, manifest, favicons and social images returned HTTP 200, with metadata using the Azure origin.
- The status API reports offline configuration and proactive inference disabled. Recap requests at kickoff and 63:24 returned timestamp-correct offline evidence; invalid input returned HTTP 400.
- Public Chromium checks at 1440px and 390px verified all five navigation sections, favorite toggling, the Carries card, recap opening and rewind to 0–0, without page errors or horizontal overflow.
- Local evidence: `artifacts/azure-live-verification.json` and `artifacts/azure-live-*-player.png` (ignored build artifacts). Physical Safari, live AI, production Redis and the hidden historical UI were not verified by this release.

## 1. Prepare an existing App Service

Sign into the intended subscription with `az login`. Select the subscription explicitly. Use an existing Linux App Service with a supported Node runtime; the repository’s CI/container target Node 24 LTS. Verify availability in the target subscription/region:

```sh
az webapp list-runtimes --os linux -o table
```

If no suitable app exists, review App Service plan and Foundry model costs and obtain approval before creating resources. This runbook intentionally contains no resource-creation commands.

Configure the existing app:

- Linux Node runtime compatible with the application, preferably Node 24 LTS.
- Startup command: `node server.js` (deployment packages the standalone server).
- `NODE_ENV=production`, `HOSTNAME=0.0.0.0`; allow the hosting platform to supply `PORT`.
- `SCM_DO_BUILD_DURING_DEPLOYMENT=false`; the workflow uploads the completed build.
- Public access, HTTPS only; no login barrier for judges.
- Keep `AI_ENABLED=false` until paid inference is approved. Production inference requires an existing TLS Redis store shared across all instances; see the controls and persistence requirements in `AI-EVALUATION.md`.

## 2. Package and deploy with the existing authenticated CLI

The existing GitHub deploy workflow expects a publish-profile secret that is not configured for this app. Do not run it as-is or enable basic publishing authentication. A future OIDC workflow is optional separate work. The current supported mechanism is `az webapp deploy` using the existing signed-in Azure CLI session.

1. Fetch/review/merge the approved product commit with passing checks. Use a clean isolated checkout; do not copy local `.env` files or credentials. Keep generated files in the original checkout intact.
2. Install from the lockfile, run type checking and unit tests with their normal test fixtures. Apply disabled-AI and synthetic-only flags to the **production build and runtime**; applying zero production quotas to mocked-provider unit tests changes those tests' intended environment.
3. Set `NEXT_PUBLIC_SITE_URL=https://between-the-lines-jb-f5539b65.azurewebsites.net` **before** `npm run build`. `postbuild` copies `public` and `.next/static` into `.next/standalone`.
4. If building on macOS, add Linux x64 Sharp/libvips runtime packages at the lockfile's exact versions and verify their SHA-512 integrity. Preserve the Linux Node 24 runtime. Package only the standalone directory.
5. Generate `public/release.json` **inside the packaged standalone artifact** with product name, full source commit, UTC build time and `.next/BUILD_ID`. Do not include host paths, identity data or secrets. Scan the ZIP to reject `.env*` files and keys. Record its SHA-256 and retain the previous verified package.
6. Confirm the intended subscription, free plan, security settings, disabled inference and zero quotas. For this submission both build and runtime require `HISTORICAL_MATCHES_ENABLED=false` and `RECORDED_MATCHES_VISIBLE=false`.
7. Deploy the approved local ZIP (substitute its actual path):

```sh
az webapp deploy --resource-group rg-between-the-lines --name between-the-lines-jb-f5539b65 --src-path APPROVED_RELEASE.zip --type zip --clean true --restart true --timeout 600000
```

8. Verify runtime success, `/release.json` identity, `/api/insights` offline status and actual signed-out desktop/mobile flows. Historical GET and narration/Director endpoints must reject access. Verify source restrictions, recap styles/lengths, guided answers, replay, rewind, preferences, browser errors and overflow. See [current evidence](release-2026-10-11/RELEASE.md).
9. On verification failure, redeploy the retained known-good ZIP through the same command, keep AI disabled and source restrictions in place, and verify recovery. The prior package path/hash and deployment ID are in the release record. A successful upload is not a successful release.

No authentication tokens, publish profiles, provider keys or unfiltered app settings should appear in logs, documentation or packages.

## 3. Configure an optional provider after spending approval

In Microsoft Foundry, select an existing Azure OpenAI model deployment supporting the Responses API, function tools, and structured output. Verify availability for that model and region. Do not create a paid deployment without approval.

In the App Service Configuration/Environment variables panel, enter `FOUNDRY_ENDPOINT`, `FOUNDRY_API_KEY`, `FOUNDRY_DEPLOYMENT`, plus `AI_PROVIDER=foundry` and `AI_ENABLED=true`, and conservative shared `AI_MINUTE_LIMIT`, `AI_HOURLY_LIMIT`, `AI_DAILY_LIMIT`, and `AI_TOTAL_LIMIT` settings. Configure `AI_REDIS_URL` with an existing TLS Redis connection. Use the Azure OpenAI resource root endpoint, e.g. `https://RESOURCE.openai.azure.com`. The server calls `/openai/v1/responses` with resource API-key authentication. The `.services.ai.azure.com` resource hostname is accepted, but project endpoints requiring Entra authentication are not supported by this key-based adapter.

For the OpenAI alternative, use `AI_PROVIDER=openai`, `OPENAI_API_KEY`, and `OPENAI_MODEL=gpt-5.4-mini` with the same shared usage controls. Do not enable both workflows independently: the selector routes through one shared orchestration.

Keep all secrets server-side; never put keys in repository variables, browser code, `NEXT_PUBLIC_*`, screenshots, or submission materials. Use persistent Redis quota storage with no eviction and consistent limits on all instances. Store outages fail closed. Alerts are useful but are not hard spending caps; the application enforces request reservations, not a dollar-denominated billing ceiling. Run the authorized small evaluation and human review in `AI-EVALUATION.md` before public AI access.

## 4. Verify the actual deployment

1. Load the public URL in a signed-out/private browser. Confirm score 1–0 at 63:24 in the pressure fixture.
2. Play, pause, seek back to kickoff: score must be 0–0; early recaps must exclude later events.
3. Select pressure evidence and replay; inspect the detailed window comparisons supplied by default.
4. **Only with separately authorized paid inference:** select **Explain with Microsoft Foundry**. Confirm the **MICROSOFT FOUNDRY · VERIFIED STORY** label appears and a natural-language explanation is returned. A “configured” header alone is insufficient.
5. Review prose for unsupported claims. Check that evidence IDs match the displayed pattern and that event-derived figures remain unchanged.
6. **Only during an authorized configuration change:** confirm offline fallback by temporarily setting `AI_ENABLED=false` and restarting; restore only if the configured integration works.
7. Check browser console and server logs without logging keys or request authentication headers.
8. Confirm desktop and physical mobile behavior, HTTPS, and uninterrupted judge access through November 10, 2026, at 11:59 p.m. Pacific.

## Optional container route

The Dockerfile packages the same standalone app for an existing Azure container host. Build and run locally:

```sh
docker build -t second-look .
docker run --rm -p 3000:3000 second-look
```

Container build was supplied as deployment preparation; it must be tested in the destination container environment. No registry, container host, or paid service is provisioned here.

## Official technical references

- [Microsoft Foundry Responses API](https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/responses)
- [Structured outputs](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/structured-outputs)
- [Azure App Service GitHub Actions deployment](https://learn.microsoft.com/en-us/azure/app-service/deploy-github-actions)
- [Next.js standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)

## Brand metadata before hosting

Set `NEXT_PUBLIC_SITE_URL` to the chosen public HTTPS origin **at build time** so Open Graph and X image URLs resolve to the actual host. The variable is a public origin, not a secret. Keep inference keys server-side. Verify `/manifest.webmanifest`, `/favicon.ico`, `/apple-touch-icon.png`, `/opengraph-image.png`, and `/twitter-image.png` after deployment. The supplied OG is 1200×630 and X is 1200×675. The manifest does not imply offline caching.
