import { it } from "vitest";
import { runStudy } from "./foundry-study/run";

const mode = process.env.SECOND_LOOK_BOUNDED_FOUNDRY;
it("prepare or execute only the fixed owner-authorized six-case study", async () => {
  if (mode !== "prepare" && mode !== "live")
    throw new Error(
      "Set SECOND_LOOK_BOUNDED_FOUNDRY=prepare or live only within the specific owner authorization.",
    );
  await runStudy(mode);
}, 600000);
