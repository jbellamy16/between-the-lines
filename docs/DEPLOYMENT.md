# Deploy Between the Lines to Azure

The live app runs on an existing Azure App Service. Nothing in this repository creates Azure resources.

| Resource    | Configuration                                                                                                                     |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Web app     | `between-the-lines-jb-f5539b65` in `rg-between-the-lines`, Linux, Node 24 LTS, startup `node server.js`                           |
| Plan        | Basic B1 with Always On for judging (no cold starts or daily CPU quota)                                                           |
| Origin      | `https://between-the-lines-jb-f5539b65.azurewebsites.net`, HTTPS only, TLS 1.2+, FTP and basic publishing authentication off      |
| Model       | Microsoft Foundry deployment `between-the-lines-gpt54-mini` (GPT-5.4 Mini, GlobalStandard, pay per token, 150k tokens per minute) |
| Usage store | TLS Redis (Upstash) shared by every instance for request caps, the answer cache and the dollar ledger                             |

App settings are listed in [the analyst guide](ANALYST.md#turn-it-on-in-azure). Both build and runtime set `HISTORICAL_MATCHES_ENABLED=false` and `RECORDED_MATCHES_VISIBLE=false`, so the public app shows synthetic data only.

## Release

From the repo root, signed in to git and the Azure CLI, with the release commit pushed to `main`:

```sh
bash scripts/release.sh               # build, check, deploy, verify
BUILD_ONLY=1 bash scripts/release.sh  # build and check the package only
```

The script:

1. Clones the pushed `main` into a temporary folder, so no local `.env` file can reach the package, and installs from the lockfile.
2. Runs type checks and unit tests in their normal environment.
3. Builds with `NEXT_PUBLIC_SITE_URL` set to the Azure origin and the synthetic-only flags, then adds the Linux x64 image runtime at the lockfile's version (the build machine may be a Mac).
4. Writes `public/release.json` with the commit, build time and build ID.
5. Zips the standalone server, rejects `.env` files, Redis URLs, private keys and any local secret value, and prints the SHA-256.
6. Asks for confirmation, deploys with `az webapp deploy`, then waits until `/release.json` shows the commit, the homepage loads, the analyst reports enabled and the MCP endpoint initializes.

Packages are kept in `artifacts/release-<date>/` (ignored by git). To roll back, redeploy an earlier package:

```sh
az webapp deploy -g rg-between-the-lines -n between-the-lines-jb-f5539b65 \
  --src-path artifacts/release-<date>/release-<commit>.zip --type zip --clean true --restart true
```

After a release or a settings change the app restarts. Give it a minute before asking the analyst a question: until the usage store reconnects, the analyst says it couldn't finish and shows nothing unverified.

## After judging

Move the plan back to Free F1 after November 10, 2026, and lower or remove the AI request caps.

## Container

The Dockerfile packages the same standalone server for a container host:

```sh
docker build -t between-the-lines .
docker run --rm -p 3000:3000 between-the-lines
```
