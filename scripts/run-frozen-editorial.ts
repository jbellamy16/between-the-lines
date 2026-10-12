// Intentionally absent from npm/CI/Vitest discovery. Importing modules cannot run it.
import { runOnce } from "../eval/frozen-editorial/run";
runOnce(process.argv.slice(2))
  .catch(() => {
    console.error(
      "Frozen evaluation blocked or stopped. Preserve all receipts and reservations; no automatic rerun.",
    );
    process.exitCode = 1;
  })
  .finally(() => process.exit());
