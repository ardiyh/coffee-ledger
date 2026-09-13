import { afterEach, expect, it, vi } from "vitest";

const { loadEnvConfig } = vi.hoisted(() => ({ loadEnvConfig: vi.fn() }));
vi.mock("@next/env", () => ({ loadEnvConfig }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.resetModules();
});

it.each([
  [undefined, true],
  ["development", true],
  ["production", false],
] as const)("loads the intended environment for NODE_ENV=%s", async (mode, dev) => {
  vi.stubEnv("NODE_ENV", mode);
  await import("./drizzle.config");
  expect(loadEnvConfig).toHaveBeenCalledWith(expect.any(String), dev);
});
