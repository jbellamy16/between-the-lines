// Standalone interactive entry only. No import-time execution in eval modules;
// ordinary Vitest discovery and npm check never invoke this command.
import { runOnce } from "../eval/investigator-feasibility/run";
runOnce(process.argv.slice(2))
  .catch(() => {
    console.error(
      "Evaluation blocked or stopped. Preserve receipts and reservations; no automatic rerun.",
    );
    process.exitCode = 1;
  })
  .finally(() => {
    process.exit();
  });
