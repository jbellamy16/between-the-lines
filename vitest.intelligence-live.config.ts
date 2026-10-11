import { defineConfig } from "vitest/config";
import config from "./vitest.config";
export default defineConfig({
  ...config,
  test: {
    ...config.test,
    include: ["eval/intelligence.live.eval.ts"],
    testTimeout: 2400000,
    fileParallelism: false,
  },
});
