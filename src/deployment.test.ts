import { describe, it, expect } from "vitest";
import { deploymentFrom } from "./deployment";

describe("the web app's deployment mode", () => {
  it("is standalone when the build says so or says nothing", () => {
    expect(deploymentFrom("standalone")).toBe("standalone");
    expect(deploymentFrom(undefined)).toBe("standalone");
  });
  it("is configurator when env.sh substituted it", () => {
    expect(deploymentFrom(" Configurator ")).toBe("configurator");
  });
  it("refuses anything else, and an unsubstituted placeholder", () => {
    expect(() => deploymentFrom("APP_DEPLOYMENT")).toThrow(/AISC_DEPLOYMENT/);
    expect(() => deploymentFrom("config")).toThrow(/standalone or configurator/);
  });
});

describe("the web app image", () => {
  it("defaults APP_DEPLOYMENT to standalone, so Sean's container without it starts as today", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const dockerfile = readFileSync(resolve(__dirname, "..", "Dockerfile"), "utf8");
    const serveStage = dockerfile.slice(dockerfile.lastIndexOf("FROM "));
    expect(serveStage).toMatch(/^ENV APP_DEPLOYMENT=standalone$/m);
  });
});
