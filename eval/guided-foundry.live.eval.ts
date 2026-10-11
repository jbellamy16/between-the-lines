import { it } from "vitest";
import { runStudy } from "./guided-study/run";
it.skipIf(process.env.SECOND_LOOK_GUIDED_FOUNDRY !== "authorized-once")(
  "single authorized frozen guided campaign",
  async () => {
    await runStudy();
  },
  600000,
);
