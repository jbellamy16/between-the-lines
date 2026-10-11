import { defineConfig } from "vitest/config";
import config from "./vitest.config";
export default defineConfig({
  ...config,
  test: {
    ...config.test,
    include: ["eval/guided-foundry.live.eval.ts"],
    fileParallelism: false,
  },
});
